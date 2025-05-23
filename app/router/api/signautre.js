import { Router } from "express";
import { checkLoginStatus } from "../../middleware/checkAuth.js";
import { signatureServices, templateServices } from "../../services/index.js";
import { signStatus, status } from "../../constants/index.js";
import { startSign } from "../../controller/FillTemplates.js";

const router = Router();

router.get("/", checkLoginStatus, async (req, res, next) => {
  try {
    const { userId } = req.session;
    if(!userId){
      return res.status(400).json({error:'user id is not provided'});
    }
    const signatureUrls = await signatureServices.find(
      {
        userId: userId,
        status: status.active,
      },
      { url: 1, id: 1, CreatedAt: 1, updatedAt: 1, status: 1 }
    );
    res.json(signatureUrls);
  } catch (error) {
    next(error);
  }
});
router.post("/otp", checkLoginStatus, async (req, res, next) => {
  try {
    console.log(req.body);
    const { id } = req.body;
    if(!id){
      return res.status(400).json({error:'id is not provided'});
    }
    const data = await templateServices.findOne({
      $and: [
        {
          id: id,
          status: status.active,
        },
        {
          $or: [
            { assignedTo: req.session.userId },
            { delegatedTo: req.session.userId },
          ],
        },
      ],
    });
    if (!data) {
      return res
        .status(404)
        .json({ error: "data not found or maybe you'r not authorized" });
    }
    return res.json("success");
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.post("/verify", checkLoginStatus, async (req, res, next) => {
  try {
    console.log(req.body);
    const {otp = null} = req.body
    if(!otp){
      return res.status(400).json({error:"otp is empty"})
    }
    if(otp.length!=4){
      return res.status(400).json({error:'otp have not excat 4 values'})
    }
    return res.json({ msg: "verfied" });
  } catch (error) {
    console.log(error);
    next(error);
  }
});
router.post("/Signed", async (req, res, next) => {
  try {
    const { SignatureId, templateId } = req.body;
    console.log(req.body,"sfdgdfgjh");
    const signature = await signatureServices.findOne({
      id: SignatureId,
      status: status.active,
    });
    const { userId } = req.session;
    if (!signature) {
      return res.status(404).json({ error: "Signature not found" });
    }
    const templateData = await templateServices.findOne({
      id: templateId,
      status: status.active,
      signStatus: { $in: [signStatus.delegated, signStatus.readyForSign] },
    });
    if (!templateData) {
      return res.status(404).json({ error: "Request not found" });
    }
    if (templateData.delegatedTo && templateData.delegatedTo != userId) {
      return res.status(401).json({ error: "not authorized" });
    }
    if (!templateData.delegatedTo && templateData.assignedTo != userId) {
      return res.status(401).json({ error: "not authorized" });
    }
    templateData.signStatus = signStatus.inProcess;
    templateData.status = status.pending;
  await templateServices.updateOne(
    {
      id: templateId,
      status: status.active,
    },
    {
      $set: {
        status: status.pending,
        signStatus: signStatus.inProcess,
        "data.$[item].signStatus": signStatus.inProcess,
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

    res.json({ msg: "success" });
    startSign([templateData, signature, userId]);
  } catch (error) {
    console.log(error);
    next(error);
  }
});
export default router;
