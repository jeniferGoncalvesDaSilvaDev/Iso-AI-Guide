import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companiesRouter from "./companies";
import standardsRouter from "./standards";
import diagnosticsRouter from "./diagnostics";
import documentsRouter from "./documents";
import documentMatrixRouter from "./document-matrix";
import exportRouter from "./export";
import chatRouter from "./chat";
import dashboardRouter from "./dashboard";
import auditRouter from "./audit";
import recommendationsRouter from "./recommendations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(standardsRouter);
router.use(diagnosticsRouter);
router.use(documentsRouter);
router.use(documentMatrixRouter);
router.use(exportRouter);
router.use(chatRouter);
router.use(dashboardRouter);
router.use(auditRouter);
router.use(recommendationsRouter);

export default router;
