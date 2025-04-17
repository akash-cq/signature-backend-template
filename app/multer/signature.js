import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import * as fs from 'fs';
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    console.log(req.session)
      await fs.promises.mkdir(
        `E:/Signature/signature-backend-template/uploads/signatures/${req.session.userId}`,
        { recursive: true }
      );
    cb(null, `./uploads/signatures/${req.session.userId}`);
  },
  filename: function (req, file, cb) {
    console.log("in filename")
    const uniqueSuffix = randomUUID();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

function fileFilter(req, file, cb) {
  const filetypes = /\.(jpeg|jpg|png|bmp)$/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype =
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/bmp" ||
    file.mimetype === "image/jpg";

  if (extname && mimetype) {
    console.log('in filefilter')
    return cb(null, true);
  } else {
    cb(new Error("Only .docx files are allowed!"));
  }
}

const SignatureUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, 
});

export default SignatureUpload;
