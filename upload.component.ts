import { HttpClient, HttpEvent, HttpEventType, HttpRequest } from '@angular/common/http';
import { Component, Input, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import Worker from './worker.js';
@Component({
    selector: 'app-upload',
    templateUrl: './upload.component.html',
    styleUrls: ['./upload.component.less'],
})
export class UploadComponent implements OnInit {
    @Input() uploadUrl = 'http://localhost:3000/users/upload';
    @Input() progressVisible: boolean = true;
    @Input() limit = 3; // 每次上传分片限制
    private totalChunks = 0;
    private chunkSize = 1024 * 1024 * 150;
    private currentFile: NzUploadXHRArgs;
    constructor(private http: HttpClient, private message: NzMessageService) {}

    // 分片合并
    mergeChunk(name: string) {
        const formData = new FormData();
        formData.append('name', name);
        const req = new HttpRequest('POST', 'http://localhost:3000/users/merge', formData, {
            reportProgress: true,
            withCredentials: false,
        });
        this.http.request(req).subscribe(
            (event: HttpEvent<{}>) => {
                if (event.type === HttpEventType.Response) {
                    this.currentFile.file.percent = 100;
                    this.currentFile.onSuccess!(event.body, this.currentFile.file, event);
                    this.message.success('上传成功！');
                }
            },
            (err) => {
                this.message.error('上传失败！');
            },
        );
    }

    // 多分片同时上传
    handleUpload = (file: NzUploadXHRArgs) => {
        this.currentFile = file;
        const piecesArr = this.sliceFile2Pieces(file);
        const uploadArr = [];
        const start = () => {
            if (!piecesArr.length) {
                return Promise.resolve();
            }
            const chunkItem = piecesArr.shift();
            const formData = new FormData();
            formData.append('file', chunkItem);
            formData.append('name', 'test');
            const req = new HttpRequest('POST', file.action!, formData, {
                reportProgress: true,
                withCredentials: false,
            });
            const it = this.http.request(req).toPromise<HttpEvent<{}>>();
            it.then(
                (event: HttpEvent<{}>) => {
                    if (event.type === HttpEventType.UploadProgress) {
                        if (event.total! > 0 && this.progressVisible) {
                            (event as any).percent = ((event.loaded + (this.totalChunks + 1) * this.chunkSize) / file.file.size) * 100;
                        }
                        file.onProgress!(event, file.file);
                    } else if (event.type === HttpEventType.Response) {
                        uploadArr.splice(uploadArr.indexOf(it), 1);
                    }
                },
                (err) => {
                    uploadArr.unshift(chunkItem);
                },
            );
            uploadArr.push(it);
            let p = Promise.resolve();
            if (uploadArr.length >= this.limit) {
                p = Promise.race(uploadArr);
            }
            return p.then(() => start());
        };

        start().then(
            () => {
                Promise.all(uploadArr).then(() => {
                    this.mergeChunk(this.currentFile.file.name);
                });
            },
            (err) => {},
        );
    };

    sliceFile2Pieces(file: NzUploadXHRArgs) {
        const uploadFile = file.file as any;
        this.currentFile = file;
        let [name, suffix] = uploadFile.name.split('.');
        const pieceArr = [];
        let tempSize = 0;
        let i = 0;
        this.totalChunks = Math.ceil(uploadFile.size / this.chunkSize);
        while (tempSize < uploadFile.size) {
            pieceArr.push(
                new File(
                    [uploadFile.slice(tempSize, i % 2 === 0 ? 3 * (tempSize + this.chunkSize) : (tempSize + this.chunkSize) / 3)],
                    `${name}.${i}.${suffix}`,
                ),
            );
            tempSize += this.chunkSize;
            i++;
        }
        return pieceArr;
    }

    ngOnInit(): void {}
}
