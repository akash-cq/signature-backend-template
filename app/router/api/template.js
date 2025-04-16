import { Router } from "express";
import { checkLoginStatus } from "../../middleware/checkAuth.js";
import upload from "../../multer/index.js";
import { readTemplate, setTemplateDb } from "../../controller/Template.js";
import { templateServices } from "../../services/index.js";
import { signStatus, status } from "../../constants/index.js";
import mongoose from "mongoose";
const router = Router();

router.get("/", checkLoginStatus, async (req, res, next) => {
  try {
    let data = await templateServices.find(
      {
        $and: [
          {
            $or: [
              { assignedTo: req.session.userId },
              { createdBy: req.session.userId },
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
        createdBy:1,
      },
      {}
    );
    let finalData = data.map((obj) => {
      obj.DocCount = obj.data.length;
      obj.rejectCount = 0;
      let count = 0;
      for (let i = 0; i < obj.length; i++) {
        if (obj[i].signStatus == signStatus.rejected) count++;
      }
      obj.rejectCount = count;
      return obj;
    });
    res.json(finalData);
  } catch (error) {
    next(error);
  }
});
router.get("/:id", checkLoginStatus, async (req, res, next) => {
  try {
    const id = req.params.id;
    const template = await templateServices.findOne({ id: id ,status:status.active});
    const finaldata = template?.data.map((obj) => {
      const object = {
        ...obj.data,
      };
      object.signStatus = obj.signStatus;
      object.signedDate = obj.signedDate;
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
    };
    return res.json({ finaldata, placeholder, url,metadata });
  } catch (error) {
    next(error);
  }
});
router.post(
  "/",
  checkLoginStatus,
  upload.single("template"),
  async (req, res, next) => {
    try {
      const { name, description } = req.body;
      const { path } = req.file;
      const url = path.replace(/\\/g, "/");
      const placeholder = await readTemplate(url);
      console.log(placeholder, "drfv");
      if (!placeholder) return res.status(400).json({ msg: "waigt" });
      const data = await setTemplateDb(
        {
          templateName: name,
          description: description,
          url: url,
        },
        req,
        placeholder
      );
      if (!data) return res.status(404).json({ msg: "something wrong" });
      console.log(data);
      return res.json({ data: data });
    } catch (error) {
      next(error);
    }
  }
);
router.patch("/:id", checkLoginStatus, async (req, res, next) => {
  try {
    const id = req.params.id;
    const template = await templateServices.findOne({ id: id,status:status.active }, {}, {});
    if(!template){
      return res.status(404).json({error:'template Request Not found'})
    }
    const keys = Object.keys(req.body[0]);
    const placeholder = [];
    template.templateVariables.forEach((obj) => {
      if (obj.showOnExcel == true) return placeholder.push(obj.name);
    });

    const missingKeys = placeholder.filter((header) => !keys.includes(header));
    if (missingKeys.length > 0) {
      return res.status(400).json({error:'template placeholder not found in this excel sheet'})
    }
    const formattedData = req.body.map((row) => ({
      id: new mongoose.Types.ObjectId(),
      data: new Map(Object.entries(row)),
      signStatus: signStatus.unsigned,
    }));
    await templateServices.updateOne(
      { id: id ,status:status.active},
      { $push: { data: { $each: formattedData } } }
    );

    res.json({msg:'success'});
  } catch (error) {
    next(error);
  }
});
router.delete('/:id',checkLoginStatus,async (req,res,next) => {
  try {
      const id = req.params.id;
      const data = await templateServices.findOne({id:id,status:status.active},{},{});
      if(!data){
        return res.status(404).json({error:'Request Not Found'})
      }
      await templateServices.updateOne({id:id},{
        $set:{status:status.deleted}
      })
      return res.json({ id: data.id });
  } catch (error) {
    console.log(error)
    next(error)
  }
})
router.post('/assign',checkLoginStatus,async (req,res,next) => {
  try {
      console.log(req.body)
      const {selectedOfficer = '',Request={}} = req.body
      if(!selectedOfficer){
        return res.status(400).json({msg:'officer is Not Selected'});
      }
      if(!Request){
        return res.status(400).json({msg:'request meta deta not found'});
      }
      await templateServices.updateOne(
        {
          id: Request.id,
          status: status.active,
        },
        {
          $set: {
            assignedTo: selectedOfficer,
            updatedBy:req.session.userId,
            signStatus:signStatus.readyForSign,
          },
        }
      );
      res.json(signStatus.readyForSign);
  } catch (error) {
      console.log(error);
      next(error)
  }
})
export default router;
