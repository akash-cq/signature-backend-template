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

const router = Router();

router.get("/:templateId/preview/:entryId", async (req, res, next) => {
  try {
    console.log(req.params);
    const { templateId, entryId } = req.params;
    if (!templateId) {
      return res.status(400).json({ msg: "no templateId given" });
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
    const data = template.data.filter((obj) => obj.id == entryId);
    if (data.length == 0) {
      return res.status(404).json({ error: "no excel entry found" });
    }
    console.log(template.url);
    const entries = data[0]?.data;
    entries["Signature"] =null;
    entries["QR_Code"] = null;
    const content = await fs.promises.readFile(
      path.join("E:/Signature/signature-backend-template", template.url)
    );
    const buffer = await FillTemplate(content, entries);
    let pdfBuf = await libreConvertAsync(buffer, ".pdf", undefined);
    let a = new Date()
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
    const {url} = await templateServices.findOne({
      id: id,
      status: status.active,
    },{url:1});
    if(!url){
        return res.status(404).json({error:'template not found'})
    }
    console.log(url)
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

export default router;
