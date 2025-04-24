import { createReport } from "docx-templates";
import { dispatchServices } from "../services/index.js";
import * as fs from "fs";
import mongoose from "mongoose";

export const MakeDispatch = async (data) => {
    const content = fs.promises.readFile(
      "E:/Signature/signature-backend-template/pdfMergerData/DISPATCH.docx"
    );
  const buffer = await createReport({
    template: content,
    data: data,
    cmdDelimiter: ["{", "}"],
  });

  return buffer;
};
export const dispatchCreation = async (data) => {
  const dispatchScehma = {};
  dispatchScehma.index = data.index;
  dispatchScehma.courtId = data.courtId;
  dispatchScehma.dataId = new mongoose.Types.ObjectId();
  dispatchScehma.templateId = data.templateId;
  const d = await dispatchServices.save(dispatchScehma);
  return d;
};
