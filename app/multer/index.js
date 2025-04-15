import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/templates");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = randomUUID();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

function fileFilter(req, file, cb) {
  const filetypes = /\.docx$/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype =
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only .docx files are allowed!"));
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, 
});

export default upload;
