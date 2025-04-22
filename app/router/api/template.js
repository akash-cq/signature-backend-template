import { Router } from "express";
import { checkLoginStatus } from "../../middleware/checkAuth.js";
import upload from "../../multer/index.js";
import { readTemplate, readtemplateFromDb, setTemplateDb } from "../../controller/Template.js";
import { templateServices } from "../../services/index.js";
import { signStatus, status } from "../../constants/index.js";
import Exceljs from "exceljs";
import mongoose from "mongoose";
const router = Router();
router.get("/", checkLoginStatus, async (req, res, next) => {
  try {
    const data = await readtemplateFromDb(req);
    if (!data || data.length == 0) {
      return res.status(404).json({ error: "data not be found" });
    }
    let finalData = data.map((obj) => {
      const presentData = obj.data.filter(
        (element) => element.status !== status.deleted
      );
      const rejectCount = obj.data.reduce((count, element) => {
        return element.signStatus === signStatus.rejected ? count + 1 : count;
      }, 0);
      if (presentData.length != 0 && rejectCount == presentData.length) {
        obj.signStatus = signStatus.rejected;
      }
      return {
        ...obj,
        DocCount: presentData.length,
        rejectCount: rejectCount,
      };
    });

    res.json(finalData);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", checkLoginStatus, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "id is not given" });
    }
    const template = await templateServices.findOne({
      id: id,
      status: [status.active,status.pending]
    });
    if (!template) {
      return res.status(404).json({ error: "data not found" });
    }
    if (
      template.createdBy != req.session.userId &&
      template.assignedTo != req.session.userId
    ) {
      return res.status(401).json({ error: "not authorized" });
    }

    const finaldata = template?.data
      .filter((obj) => obj.status != status.deleted)
      .map((obj) => {
        const object = {
          ...obj.data,
          id: obj.id,
          signStatus: obj.signStatus,
          signedDate: obj.signedDate,
          rejectionReason: obj.rejectionReason,
          url:obj.url
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
      delegatedTo:template.delegatedTo
    };
    return res.json({ finaldata, placeholder, url, metadata });
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
      for (let i = 0; i < placeholder.length; i++) {
        if (placeholder[i].includes(" ") && !placeholder[i].includes("IMAGE Signature()"))
          return res
            .status(400)
            .json({ error: "placeholder have spaces it must be without trim" });
      }
      if (placeholder == null || placeholder.length <= 0)
        return res.status(400).json({ error: "no placeholder found" });
      if (
        !placeholder.includes("IMAGE Signature()") ||
        !placeholder.includes("QR_Code")
      ) {
        return res.status(400).json({
          error:
            "no {IMAGE Signature()} or {QR_Code} placeholder found please insert these also",
        });
      }
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
      return res.json({ data: data });
    } catch (error) {
      next(error);
    }
  }
);

router.patch("/:id", checkLoginStatus, async (req, res, next) => {
  try {
    const id = req.params.id;
    const template = await templateServices.findOne(
      { id: id, status: status.active },
      {},
      {}
    );
    if (!template) {
      return res.status(404).json({ error: "template Request Not found" });
    }
    if (template.createdBy != req.session.userId) {
      return res.status(401).json({ error: "not authorized" });
    }
    if (template.signStatus != signStatus.unsigned) {
      return res.status(400).json({
        error: "under signing process after completion of this upload",
      });
    }
    const keys = Object.keys(req.body[0]);
    const placeholder = template.templateVariables
      .filter((obj) => obj.showOnExcel)
      .map((obj) => obj.name);

    const missingKeys = placeholder.filter((header) => !keys.includes(header));

    if (missingKeys.length > 0) {
      return res
        .status(400)
        .json({ error: "template placeholder not found in this excel sheet" });
    }

    const formattedData = req.body.map((row) => ({
      id: new mongoose.Types.ObjectId(),
      data: new Map(Object.entries(row)),
      signStatus: signStatus.unsigned,
      url:null,
      signedDate:null
    }));

    const d = await templateServices.updateOne(
      { id: id, status: status.active },
      { $push: { data: { $each: formattedData } } },
      { new: true }
    );
    const data = d.data;
    res.json({ formattedData, data });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", checkLoginStatus, async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = await templateServices.findOne(
      { id: id, status: status.active,signStatus:signStatus.unsigned },
      {},
      {}
    );
    if (!data) {
      return res.status(404).json({ error: "Request Not Found" });
    }
    if (data.createdBy != req.session.userId) {
      return res.status(401).json({ error: "not authorized" });
    }
    await templateServices.updateOne(
      { id: id },
      {
        $set: { status: status.deleted, updatedBy: req.session.userId },
      }
    );
    return res.json({ id: data.id });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.post("/assign", checkLoginStatus, async (req, res, next) => {
  try {
    const { selectedOfficer = "", Request = {} } = req.body;
    if (!selectedOfficer) {
      return res.status(400).json({ msg: "officer is Not Selected" });
    }
    if (!Request) {
      return res.status(400).json({ msg: "request meta deta not found" });
    }
    await templateServices.updateOne(
      {
        id: Request.id,
        status: status.active,
        createdBy: req.session.userId,
        signStatus: signStatus.unsigned,
      },
      {
        $set: {
          assignedTo: selectedOfficer,
          updatedBy: req.session.userId,
          signStatus: signStatus.readyForSign,
        },
      }
    );
         
    res.json(signStatus.readyForSign);
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.delete(
  "/entry/:templateId/:id",
  checkLoginStatus,
  async (req, res, next) => {
    try {
      const { id, templateId } = req.params;
      const data = await templateServices.findOne(
        { id: templateId, status: status.active,signStatus:signStatus.unsigned},
        {},
        {}
      );
      if (!data) {
        return res.status(404).json({ error: "Request Not Found" });
      }
      await templateServices.updateOne(
        { id: templateId, "data.id": id },
        {
          $set: {
            "data.$.status": status.deleted,
            updatedBy: req.session.userId,
          },
        }
      );
      return res.json({ id: data.id });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
);

router.get("/route/:templateId", async (req, res) => {
  try {
    const { templateId, id } = req.params;
    await templateServices.update(
      {
        id: templateId,
        "data.signStatus": -1,
      },
      {
        $set: { "data.$.signStatus": -2 },
      },
      { multi: true }
    );
    res.json({ msg: "success" });
  } catch (error) {}
});

router.get("/download/:id", checkLoginStatus, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "id is not given" });
    }
    const data = await templateServices.findOne(
      { id: id, status: status.active },
      { templateVariables: 1, templateName: 1 },
      {}
    );
    if (!data || data.length == 0) {
      return res.status.json({ error: "no placeholder found" });
    }
    const placeholder = data.templateVariables
      .filter((obj) => obj.showOnExcel)
      .map((obj) => obj.name);
    if (placeholder.length == 0) {
      return res.status.json({ error: "no placeholder found" });
    }
    const workbook = new Exceljs.Workbook();
    const worksheet = workbook.addWorksheet(data.templateName);
    worksheet.addRow(placeholder);
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns = placeholder.map(() => ({ width: 20 }));
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=headers-only.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.post("/reject", checkLoginStatus, async (req, res, next) => {
  try {
    const { rejection = "", Detail = {}, templateId = "" } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: "request id is not given" });
    }
    if (rejection.trim() == "") {
      return res.status(400).json({ error: "please provide the reason" });
    }
    if (Object.keys(Detail).length == 0) {
      return res
        .status(400)
        .json({ error: "no detail provided of the rejected document" });
    }
    const { id } = Detail;
    if (!id) {
      return res.status(400).json({ error: "data id is not given" });
    }
    const datatemplate = await templateServices.updateOne(
      {
        id: templateId,
        assignedTo: req.session.userId,
        "data.id": id,
        status:status.active,
        signStatus:signStatus.readyForSign
      },
      {
        $set: {
          "data.$.signStatus": signStatus.rejected,
          "data.$.rejectionReason": rejection,
          updatedBy: req.session.userId,
        },
      },
      {
        new: true,
      }
    );

    const finaldata = datatemplate?.data
      .filter((obj) => obj.status != status.deleted)
      .map((obj) => {
        const object = {
          ...obj.data,
          id: obj.id,
          signStatus: obj.signStatus,
          signedDate: obj?.signedDate,
          rejectionReason: obj?.rejectionReason,
        };
        return object;
      });
    return res.json({ finaldata });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.post("/clone", checkLoginStatus, async (req, res, next) => {
  try {
    const { id = "", templateName = "", description = "", url = "" } = req.body;
    if (!id && !templateName && !description && !url) {
      return res
        .status(400)
        .json({ error: "no data is provided for the clone" });
    }
    const data = await templateServices.findOne({ id: id });
    if (!data) {
      return res.status(404).json({ error: "data is not found in database" });
    }
    const templateVeriables = data.templateVariables.map((obj) => obj.name);
    const newTemplate = await setTemplateDb(
      {
        templateName: templateName,
        description: description,
        url: url,
      },
      req,
      templateVeriables
    );
    return res.json({ data: newTemplate });
  } catch (error) {
    console.log(error);
    next(error);
  }
});
router.post("/delegated", checkLoginStatus, async (req, res, next) => {
  try {
    const { userId } = req.session;
    const { delegationReason = "", createdBy, id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Request id not given" });
    }
    if (delegationReason == "") {
      return res.status(400).json({ error: "delegation Reason is not given" });
    }
   const data = await templateServices.updateOne(
     {
       id: id,
       signStatus: signStatus.readyForSign,
       assignedTo: userId,
       createdBy: createdBy,
       status:status.active
     },
     {
       $set: {
         delegationReason: delegationReason,
         delegatedTo: createdBy,
         signStatus: signStatus.delegated,
         "data.$[elem].signStatus": signStatus.delegated,
       },
     },
     {
       new: true,
       arrayFilters: [
         {
           "elem.signStatus": {
             $in: [signStatus.delegated, signStatus.readyForSign],
           },
         },
       ],
     }
   );

    if (!data) {
      return res.status(501).json({ error: "something wrong" });
    }
    return res.json(data);
  } catch (error) {
    console.log(error);
    next(error);
  }
});
export default router;
