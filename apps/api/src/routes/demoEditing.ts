import express, { type Router } from 'express';
import { protect, type AuthenticatedRequest } from '../middleware/auth';
import { DemoRuntimePolicyService } from '../services/demoRuntimePolicyService';
import { DemoEditingService } from '../services/demoEditingService';
import { AppError } from '../utils/errors';

const router: Router = express.Router();

function requireDemoAdmin(req: AuthenticatedRequest): void {
  if (!DemoRuntimePolicyService.isDemoAdmin(req.user)) {
    throw AppError.notFound('Demo editing is unavailable');
  }
}

router.get('/status', protect, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  requireDemoAdmin(authReq);
  res.status(200).json({
    success: true,
    data: await DemoEditingService.status(authReq.authSession.id),
  });
});

router.post('/start', protect, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  requireDemoAdmin(authReq);
  res.status(200).json({
    success: true,
    data: await DemoEditingService.start(authReq.authSession.id),
  });
});

router.post('/finish', protect, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  requireDemoAdmin(authReq);
  res.status(200).json({
    success: true,
    data: await DemoEditingService.finish(authReq.authSession.id),
  });
});

export default router;
