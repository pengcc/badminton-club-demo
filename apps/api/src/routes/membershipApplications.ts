import express, { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { MembershipApplicationController } from '../controllers/membershipApplicationController';
import { ADMIN_ROLES } from '../utils/roles';

const router: Router = express.Router();

// Submit a new membership application (public route)
router.post('/applications', MembershipApplicationController.createApplication as any);

// Get application statistics (admin only)
router.get('/applications/stats', protect, authorize(ADMIN_ROLES), MembershipApplicationController.getApplicationStats as any);

// Get pending applications (admin only)
router.get('/applications/pending', protect, authorize(ADMIN_ROLES), MembershipApplicationController.getPendingApplications as any);

// Get all membership applications (admin only)
router.get('/applications', protect, authorize(ADMIN_ROLES), MembershipApplicationController.getAllApplications as any);

// Get a specific membership application (admin only)
router.get('/applications/:id', protect, authorize(ADMIN_ROLES), MembershipApplicationController.getApplicationById as any);

// Update application (admin only)
router.patch('/applications/:id', protect, authorize(ADMIN_ROLES), MembershipApplicationController.updateApplication as any);

// Approve application (admin only)
router.post('/applications/:id/approve', protect, authorize(ADMIN_ROLES), MembershipApplicationController.approveApplication as any);

// Reject application (admin only)
router.post('/applications/:id/reject', protect, authorize(ADMIN_ROLES), MembershipApplicationController.rejectApplication as any);

// Delete/deactivate membership application (admin only)
router.delete('/applications/:id', protect, authorize(ADMIN_ROLES), MembershipApplicationController.deleteApplication as any);

export default router;