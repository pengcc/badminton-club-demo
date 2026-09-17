import { createHash, randomBytes } from 'node:crypto';
import type { IUser } from '../models/User';
import { User } from '../models/User';
import type { Schema } from 'mongoose';
import type { ClientSession } from 'mongoose';
import { AppError } from '../utils/errors';
import { AccountKind } from '@club/shared-types/core/enums';
import type { UpdateUserInput } from '@club/shared-types/schemas/user';

export function digestEmailChangeToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Service for User entity management and Player lifecycle
 */
export class UserService {
  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User document or null
   */
  static async getUserById(
    userId: string | Schema.Types.ObjectId
  ): Promise<IUser | null> {
    return await User.findById(userId);
  }

  /**
   * Get all users
   * @returns Array of user documents
   */
  static async getAllUsers(): Promise<IUser[]> {
    return await User.find();
  }

  /**
   * Update user data (excluding player status)
   * @param userId - User ID to update
   * @param updates - Partial user data to update
   * @returns Updated user document
   */
  static async updatePersonProfile(
    userId: string | Schema.Types.ObjectId,
    updates: UpdateUserInput,
    session?: ClientSession
  ): Promise<IUser> {
    const target = await User.findById(userId).session(session ?? null);
    if (!target) throw AppError.notFound('User not found');
    if (target.accountKind !== AccountKind.PERSON) {
      throw AppError.conflict('Super Admin is not a Person Profile target');
    }

    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    for (const field of [
      'firstName',
      'lastName',
      'gender',
      'dateOfBirth',
    ] as const) {
      if (updates[field] !== undefined) set[field] = updates[field];
    }
    if (updates.phone === null) unset.phone = '';
    else if (updates.phone !== undefined) set.phone = updates.phone;
    if (updates.address === null) unset.address = '';
    else if (updates.address !== undefined) set.address = updates.address;

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      return target;
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        ...(Object.keys(set).length > 0 ? { $set: set } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { new: true, runValidators: true, session }
    );
    if (!updated) throw AppError.notFound('User not found');
    return updated;
  }

  /**
   * Request email change - generates token and stores pending email
   * @param userId - User ID requesting email change
   * @param newEmail - New email address to change to
   * @returns Email change token for verification
   */
  static async requestEmailChange(
    userId: string | Schema.Types.ObjectId,
    newEmail: string,
    locale: 'de' | 'en' | 'zh'
  ): Promise<string> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.accountKind !== AccountKind.PERSON) {
      throw new AppError(
        'The canonical Super Admin email is managed by the operator workflow',
        409
      );
    }

    // Validate new email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(newEmail)) {
      throw new AppError('Invalid email format', 400);
    }

    // Check if new email is same as current
    if (user.email.toLowerCase() === newEmail.toLowerCase()) {
      throw new AppError('New email must be different from current email', 400);
    }

    // Check if new email is already in use by another user
    const existingUser = await User.findOne({
      email: newEmail.toLowerCase(),
      _id: { $ne: userId },
    });
    if (existingUser) {
      throw new AppError('Email already in use', 409);
    }

    // Generate verification token (32 bytes = 64 hex characters)
    const token = randomBytes(32).toString('hex');

    // Set expiration to 1 hour from now
    const expireDate = new Date();
    expireDate.setHours(expireDate.getHours() + 1);

    // Persist only a one-way digest of the bearer credential.
    user.pendingEmail = newEmail.toLowerCase();
    user.pendingEmailLocale = locale;
    user.emailChangeTokenDigest = digestEmailChangeToken(token);
    user.emailChangeExpire = expireDate;
    await user.save();

    console.log(`Email change requested for user ${userId}`);

    return token;
  }

  /**
   * Verify email change token and update email
   * @param token - Email change verification token
   * @returns Object with success status and the old/new email boundary
   */
  static async verifyEmailChange(token: string): Promise<{
    success: boolean;
    oldEmail: string;
    newEmail: string;
    userId: string;
    locale: 'de' | 'en' | 'zh';
  }> {
    const now = new Date();
    const tokenDigest = digestEmailChangeToken(token);
    const user = await User.findOne({
      emailChangeTokenDigest: tokenDigest,
      emailChangeExpire: { $gt: new Date() },
    }).select('+emailChangeTokenDigest');

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }
    if (user.accountKind !== AccountKind.PERSON) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    if (!user.pendingEmail) {
      throw new AppError('No pending email change found', 400);
    }

    // Double-check email is still available
    const existingUser = await User.findOne({
      email: user.pendingEmail,
      _id: { $ne: user._id },
    });
    if (existingUser) {
      await User.updateOne(
        {
          _id: user._id,
          pendingEmail: user.pendingEmail,
          emailChangeTokenDigest: tokenDigest,
          emailChangeExpire: { $gt: now },
        },
        {
          $unset: {
            pendingEmail: '',
            pendingEmailLocale: '',
            emailChangeTokenDigest: '',
            emailChangeExpire: '',
          },
        }
      );
      throw new AppError('Email is no longer available', 409);
    }

    const oldEmail = user.email;
    const newEmail = user.pendingEmail;
    const locale = user.pendingEmailLocale ?? 'de';

    let consumed: IUser | null;
    try {
      consumed = await User.findOneAndUpdate(
        {
          _id: user._id,
          pendingEmail: newEmail,
          emailChangeTokenDigest: tokenDigest,
          emailChangeExpire: { $gt: now },
        },
        {
          $set: { email: newEmail },
          $unset: {
            pendingEmail: '',
            pendingEmailLocale: '',
            emailChangeTokenDigest: '',
            emailChangeExpire: '',
          },
        },
        { new: true, runValidators: true }
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      await User.updateOne(
        { _id: user._id, emailChangeTokenDigest: tokenDigest },
        {
          $unset: {
            pendingEmail: '',
            pendingEmailLocale: '',
            emailChangeTokenDigest: '',
            emailChangeExpire: '',
          },
        }
      );
      throw new AppError('Email is no longer available', 409);
    }

    if (!consumed) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    console.log(`Email changed for user ${user._id}`);

    return {
      success: true,
      oldEmail,
      newEmail,
      userId: (user._id as any).toString(),
      locale,
    };
  }

  /**
   * Cancel pending email change
   * @param userId - User ID to cancel email change for
   */
  static async cancelEmailChange(
    userId: string | Schema.Types.ObjectId
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.pendingEmail = undefined;
    user.pendingEmailLocale = undefined;
    user.emailChangeTokenDigest = undefined;
    user.emailChangeExpire = undefined;
    await user.save();

    console.log(`❌ Email change cancelled for user ${userId}`);
  }
}
