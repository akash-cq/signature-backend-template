import PDFMerger from "pdf-merger-js";
import { signStatus, status } from "../../constants/index.js";
import { dispatchCreation, MakeDispatch } from "../../controller/dispatch.js";
import { checkLoginStatus } from "../../middleware/checkAuth.js";
import { templateServices } from "../../services/index.js";
import { promisify } from "util";
import libre from "libreoffice-convert";
const libreConvertAsync = promisify(libre.convert);
import * as fs from "fs";
import { Router } from "express";
const router = Router();

router.post("/", checkLoginStatus, async (req, res, next) => {
  try {
    const { userId, courtId } = req.session;
    const { id = null, index = null } = req.body;
    const templateId = id;
    // console.log(req.body)
    if (!templateId) {
      return res.status(400).json({ error: "please provide template id" });
    }
    if (!index) {
      return res.status(400).json({ error: "please index number" });
    }
    const templateData = await templateServices.findOne({
      id: templateId,
      status: status.active,
      signStatus: signStatus.Signed,
    });
    if (!templateData) {
      return res.status(404).json({ error: "template not found" });
    }
    const latestTemplate = await templateServices
      .findOne({ signStatus: signStatus.dispatched })
      .sort({
        dispatchRegisterIndex: -1,
      })
      .limit(1);
    console.log(latestTemplate);
    const lastIndex = latestTemplate ? latestTemplate.dispatchRegisterIndex : 0;
    if (lastIndex >= index) {
      return res
        .status(400)
        .json({ error: "this index number already in use" });
    }

    const merger = new PDFMerger();
    const data = {};
    data.templateId = templateId;
    data.courtId = courtId;
    data.index = index;
    const obj = {
      signer: req.session.name,
      title: templateData.templateName,
      index: index,
      date: "12/2024",
      courtId: data.courtId,
    };
    const buffer = await MakeDispatch(obj);
    let pdfBuf = await libreConvertAsync(buffer, ".pdf", undefined);

    merger.add(pdfBuf);

    const d = await dispatchCreation(data);

    const mergedPdfBuffer = await merger.saveAsBuffer();

    await fs.promises.writeFile(
      "E:/Signature/signature-backend-template/pdfMergerData/" +
        templateId +
        ".pdf",
      mergedPdfBuffer
    );
    const url = "http://localhost:3000/pdfMergerData/" + templateId + ".pdf";
    await templateServices.updateOne(
      {
        id: templateId,
        status: status.active,
      },
      {
        $set: {
          status: status.active,
          signStatus: signStatus.dispatched,
          dispatchRegisterIndex: index,
          dispatchURL: url,
        },
      }
    );
    res.json(url);
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.post("/All", checkLoginStatus, async (req, res, next) => {
  try {
    const { userId, courtId } = req.session;
    const { id = null, index = null } = req.body;
    const templateId = id;
    // console.log(req.body)
    if (!templateId) {
      return res.status(400).json({ error: "please provide template id" });
    }
    if (!index) {
      return res.status(400).json({ error: "please index number" });
    }
    const templateData = await templateServices.findOne({
      id: templateId,
      status: status.active,
      signStatus: signStatus.Signed,
    });
    if (!templateData) {
      return res.status(404).json({ error: "template not found" });
    }
    const latestTemplate = await templateServices
      .findOne({ signStatus: signStatus.dispatched })
      .sort({
        dispatchRegisterIndex: -1,
      })
      .limit(1);
    console.log(latestTemplate);
    
    const lastIndex = latestTemplate ? latestTemplate.dispatchRegisterIndex : 0;
    if (lastIndex >= index) {
      return res
        .status(400)
        .json({ error: "this index number already in use" });
    }
    const signedData = templateData.data.filter((obj) => {
      return obj.signStatus == signStatus.Signed;
    });
    const merger = new PDFMerger();
    let i = 0;
    const indx = Number(index)
    for (const dt of signedData) {
      const data = {};
      data.templateId = templateId;
      data.courtId = courtId;
      data.index = indx + i;
      const obj = {
        signer: req.session.name,
        title: templateData.templateName,
        index: indx + i,
        date: "12/2024",
        courtId: data.courtId,
        dataId: dt.id,
      };
      const buffer = await MakeDispatch(obj);
      let pdfBuf = await libreConvertAsync(buffer, ".pdf", undefined);

      merger.add(pdfBuf);

      const d = await dispatchCreation(data);
      i++;
    }
    const mergedPdfBuffer = await merger.saveAsBuffer();

    await fs.promises.writeFile(
      "E:/Signature/signature-backend-template/pdfMergerData/" +
        templateId +
        ".pdf",
      mergedPdfBuffer
    );
    const url = "http://localhost:3000/pdfMergerData/" + templateId + ".pdf";
    await templateServices.updateOne(
      {
        id: templateId,
        status: status.active,
      },
      {
        $set: {
          status: status.active,
          signStatus: signStatus.dispatched,
          dispatchRegisterIndex: index,
          dispatchURL: url,
        },
      }
    );
    res.json(url);
  } catch (error) {
    console.log(error);
    next(error);
  }
});
export default router;
