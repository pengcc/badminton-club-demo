import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User';
import { Player } from '../models/Player';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserRole } from '@club/shared-types/core/enums';
import { AppError } from '../utils/errors';
import { ResponseHelper } from '../utils/controllerHelpers';
import { PlayerService } from '../services/playerService';
import { UserService } from '../services/userService';
import { Api } from '@club/shared-types/api/user';
import { UserPersistenceTransformer, UserApiTransformer } from '../transformers/user';

export class UserController {
  /**
   * Create new user (admin only)
   */
  static async createUser(req: AuthenticatedRequest<Api.CreateUserRequest>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firstName, lastName, email, gender, dateOfBirth, role, isPlayer } = req.body;

      // Ensure admin can't create other admin accounts without permission
      if (role === UserRole.ADMIN && req.user.role !== UserRole.ADMIN) {
        throw new AppError('Only admins can create other admin accounts', 403);
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new AppError('User already exists with this email', 400);
      }

      // Validate required fields
      if (!firstName || !lastName) {
        throw new AppError('firstName and lastName are required', 400);
      }

      // Create user with validated data
      const userData = {
        firstName,
        lastName,
        email: email.toLowerCase(),
        password: Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10),
        gender,
        dateOfBirth,
        role,
        isPlayer: isPlayer || false
      };

      // Create user
      const user = await User.create(userData);

      // Create Player entity if isPlayer is true using UserService
      if (isPlayer) {
        try {
          await UserService.createPlayerEntity(user._id as any);
        } catch (playerError: any) {
          // If Player creation fails, delete the created User to maintain consistency
          await User.findByIdAndDelete(user._id);
          throw new AppError(
            `User created but Player entity creation failed: ${playerError.message}`,
            500
          );
        }
      }

      // Transform to API response
      const domainUser = UserPersistenceTransformer.toDomain(user as any);
      const apiResponse = UserApiTransformer.toApi(domainUser);

      res.status(201).json({
        success: true,
        data: apiResponse
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all users with filtering and pagination
   */
  static async getAllUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const {
      page = 1,
      limit = 10,
      sort = 'lastName',
      order = 'asc',
      search,
      role,
      membershipStatus,
      isPlayer
    } = req.query as any;

    // Build filter query
    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }
    if (role) filter.role = role;
    if (membershipStatus) filter.membershipStatus = membershipStatus;
    if (typeof isPlayer === 'boolean') {
      filter.isPlayer = isPlayer;
    }

    // Execute paginated query
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sort]: order })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      User.countDocuments(filter)
    ]);

    // Transform to API responses
    const apiUsers = users.map(user => {
      const domainUser = UserPersistenceTransformer.toDomain(user as any);
      return UserApiTransformer.toApi(domainUser);
    });

    ResponseHelper.success(res, {
      data: apiUsers,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    });
  }

  /**
   * Get single user by ID
   */
  static async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user has permission to view
    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.id !== user.id
    ) {
      throw new AppError('Not authorized to view this user', 403);
    }

    const domainUser = UserPersistenceTransformer.toDomain(user as any);
    const apiResponse = UserApiTransformer.toApi(domainUser);
    ResponseHelper.success(res, apiResponse);
  }

  /**
   * Update user information
   */
  static async updateUser(
    req: AuthenticatedRequest<Api.UpdateUserRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Prevent role escalation
      if (
        req.body.role &&
        req.body.role !== user.role &&
        req.user.role !== UserRole.ADMIN
      ) {
        throw new AppError('Not authorized to change user role', 403);
      }

      // Track if isPlayer status is changing
      const wasPlayer = user.isPlayer;
      const willBePlayer = req.body.isPlayer !== undefined ? req.body.isPlayer : wasPlayer;
      const isPlayerChanging = wasPlayer !== willBePlayer;

      // Update user
      Object.assign(user, req.body);
      await user.save();

      // Handle Player entity synchronization if isPlayer status changed
      if (isPlayerChanging) {
        if (willBePlayer && !wasPlayer) {
          // Enabling player status - create Player entity using UserService
          try {
            await UserService.createPlayerEntity(user._id as any);
          } catch (playerError: any) {
            // If Player creation fails, revert user.isPlayer
            user.isPlayer = wasPlayer;
            await user.save();
            throw new AppError(
              `Failed to create Player entity: ${playerError.message}`,
              500
            );
          }
        } else if (!willBePlayer && wasPlayer) {
          // Disabling player status - hard delete Player entity using UserService
          try {
            await UserService.deletePlayerEntity(user._id as any);
          } catch (playerError: any) {
            // Log error but don't fail the user update
            console.error(`Failed to delete Player entity for user ${user._id}:`, playerError.message);
          }
        }
      }

      const domainUser = UserPersistenceTransformer.toDomain(user as any);
      const apiResponse = UserApiTransformer.toApi(domainUser);
      ResponseHelper.success(res, apiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Prevent admin deletion by non-admin
      if (user.role === UserRole.ADMIN && req.user.role !== UserRole.ADMIN) {
        throw new AppError('Not authorized to delete admin', 403);
      }

      // Delete associated Player entity if user is a player
      if (user.isPlayer) {
        try {
          console.log('Deleting Player entity for user:', user._id);
          await UserService.deletePlayerEntity(user._id as any);
        } catch (playerError: any) {
          // Log error but continue with user deletion
          console.error(`Failed to delete Player entity for user ${user._id}:`, playerError.message);
        }
      }

      await user.deleteOne();
      ResponseHelper.success(res, null, 'User successfully deleted');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update player status
   * TODO: Phase 2 - Integrate with Player service when available
   */
  static async updatePlayerStatus(
    req: AuthenticatedRequest<{ isPlayer: boolean }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { isPlayer } = req.body;
      const user = await User.findById(req.params.id);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Update isPlayer flag
      user.isPlayer = isPlayer;
      await user.save();

      const domainUser = UserPersistenceTransformer.toDomain(user as any);
      const apiResponse = UserApiTransformer.toApi(domainUser);
      ResponseHelper.success(res, apiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get users with filters (admin only)
   * @route GET /api/users/filter
   * @access Private/Admin
   */
  static async getUsersWithFilters(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { role, isMatchPlayer, membershipStatus, page = 1, limit = 10 } = req.query;

      // Build filter object
      const filter: any = {};

      if (role) filter.role = role;
      if (isMatchPlayer !== undefined) filter.isMatchPlayer = isMatchPlayer === 'true';
      if (membershipStatus) filter.membershipStatus = membershipStatus;

      // Pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const users = await User.find(filter)
        .select('-password')
        .skip(skip)
        .limit(parseInt(limit as string))
        .sort({ createdAt: -1 });

      const total = await User.countDocuments(filter);

      // Transform users to API format
      const apiUsers = users.map(user => {
        const domainUser = UserPersistenceTransformer.toDomain(user as any);
        return UserApiTransformer.toApi(domainUser);
      });

      res.status(200).json({
        success: true,
        count: apiUsers.length,
        total,
        page: parseInt(page as string),
        pages: Math.ceil(total / parseInt(limit as string)),
        data: apiUsers
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Batch update users (admin only)
   * @route PATCH /api/users/batch
   * @access Private/Admin
   */
  static async batchUpdateUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userIds, updateData } = req.body;

      console.log('Batch update request:', { userIds, updateData }); // Debug log

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'User IDs array is required and must not be empty'
        });
        return;
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'Update data is required'
        });
        return;
      }

      // Validate update data - only allow specific fields
      const allowedFields = ['membershipStatus', 'isPlayer', 'role'];
      const filteredUpdateData: any = {};

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          filteredUpdateData[key] = value;
        }
      }

      console.log('Filtered update data:', filteredUpdateData); // Debug log

      if (Object.keys(filteredUpdateData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
        return;
      }

      // Handle isPlayer changes - need to sync with Player model
      const isPlayerChanged = 'isPlayer' in filteredUpdateData;
      const playerSyncErrors: string[] = [];

      if (isPlayerChanged) {
        const newIsPlayerValue = filteredUpdateData.isPlayer;
        console.log('isPlayer changed to:', newIsPlayerValue); // Debug log

        // Get users to determine who needs Player changes
        const usersToUpdate = await User.find({ _id: { $in: userIds } });
        const usersToAddPlayer: string[] = [];
        const usersToRemovePlayer: string[] = [];

        for (const user of usersToUpdate) {
          const wasPlayer = user.isPlayer;
          const willBePlayer = newIsPlayerValue;

          if (willBePlayer && !wasPlayer) {
            usersToAddPlayer.push((user._id as any).toString());
          } else if (!willBePlayer && wasPlayer) {
            usersToRemovePlayer.push((user._id as any).toString());
          }
        }

        // Batch create Players using UserService
        if (usersToAddPlayer.length > 0) {
          try {
            await UserService.batchCreatePlayers(usersToAddPlayer);
          } catch (error: any) {
            playerSyncErrors.push(`Batch create failed: ${error.message}`);
          }
        }

        // Batch delete Players using UserService
        if (usersToRemovePlayer.length > 0) {
          const deleteErrors = await UserService.batchDeletePlayers(usersToRemovePlayer);
          playerSyncErrors.push(...deleteErrors);
        }
      }

      // Perform batch update on users
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: filteredUpdateData },
        { runValidators: true }
      );

      console.log('User update result:', result); // Debug log

      // Get updated users and transform them
      const updatedUsers = await User.find(
        { _id: { $in: userIds } }
      ).select('-password');

      // Transform users to API format
      const apiUsers = updatedUsers.map(user => {
        const domainUser = UserPersistenceTransformer.toDomain(user as any);
        return UserApiTransformer.toApi(domainUser);
      });

      const responseData: any = {
        success: true,
        message: `Successfully updated ${result.modifiedCount} users${isPlayerChanged ? ' and synchronized player records' : ''}`,
        data: {
          modifiedCount: result.modifiedCount,
          users: apiUsers,
          playersSynchronized: isPlayerChanged
        }
      };

      // Include player sync errors if any occurred
      if (playerSyncErrors.length > 0) {
        responseData.warnings = {
          playerSyncErrors,
          message: `${playerSyncErrors.length} player synchronization errors occurred`
        };
      }

      res.status(200).json(responseData);
    } catch (error: any) {
      console.error('Batch update error:', error); // Debug log
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((val: any) => val.message);
        res.status(400).json({
          success: false,
          message: messages.join(', ')
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * PATCH /users/:id/player-status
   * Toggle user's player status and manage Player entity lifecycle
   * Admin only
   */
  static async togglePlayerStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isPlayer } = req.body;

      if (typeof isPlayer !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'isPlayer field is required and must be boolean'
        });
        return;
      }

      // Import UserService here to avoid circular dependencies
      const { UserService } = await import('../services/userService.js');

      // Use UserService to handle Player lifecycle
      const updatedUser = await UserService.setPlayerStatus(id, isPlayer);

      // Transform to API response
      const domainUser = UserPersistenceTransformer.toDomain(updatedUser as any);
      const apiResponse = UserApiTransformer.toApi(domainUser);

      res.status(200).json({
        success: true,
        data: apiResponse,
        message: isPlayer
          ? 'User promoted to player successfully'
          : 'User player status removed successfully'
      });
    } catch (error: any) {
      console.error('Toggle player status error:', error);

      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message
      });
    }
  }
}