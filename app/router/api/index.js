import { Router } from 'express';
import courtApi from './court.js';
import userApi from './user.js';
import signatureApi from './signautre.js';
import templateApi from './template.js';
import dispatchApi from './dispatch.js'
let router = Router();
router.use('/courts', courtApi);
router.use('/users', userApi);
router.use('/signatures', signatureApi);
router.use('/templates', templateApi);
router.use("/disptach", dispatchApi);

export default router;