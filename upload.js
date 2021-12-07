const fs = require("fs")
const path = require("path")
const express = require("express")
const multer = require("multer")

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    // 分片文件保存在临时目录
    let [fname, index, suffix] = file.originalname.split(".")
    let chunkDir = `./public/uploads/tmp/${fname}`

    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir)
    }

    callback(null, chunkDir)
  },
  filename: (req, file, callback) => {
    // 临时文件用分片索引命名，分片文件不加扩展名，合并的时候再添加扩展名
    let fname = file.originalname
    callback(null, fname.split(".")[1])
  },
})
const upload = multer({ storage: storage })
router.get("/", (req, res, next) => {})
router.post("/upload", upload.any(), (req, res, next) => {
  res.send({ success: "0" })
})

// 文件合并路由
router.post("/merge", upload.none(), (req, res) => {
  let name = req.body.name
  let fname = name.split(".")[0] //取文件名字
  let chunkDir = `./public/uploads/tmp/${fname}`
  let chunks = fs.readdirSync(chunkDir)

  // 顺序合并
  chunks
    .sort((a, b) => a - b)
    .map((chunkPath) => {
      fs.appendFileSync(
        path.join("./public/uploads/tmp/", name),
        fs.readFileSync(`${chunkDir}/${chunkPath}`)
      )
    })

  fs.rm(chunkDir, { recursive: true, force: true }, () => {}) // 递归删除文件夹
  res.send({ msg: "合并成功", url: `http://localhost:8080/upload/${name}` })
})

module.exports = router
