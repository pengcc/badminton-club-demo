import express, { Router } from 'express';
import { UserController } from '../controllers/userController';
import { protect, authorize, authorizeOwner, AuthenticatedRequest } from '../middleware/auth';
import { ADMIN_ROLES } from '../utils/roles';
import { asyncHandler } from '../utils/controllerHelpers';
import { UserRole } from '@club/shared-types/core/enums';

const router: Router = express.Router();

// Create new user (admin only)
router.post('/',
  protect,
  authorize(ADMIN_ROLES),
  (UserController.createUser as any)
);

// Batch update users (admin only)
router.patch('/batch',
  protect,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await UserController.batchUpdateUsers(req, res);
  })
);

// Get users with filters (admin only)
router.get('/filter',
  protect,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await UserController.getUsersWithFilters(req, res);
  })
);

// Get all users (admin only)
router.get('/',
  protect,
  authorize(ADMIN_ROLES),
  (UserController.getAllUsers as any)
);

// Get single user
router.get('/:id',
  protect,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await UserController.getUserById(req, res);
  })
);

// Update user - only admin or owner can update
router.put('/:id',
  protect,
  authorizeOwner(req => req.params.id),
  (UserController.updateUser as any)
);

// Delete user (admin only)
router.delete('/:id',
  protect,
  authorize(ADMIN_ROLES),
  (UserController.deleteUser as any)
);

// Toggle player status and manage Player entity lifecycle (admin only)
router.patch('/:id/player-status',
  protect,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await UserController.togglePlayerStatus(req, res);
  })
);

export default router;