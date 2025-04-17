import { Router } from "express";
import { checkLoginStatus } from "../../middleware/checkAuth.js";
import { signatureServices, templateServices } from "../../services/index.js";
import { status } from "../../constants/index.js";

const router = Router();

router.get("/", checkLoginStatus, async (req, res, next) => {
  try {
    const { userId } = req.session;
    const signatureUrls = await signatureServices.find({
      userId: userId,   
      status: status.active,
    },{url:1,id:1,CreatedAt:1,updatedAt:1,status:1});
    res.json(signatureUrls);
  } catch (error) {
    next(error);
  }
});
router.post('/',checkLoginStatus,async (req,res,next) => {
  try {
      // console.log(req.body);
      const {id} = req.body;
      const data = await templateServices.findOne({id:id,status:status.active,assignedTo:req.session.userId});
      if(!data){
        return res.status(404).json({error:"data not foun or maybe you'r not authorized"})
      }
      return res.json("success");
  } catch (error) {
    console.log(error);
    next(error);
  }
})
export default router;
