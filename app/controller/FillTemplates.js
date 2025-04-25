import { createReport } from "docx-templates";
import path from "path";
import * as fs from "fs"
import { signStatus, status } from "../constants/index.js";
import { randomUUID } from "crypto";
import { promisify } from "util";
import libre from "libreoffice-convert";
import { templateServices } from "../services/index.js";
import { io } from "../config/socket.js";
import axios from "axios";
import QRCode from "qrcode";
const libreConvertAsync = promisify(libre.convert);

const generateQR = async (text) => {
  try {
    if (!text) return null;
      const dataWithoutQRCode = { ...text };
    delete dataWithoutQRCode.QR_Code;
    const stringData = JSON.stringify(dataWithoutQRCode);
    const dataURL = await QRCode.toDataURL(stringData); // returns full 'data:image/png;base64,...'
    const base64 = dataURL.slice("data:image/png;base64,".length);
    return base64
  } catch (err) {
    console.error("QR code generation error:", err);
    return null;
  }
};
async function getImageBase64FromURL(imageUrl) {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });

  const imageBuffer = Buffer.from(response.data, "binary");
  const base64 = imageBuffer.toString("base64");

  const extension = path.extname(imageUrl);

  return { base64, extension };
}

export const FillTemplate = async (content, entry) => {
  try {
    const Signature = async () => {
      if (entry.Signature == null) return null;
      const imageUrl = entry.Signature;
      const { base64, extension } = await getImageBase64FromURL(imageUrl);

      return {
        width: 6,
        height: 3,
        data: base64,
        extension: extension,
      };
    };
    const QR_Code = async () => {
      if (!entry.QR_Code) return null;
      const base64 = await generateQR(entry.QR_Code);
      return {
        width: 3,
        height: 3,
        data: base64,
        extension: ".png",
      };
    };
    const buffer = await createReport({
      template: content,
      data: entry,
      cmdDelimiter: ["{", "}"],
      additionalJsContext: {
        Signature,
        QR_Code,
      },
    });

    return buffer;
  } catch (err) {
    console.error("Error generating DOCX:", err);
    throw err;
  }
};

export const startSign = async ([templateData, signature, userId]) => {
  try {
    const signatureUrl = signature.url;
    const dataNeedToSign = templateData.data.filter((obj) => {
      // console.log(obj.signStatus, obj.status, "ehcyehvbfcewvgfyu3wv");

      return (
        (obj.signStatus == signStatus.unsigned ||
          obj.signStatus == signStatus.delegated) &&
        obj.status == status.active
      );
    });
    // console.log(dataNeedToSign);
    const content = await fs.promises.readFile(
      path.join("E:/Signature/signature-backend-template", templateData.url)
    );

    const outputDir = path.join(
      "E:/Signature/signature-backend-template/signatureData",
      String(templateData.id)
    );
    await fs.promises.mkdir(outputDir, { recursive: true });

    const Limit = 10;
    const CreatedBy = String(templateData.createdBy);

    const signer = templateData?.delegatedTo
      ? null
      : String(templateData.assignedTo);

    const requestsData = {
      id: templateData.id,
      templateName: templateData.templateName,
      description: templateData.description,
      createdAt: templateData.createdAt,
      status: templateData.status,
      url: templateData.url,
      signStatus: templateData.signStatus,
      createdBy: templateData.createdBy,
      DocCount: templateData.data.reduce((count, obj) => {
        return obj.status == status.active ? count + 1 : count;
      }, 0),

      delegationReason: templateData.delegationReason,

      rejectCount: templateData.data.reduce((count, element) => {
        return element.signStatus === signStatus.rejected ? count + 1 : count;
      }, 0),

      delegatedTo: templateData.delegatedTo,
      totalgenerated: 0,
    };
    if (signer) io.to(signer).emit("generationStart", requestsData);
    io.to(CreatedBy).emit("generationStart", requestsData);
    for (let i = 0; i < dataNeedToSign.length; i += Limit) {
      console.log("start..............");
      const dataObj = dataNeedToSign.slice(i, i + Limit);
      const ops = await processing(
        dataObj,
        signatureUrl,
        outputDir,
        content,
        templateData.id
      );
      // console.log(signer, CreatedBy, requestsData.id, "bdfhvk");
      requestsData.totalgenerated = requestsData.totalgenerated + ops.length;
      if (signer) io.to(signer).emit("generatedOneBatch", requestsData);
      io.to(CreatedBy).emit("generatedOneBatch", requestsData);
      console.log("batch completed with limit", i + Limit, "from", i);
    }

    await templateServices.updateOne(
      { id: templateData.id },
      {
        $set: {
          signDate: new Date(),
          signStatus: signStatus.Signed,
          status: status.active,
        },
      }
    );
    console.log("end...");
    // console.log(signer, CreatedBy, requestsData.id, "bdfhvk");
    requestsData.status = status.active;
    requestsData.signStatus = signStatus.Signed;
    requestsData.signDate = new Date();
    if (signer) io.to(signer).emit("generatedEnd", requestsData);
    io.to(CreatedBy).emit("generatedEnd", requestsData);
    return;
  } catch (error) {
    await templateServices.updateOne(
      {
        id: templateData.id,
        status: status.active,
      },
      {
        $set: {
          status: status.active,
          signStatus: templateData.signStatus,
          "data.$[item].signStatus": templateData.signStatus,
        },
      },
      {
        arrayFilters: [
          {
            "item.signStatus": {
              $in: [signStatus.delegated, signStatus.readyForSign],
            },
          },
        ],
      }
    );
    console.error("Error in startSign:", error);
  }
};

const processing = async (
  dataNeedToSign,
  signatureUrl,
  outputDir,
  content,
  templateId
) => {
  const updateOps = [];

  const tasks = dataNeedToSign.map(async (item) => {
    try {
      const entry = item.data;
      entry["Signature"] = signatureUrl;
      entry["QR_Code"] = item.data;

      const buffer = await FillTemplate(content, entry);
      const pdfBuf = await libreConvertAsync(buffer, ".pdf", undefined);
      let ab = randomUUID();
      const pdfPath = path.join(outputDir, `${ab}.pdf`);
      await fs.promises.writeFile(pdfPath, pdfBuf);
      await templateServices.updateOne(
        { id: templateId, "data.id": item.id },
        {
          $set: {
            "data.$.url": `http://localhost:3000/template/signatureData/${templateId}/${ab}.pdf`,
            "data.$.signedDate": new Date(),
            "data.$.signStatus": signStatus.Signed,
          },
        }
      );
      updateOps.push(pdfPath);
      return pdfPath;
    } catch (err) {
      console.log("Processing error:", err);
    }
  });

  await Promise.all(tasks);
  return updateOps;
};
