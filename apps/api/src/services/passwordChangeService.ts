import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { AuthSessionService } from './authSessionService';

export class PasswordChangeService {
  static async change(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const user = await User.findById(input.userId)
          .select('+password +authSessionGeneration')
          .session(session);
        if (!user?.password) {
          throw AppError.notFound('User not found');
        }
        if (!(await bcrypt.compare(input.currentPassword, user.password))) {
          throw AppError.unauthorized('Current password is incorrect');
        }

        const nextGeneration =
          AuthSessionService.generation(user.authSessionGeneration) + 1;
        user.password = input.newPassword;
        user.authSessionGeneration = nextGeneration;
        await user.save({ session });

        await AuthSessionService.deleteOlderGenerations(
          user._id.toString(),
          nextGeneration,
          session
        );
      });
    } finally {
      await session.endSession();
    }
  }
}
