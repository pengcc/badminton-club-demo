import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  Gender,
  UserRole,
  MembershipType,
  MembershipStatus
} from '@club/shared-types/core/enums';
import { validationPlugin } from '../plugins/mongooseValidation';

/**
 * Core user attributes
 */
interface UserAttributes {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string;
  readonly gender: Gender;
  readonly dateOfBirth: string; // Format: YYYY-MM-DD
  role: UserRole;
  membershipType?: MembershipType;
  membershipStatus: MembershipStatus;
  readonly address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  isPlayer: boolean;
}

/**
 * User view for frontend
 */
interface UserView {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName?: string;  // COMPUTED: "Lastname, Firstname"
  readonly phone?: string;
  readonly gender: Gender;
  readonly dateOfBirth: string;
  readonly role: UserRole;
  readonly membershipType?: MembershipType;
  readonly membershipStatus: MembershipStatus;
  readonly address?: {
    readonly street: string;
    readonly city: string;
    readonly postalCode: string;
    readonly country: string;
  };
  readonly isPlayer: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * User validation rules
 */
const userValidationRules = {
  email: {
    required: true,
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
  firstName: {
    required: true,
    minLength: 2,
    maxLength: 50,
  },
  lastName: {
    required: true,
    minLength: 2,
    maxLength: 50,
  },
  phone: {
    pattern: /^\+?[\d\s-()]+$/,
  },
  gender: {
    required: true,
    custom: (value: unknown) => Object.values(Gender).includes(value as Gender),
  },
  dateOfBirth: {
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
  },
  membershipType: {
    custom: (value: unknown) =>
      !value || Object.values(MembershipType).includes(value as MembershipType),
  },
  address: {
    custom: (value: unknown) => {
      if (!value) return true;
      const address = value as Record<string, unknown>;
      return (
        typeof address.street === 'string' &&
        typeof address.city === 'string' &&
        typeof address.postalCode === 'string' &&
        typeof address.country === 'string'
      );
    },
  },
};

/**
 * Extended user data for backend
 * TODO Phase 3: Migrate to use Persistence.UserDocument from @club/shared-types/persistence/user
 * Currently using local types - will be replaced with persistence layer types
 */
interface UserExtensions {
  password: string;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
}

/**
 * MongoDB document type with backend methods
 */
export interface IUser extends UserAttributes, UserExtensions, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toView(): Promise<UserView>;
}

/**
 * User schema definition
 */
const userSchema = new Schema<IUser>({
  // Core attributes
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: (v: string) => userValidationRules.email.pattern?.test(v),
      message: 'Please enter a valid email'
    }
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: [userValidationRules.firstName.minLength, 'First name must be at least 2 characters'],
    maxlength: [userValidationRules.firstName.maxLength, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: [userValidationRules.lastName.minLength, 'Last name must be at least 2 characters'],
    maxlength: [userValidationRules.lastName.maxLength, 'Last name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    validate: {
      validator: (v: string) => !v || userValidationRules.phone.pattern?.test(v),
      message: 'Invalid phone number format'
    }
  },
  gender: {
    type: String,
    enum: Object.values(Gender),
    required: true
  },
  dateOfBirth: {
    type: String,
    required: true,
    validate: {
      validator: (v: string) => userValidationRules.dateOfBirth.pattern?.test(v),
      message: 'Invalid date format (YYYY-MM-DD)'
    }
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.APPLICANT
  },
  membershipType: {
    type: String,
    enum: Object.values(MembershipType)
  },
  membershipStatus: {
    type: String,
    enum: Object.values(MembershipStatus),
    default: MembershipStatus.ACTIVE
  },
  address: {
    street: { type: String },
    city: { type: String },
    postalCode: { type: String },
    country: { type: String },
    _id: false
  },
  isPlayer: { type: Boolean, default: false },

  // Backend-specific fields
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add index for sorting by last name
userSchema.index({ lastName: 1, firstName: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  const user = await this.model('User')
    .findById(this._id)
    .select('password')
    .lean();
  return user ? await bcrypt.compare(candidatePassword, user.password) : false;
};

/**
 * Convert document to frontend view
 */
userSchema.methods.toView = async function(this: IUser): Promise<UserView> {
  const { _id, email, firstName, lastName, phone, gender, dateOfBirth, role,
    membershipType, membershipStatus, address, isPlayer } = this;

  // Extract timestamps using type assertion
  const timestamps = this as unknown as { createdAt: Date; updatedAt: Date };
  const id = (this as unknown as { _id: { toString(): string } })._id.toString();

  // Load teams if user is a player
  let teams;
  if (isPlayer) {
    type TeamRef = {
      _id: { toString(): string };
      name: string;
    };

    const playerDoc = await this.model('Player')
      .findOne({ userId: _id })
      .populate<{ teamIds: TeamRef[] }>('teamIds', 'name');

    teams = playerDoc?.teamIds?.map(team => ({
      id: team._id.toString(),
      name: team.name
    }));
  }

  return {
    id,
    email,
    firstName,
    lastName,
    fullName: `${lastName}, ${firstName}`,  // COMPUTED: "Lastname, Firstname"
    phone,
    gender,
    dateOfBirth,
    role,
    membershipType,
    membershipStatus,
    address,
    isPlayer,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    //...(teams && { teams })
  };
};

// Apply validation plugin
userSchema.plugin(validationPlugin);

export const User = model<IUser>('User', userSchema);