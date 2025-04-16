import mongoose from "mongoose";
import { templateCretionSchema } from "../schema/template.js";
import { templateServices } from "../services/index.js";
import WordExtractor from "word-extractor";
import * as path from "path";
export const readTemplate = async (file) => {
  try {
    const extracter = new WordExtractor();
    const extracted = extracter.extract(
      path.join(`E:/Signature/signature-backend-template`, `/${file}`)
    );
    let data = null;
    await extracted
    .then(function(doc){
      data = doc.getBody();
    })
    data = data.trim();
    console.log(data)
    const placeholders = [...data.matchAll(/{(.*?)}/g)].map((m) => m[1]);

    return placeholders;
  } catch (error) {
    console.log(error);
    throw new Error("internal error");
  }
}

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
    templateCreation.templateVariables = placeholder.map((name)=>{
      let obj = {
        name:name,
        required:true,
        showOnExcel:true,
      }
      if(name=='Signature')obj.showOnExcel = false;
      if(name=='QR Code'){
        obj.required=false;
        obj.showOnExcel = false;
      }
      return obj;
    })
    console.log(templateCreation, " templateCreation");
    const obj = await templateServices.save(templateCreation);
    return obj;
  } catch (error) {
    console.log(error);
    throw new Error("something wrong");
  }
};
