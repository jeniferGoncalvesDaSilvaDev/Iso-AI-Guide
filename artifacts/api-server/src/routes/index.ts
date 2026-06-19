import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companiesRouter from "./companies";
import standardsRouter from "./standards";
import diagnosticsRouter from "./diagnostics";
import documentsRouter from "./documents";
import chatRouter from "./chat";
import dashboardRouter from "./dashboard";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(standardsRouter);
router.use(diagnosticsRouter);
router.use(documentsRouter);
router.use(chatRouter);
router.use(dashboardRouter);
router.use(auditRouter);

export default router;
