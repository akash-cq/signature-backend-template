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
      },
      {}
    );
    let finalData = data.map((obj) => {
      obj.DocCount = obj.data.length;
      return obj;
    });
    res.json(finalData);
  } catch (error) {
    next(error);
  }
});
router.get('/:id',checkLoginStatus,async (req,res,next) => {
  try {
      const id = req.params.id;
      const data = await templateServices.findOne({id:id});
      console.log(data)
      const finaldata = data?.data.map((obj)=>{
        return {
          ...obj.data
        }
      })
      return res.json(finaldata)
  } catch (error) {
    next(error)
  }
})
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
    const template = await templateServices.findOne({ id: id }, {}, {});
    console.log(template);
    const data = req.body;
    const keys = Object.keys(data[0]);
    const placeholder = template.templateVariables.map((obj) => {
      if (obj.showOnExcel == true) return obj.name;
    });
    const missingKeys = placeholder.filter((header) => !keys.includes(header));
    if (missingKeys.length > 0) {
      throw new Error(`this excel file have some placeholder which are not in template file`);
    }
    const formattedData = data.map((row) => ({
      id: new mongoose.Types.ObjectId(),
      data: new Map(Object.entries(row)),
      signStatus: signStatus.unsigned,
    }));
    await templateServices.updateOne(
      { id: id }, 
      { $push: { data: { $each: formattedData } } } 
    );

    res.json({ msg: "success" });
  } catch (error) {
    next(error);
  }
});
export default router;
