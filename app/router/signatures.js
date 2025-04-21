import {Router} from 'express';
import { checkLoginStatus } from '../middleware/checkAuth.js';
import SignatureUpload from '../multer/signature.js';
import mongoose from 'mongoose';
import { status } from '../constants/index.js';
import { signatureServices } from '../services/index.js';

const router = Router();

router.post(
  "/",
  checkLoginStatus,
  SignatureUpload.single("signature"),
  async (req, res, next) => {
    try {
      console.log("hello");
      const {path} = req.file;
      const filePath = path.replace(/\\/g,'/');
      const Signaturecreation = {
        id: new mongoose.Types.ObjectId(),
        userId:req.session.userId,
        url:filePath,
        status:status.active,
        createdBy:req.session.userId,
        updatedBy:req.session.userId,
      }
     const data =  await signatureServices.save(Signaturecreation);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);
router.delete('/:signatureId',checkLoginStatus,async (req,res,next)=>{
    try {
        const {signatureId} = req.params;
        if(!signatureId){
            return res.status(400).json({error:'Signature Id is not given'})
        }
        const data = await signatureServices.updateOne(
          {
            id: signatureId,
            status: status.active,
            createdBy: req.session.userId,
          },
          {
            $set: {
              status: status.deleted,
              deletedBy:req.session.userId,
              updatedBy:req.session.userId
            },
          },
          {
            new: true,
          }
        );
        if(!data){
            return res.status(404).json({error:'no Signature found'})
        }
        return res.json({msg:'success'});
    } catch (error) {
        console.log(error)
        next(error)
    }
})
export default router;