import { Router } from "express";
import authRouter from "./auth.js";
import transcriptionsRouter from "./transcriptions.js";

const router = Router();
router.use("/", authRouter);
router.use("/", transcriptionsRouter);

export default router;
