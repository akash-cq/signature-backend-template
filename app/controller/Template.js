import mongoose from "mongoose";
import { templateCretionSchema } from "../schema/template.js";
import { templateServices } from "../services/index.js";
import WordExtractor from "word-extractor";
import * as path from "path";
import { status } from "../constants/index.js";
export const readTemplate = async (file) => {
  try {
    const extracter = new WordExtractor();
    const extracted = extracter.extract(
      path.join(`E:/Signature/signature-backend-template`, `/${file}`)
    );
    let data = null;
    await extracted.then(function (doc) {
      data = doc.getBody();
    });
    data = data.trim();
    // console.log(data)
    const placeholders = [...data.matchAll(/{(.*?)}/g)].map((m) => m[1]);

    return placeholders;
  } catch (error) {
    console.log(error);
    throw new Error("internal error");
  }
};

export const setTemplateDb = async (payload, req, placeholder) => {
  try {
    const { userId } = req.session;
    const body = await templateCretionSchema.safeParseAsync(payload);
    if (body.error) {
      throw new Error(body.error);
    }
    const templateCreation = body.data;
    templateCreation.id = new mongoose.Types.ObjectId();
    templateCreation.createdBy = userId;
    templateCreation.updatedBy = userId;
    templateCreation.templateVariables = placeholder.map((name) => {
      let obj = {
        name: name,
        required: true,
        showOnExcel: true,
      };
      if (name == "IMAGE Signature()") obj.showOnExcel = false;
      if (name == "QR_Code") {
        obj.required = false;
        obj.showOnExcel = false;
      }
      return obj;
    });
    console.log(templateCreation, " templateCreation");
    const obj = await templateServices.save(templateCreation);
    return obj;
  } catch (error) {
    console.log(error);
    throw new Error("something wrong");
  }
};

export const readtemplateFromDb = async (req) => {
  let data = await templateServices.find(
    {
      $and: [
        {
          $or: [
            { assignedTo: req.session.userId },
            { createdBy: req.session.userId },
            { delegatedTo: req.session.userId },
          ],
        },
        {
          $or: [{ status: status.active }, { status: status.pending }],
        },
      ],
    },
    {
      id: 1,
      url: 1,
      status: 1,
      description: 1,
      templateName: 1,
      assignedTo: 1,
      rejectionReason: 1,
      delegatedTo: 1,
      signStatus: 1,
      createdAt: 1,
      updatedAt: 1,
      data: 1,
      createdBy: 1,
      delegationReason: 1,
      description: 1,
    },
    {}
  );
  return data;
};
export const computation = async (template) => {
  const finaldata = template?.data
    .filter((obj) => obj.status != status.deleted)
    .map((obj) => {
      const object = {
        ...obj.data,
        id: obj.id,
        signStatus: obj.signStatus,
        signedDate: obj.signedDate,
        rejectionReason: obj.rejectionReason,
        url: obj.url,
      };
      return object;
    });
  const placeholder = [];

  template.templateVariables.forEach((obj) => {
    if (obj.showOnExcel == true) return placeholder.push(obj.name);
  });

  const url = template.url;
  const metadata = {
    id: template.id,
    assignedTo: template.assignedTo,
    createdBy: template.createdBy,
    status: template.status,
    signStatus: template.signStatus,
    delegatedTo: template.delegatedTo,
  };
  return [finaldata,placeholder,url,metadata]
};
