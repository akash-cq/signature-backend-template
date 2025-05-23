import { Router } from "express";
import { templateServices } from "../services/index.js";
import { status } from "../constants/index.js";
import * as fs from "fs";
import path from "path";
import { FillTemplate } from "../controller/FillTemplates.js";
import { promisify } from "util";
import libre from "libreoffice-convert";
const libreConvertAsync = promisify(libre.convert);

import { checkLoginStatus } from "../middleware/checkAuth.js";
import archiver from "archiver";

const router = Router();

router.get("/:templateId/preview/:entryId", async (req, res, next) => {
  try {
    // console.log(req.params);
    const { templateId, entryId } = req.params;
    if (!templateId) {
      return res.status(400).json({ msg: "no templateId provided" });
    }
    if (!entryId) {
      return res.status(400).json({ msg: "preview Id is not given" });
    }
    const template = await templateServices.findOne({
      id: templateId,
      status: status.active,
    });

    if (!template) {
      return res.status(404).json({ error: "no template found" });
    }
    if (
      template.createdBy != req.session.userId &&
      template.assignedTo != req.session.userId
    ) {
      return res.status(401).json({ error: "you are not authorized for this" });
    }
    const data = template.data.filter((obj) => obj.id == entryId);
    if (data.length == 0) {
      return res.status(404).json({ error: "no excel entry found" });
    }
    console.log(template.url);
    const entries = data[0]?.data;
    entries["Signature"] = null;
    entries["QR_Code"] = null;
    const content = await fs.promises.readFile(
      path.join("E:/Signature/signature-backend-template", template.url)
    );
    const buffer = await FillTemplate(content, entries);
    let pdfBuf = await libreConvertAsync(buffer, ".pdf", undefined);
    let a = new Date();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=preview (${a}).pdf`);
    res.send(pdfBuf);
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.get("/preview/docx/:id", checkLoginStatus, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ msg: "no templateId given" });
    }
    const { url, createdBy, assignedTo } = await templateServices.findOne(
      {
        id: id,
        status: status.active,
      },
      { url: 1, createdBy: 1, assignedTo: 1 }
    );
    if (!url) {
      return res.status(404).json({ error: "template not found" });
    }
    if (
      createdBy != req.session.userId &&
      assignedTo != req.session.userId
    ) {
      return res.status(401).json({ error: "you are not authorized for this" });
    }
    console.log(url);
    const content = await fs.promises.readFile(
      path.join("E:/Signature/signature-backend-template", url)
    );
    let pdfBuf = await libreConvertAsync(content, ".pdf", undefined);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=preview.pdf");
    res.send(pdfBuf);
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.get(
  "/SignatureData/:signatureId/:fileId.pdf",
  checkLoginStatus,
  async (req, res, next) => {
    try {
      console.log(req.url);
      const { signatureId, fileId } = req.params;
      const { preview } = req.query;
      const template = await templateServices.findOne({
        id:signatureId,status:status.active
      })
      if(!template){
        return res.status(404).json({error:'no tamplate found'})
      }
      if (template.createdBy!=req.session.userId && template.assignedTo!=req.session.userId) {
        return res.status(401).json({ error: "you are not authorized for this" });
      }
      const filePath = path.join(
        "E:/Signature/signature-backend-template",
        "signatureData",
        signatureId,
        `${fileId}.pdf`
      );

      res.setHeader("Content-Type", "application/pdf");
      if (!preview) {
        res.setHeader("Content-Disposition","attachement; filename=download.pdf");
      } else {
        res.setHeader("Content-Disposition", "inline; filename=download.pdf");
      }
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
);

router.get(
  "/downloads/:templateId",
  checkLoginStatus,
  async (req, res, next) => {
    try {
      console.log(req.url);
      const { templateId } = req.params;

      if (!templateId) {
        return req.status(400).json({ error: "no template id provided" });
      }
      const template = await templateServices.findOne({
        id: templateId,
        status: status.active,
      });
      if (
        template.createdBy != req.session.userId &&
        template.assignedTo != req.session.userId
      ) {
        return res
          .status(401)
          .json({ error: "you are not authorized for this" });
      }
      const folderPath = path.join(
        "E:/Signature/signature-backend-template",
        "signatureData",
        templateId
      );

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachement; filename=${templateId}.zip`
      );
      const archive = archiver("zip", {
        zlib: { level: 9 },
      });
      archive.pipe(res);
      const files = await fs.promises.readdir(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = await fs.promises.stat(filePath);
        if (stat.isFile()) {
          archive.file(filePath, { name: file });
        }
      }
      archive.finalize();
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
);

export default router;
