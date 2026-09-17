import { Router } from 'express';
import { DemoRuntimePolicyService } from '../services/demoRuntimePolicyService';
import { sendSuccess } from '../utils/response';

const router: Router = Router();

router.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { enabled: DemoRuntimePolicyService.enabled() });
});

export default router;
