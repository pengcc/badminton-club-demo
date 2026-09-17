import type { Document, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  Gender,
  AccountKind,
  MembershipType,
  MembershipStatus,
  AccountOnboardingStatus,
} from '@club/shared-types/core/enums';
import type { AccountSuspension } from '@club/shared-types/domain/user';
import {
  germanAddressSchema,
  isRealNonFutureDate,
} from '@club/shared-types/domain/personProfile';
import { validationPlugin } from '../plugins/mongooseValidation';

/**
 * Core user attributes
 */
interface UserAttributeBase {
  readonly email: string;
  accountOnboardingStatus: AccountOnboardingStatus;
}

export interface PersonUserAttributes extends UserAttributeBase {
  readonly accountKind: AccountKind.PERSON;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string;
  readonly gender: Gender;
  readonly dateOfBirth: string; // Person accounts only; YYYY-MM-DD
  administratorDesignation: boolean;
  membershipType?: MembershipType;
  membershipStatus: MembershipStatus;
  accountSuspension?: {
    reason: string;
    suspendedAt: Date;
    suspendedBy: Types.ObjectId;
  };
  readonly address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  isPlayer: boolean;
}

export interface SuperAdminUserAttributes extends UserAttributeBase {
  readonly accountKind: AccountKind.SUPER_ADMIN;
  administratorDesignation: false;
  isPlayer: false;
  readonly firstName?: never;
  readonly lastName?: never;
  readonly phone?: never;
  readonly gender?: never;
  readonly dateOfBirth?: never;
  membershipType?: never;
  membershipStatus?: never;
  accountSuspension?: never;
  readonly address?: never;
}

export type UserAttributes = PersonUserAttributes | SuperAdminUserAttributes;

interface UserSchemaAttributes extends UserAttributeBase {
  readonly accountKind: AccountKind;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly gender?: Gender;
  readonly dateOfBirth?: string;
  administratorDesignation: boolean;
  membershipType?: MembershipType;
  membershipStatus?: MembershipStatus;
  accountSuspension?: {
    reason: string;
    suspendedAt: Date;
    suspendedBy: Types.ObjectId;
  };
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
interface UserViewBase {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly fullName: string;
  readonly accountOnboardingStatus: AccountOnboardingStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface PersonUserView extends UserViewBase {
  readonly accountKind: AccountKind.PERSON;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string;
  readonly gender: Gender;
  readonly dateOfBirth: string;
  readonly administratorDesignation: boolean;
  readonly membershipType?: MembershipType;
  readonly membershipStatus: MembershipStatus;
  readonly accountSuspension?: AccountSuspension<Date>;
  readonly address?: {
    readonly street: string;
    readonly city: string;
    readonly postalCode: string;
    readonly country: string;
  };
  readonly isPlayer: boolean;
}

interface SuperAdminUserView extends UserViewBase {
  readonly accountKind: AccountKind.SUPER_ADMIN;
  readonly displayName: 'Super Admin';
  readonly fullName: 'Super Admin';
  readonly administratorDesignation: false;
  readonly isPlayer: false;
  readonly firstName?: never;
  readonly lastName?: never;
  readonly phone?: never;
  readonly gender?: never;
  readonly dateOfBirth?: never;
  readonly membershipType?: never;
  readonly membershipStatus?: never;
  readonly accountSuspension?: never;
  readonly address?: never;
}

type UserView = PersonUserView | SuperAdminUserView;

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
    minLength: 1,
    maxLength: 50,
  },
  lastName: {
    required: true,
    minLength: 1,
    maxLength: 50,
  },
  phone: {
    pattern: /^\+?[\d\s()./-]+$/,
  },
  gender: {
    required: true,
    custom: (value: unknown) => Object.values(Gender).includes(value as Gender),
  },
  dateOfBirth: {
    required: true,
    custom: (value: unknown) =>
      typeof value === 'string' && isRealNonFutureDate(value),
  },
  membershipType: {
    custom: (value: unknown) =>
      !value || Object.values(MembershipType).includes(value as MembershipType),
  },
  address: {
    custom: (value: unknown) =>
      !value || germanAddressSchema.safeParse(value).success,
  },
};

/**
 * Extended user data for backend
 * TODO Phase 3: Migrate to use Persistence.UserDocument from @club/shared-types/persistence/user
 * Currently using local types - will be replaced with persistence layer types
 */
interface UserExtensions {
  password?: string;
  authSessionGeneration: number;
  passwordSetupTokenDigest?: string;
  passwordSetupExpiresAt?: Date;
  passwordSetupGeneration: number;
  passwordSetupLocale?: 'de' | 'en' | 'zh';
  passwordSetupConsumedAt?: Date;
  passwordSetupDeliveryStatus?:
    | 'pending'
    | 'claimed'
    | 'sent'
    | 'failed'
    | 'uncertain';
  passwordSetupDeliveryGeneration?: number;
  passwordSetupDeliveryClaimedAt?: Date;
  passwordSetupDeliveryAttemptedAt?: Date;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  passwordRecoveryTokenDigest?: string;
  passwordRecoveryExpiresAt?: Date;
  // Email change verification
  pendingEmail?: string;
  pendingEmailLocale?: 'de' | 'en' | 'zh';
  emailChangeTokenDigest?: string;
  emailChangeExpire?: Date;
}

/**
 * MongoDB document type with backend methods
 */
interface UserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toView(): Promise<UserView>;
}

type UserDocumentBase = UserExtensions & Document & UserMethods;

export type PersonUserDocument = PersonUserAttributes & UserDocumentBase;
export type SuperAdminUserDocument = SuperAdminUserAttributes &
  UserDocumentBase;
export type IUser = PersonUserDocument | SuperAdminUserDocument;

type UserSchemaDocument = UserSchemaAttributes & UserDocumentBase;

/**
 * User schema definition
 */
const userSchema = new Schema<UserSchemaDocument>(
  {
    // Core attributes
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: (v: string) => userValidationRules.email.pattern?.test(v),
        message: 'Please enter a valid email',
      },
    },
    accountKind: {
      type: String,
      enum: Object.values(AccountKind),
      default: AccountKind.PERSON,
      required: true,
      immutable: true,
    },
    firstName: {
      type: String,
      required(this: UserSchemaDocument) {
        return this.accountKind === AccountKind.PERSON;
      },
      trim: true,
      minlength: [
        userValidationRules.firstName.minLength,
        'First name is required',
      ],
      maxlength: [
        userValidationRules.firstName.maxLength,
        'First name cannot exceed 50 characters',
      ],
    },
    lastName: {
      type: String,
      required(this: UserSchemaDocument) {
        return this.accountKind === AccountKind.PERSON;
      },
      trim: true,
      minlength: [
        userValidationRules.lastName.minLength,
        'Last name is required',
      ],
      maxlength: [
        userValidationRules.lastName.maxLength,
        'Last name cannot exceed 50 characters',
      ],
    },
    phone: {
      type: String,
      validate: {
        validator: (v: string) =>
          !v || userValidationRules.phone.pattern?.test(v),
        message: 'Invalid phone number format',
      },
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      required(this: UserSchemaDocument) {
        return this.accountKind === AccountKind.PERSON;
      },
    },
    dateOfBirth: {
      type: String,
      required(this: UserSchemaDocument) {
        return this.accountKind === AccountKind.PERSON;
      },
      validate: {
        validator: (v: string) => userValidationRules.dateOfBirth.custom?.(v),
        message: 'Date of birth must be a real non-future date',
      },
    },
    administratorDesignation: { type: Boolean, default: false, required: true },
    membershipType: {
      type: String,
      enum: Object.values(MembershipType),
    },
    membershipStatus: {
      type: String,
      enum: Object.values(MembershipStatus),
      default(this: UserSchemaDocument) {
        return this.accountKind === AccountKind.PERSON
          ? MembershipStatus.ACTIVE
          : undefined;
      },
      required(this: UserSchemaDocument) {
        return this.accountKind === AccountKind.PERSON;
      },
    },
    accountSuspension: {
      type: new Schema(
        {
          reason: { type: String, trim: true, minlength: 1, required: true },
          suspendedAt: { type: Date, required: true },
          suspendedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
        },
        { _id: false }
      ),
      required: false,
    },
    address: {
      street: { type: String, trim: true, minlength: 1, maxlength: 120 },
      city: { type: String, trim: true, minlength: 1, maxlength: 80 },
      postalCode: { type: String, match: /^\d{5}$/ },
      country: {
        type: String,
        validate: {
          validator: (value: string) =>
            ['de', 'deutschland', 'germany'].includes(value.toLowerCase()),
          message: 'Address must be in Germany',
        },
      },
      _id: false,
    },
    isPlayer: { type: Boolean, default: false },
    accountOnboardingStatus: {
      type: String,
      enum: Object.values(AccountOnboardingStatus),
      default: AccountOnboardingStatus.READY,
      required: true,
    },

    // Backend-specific fields
    password: {
      type: String,
      required(this: UserSchemaDocument) {
        return this.accountOnboardingStatus === AccountOnboardingStatus.READY;
      },
      minlength: 8,
      select: false,
    },
    authSessionGeneration: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },
    passwordSetupTokenDigest: { type: String, select: false },
    passwordSetupExpiresAt: Date,
    passwordSetupGeneration: { type: Number, default: 0, min: 0 },
    passwordSetupLocale: { type: String, enum: ['de', 'en', 'zh'] },
    passwordSetupConsumedAt: Date,
    passwordSetupDeliveryStatus: {
      type: String,
      enum: ['pending', 'claimed', 'sent', 'failed', 'uncertain'],
    },
    passwordSetupDeliveryGeneration: Number,
    passwordSetupDeliveryClaimedAt: Date,
    passwordSetupDeliveryAttemptedAt: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    passwordRecoveryTokenDigest: { type: String, select: false },
    passwordRecoveryExpiresAt: Date,
    // Email change verification
    pendingEmail: String,
    pendingEmailLocale: { type: String, enum: ['de', 'en', 'zh'] },
    emailChangeTokenDigest: { type: String, select: false },
    emailChangeExpire: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add index for sorting by last name
userSchema.index({ lastName: 1, firstName: 1 });
userSchema.index(
  { accountKind: 1 },
  {
    name: 'one_super_admin',
    unique: true,
    partialFilterExpression: { accountKind: AccountKind.SUPER_ADMIN },
  }
);

userSchema.pre('validate', function (next) {
  if (this.accountKind === AccountKind.SUPER_ADMIN) {
    const hasAddressFacts = Boolean(
      this.address &&
        Object.values(
          typeof (this.address as { toObject?: () => object }).toObject ===
            'function'
            ? (this.address as unknown as { toObject: () => object }).toObject()
            : this.address
        ).some((value) => value !== undefined && value !== '')
    );
    const hasPersonFacts = Boolean(
      this.firstName ||
        this.lastName ||
        this.phone ||
        this.gender ||
        this.dateOfBirth ||
        this.membershipType ||
        this.membershipStatus ||
        this.accountSuspension ||
        hasAddressFacts
    );
    if (hasPersonFacts || this.administratorDesignation || this.isPlayer) {
      return next(
        new Error(
          'Super Admin cannot contain person, Membership, or Player facts'
        )
      );
    }
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (!this.password) {
    return this.accountOnboardingStatus === AccountOnboardingStatus.READY
      ? next(new Error('Password is required for ready accounts'))
      : next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  const user = await this.model('User')
    .findById(this._id)
    .select('password')
    .lean();
  return user?.password
    ? await bcrypt.compare(candidatePassword, user.password)
    : false;
};

/**
 * Convert document to frontend view
 */
userSchema.methods.toView = async function (
  this: UserSchemaDocument
): Promise<UserView> {
  const {
    _id,
    email,
    accountKind,
    firstName,
    lastName,
    phone,
    gender,
    dateOfBirth,
    administratorDesignation,
    membershipType,
    membershipStatus,
    accountSuspension,
    address,
    isPlayer,
    accountOnboardingStatus,
  } = this;

  // Extract timestamps using type assertion
  const timestamps = this as unknown as { createdAt: Date; updatedAt: Date };
  const id = (
    this as unknown as { _id: { toString(): string } }
  )._id.toString();
  const projectedOnboardingStatus =
    accountOnboardingStatus ===
      AccountOnboardingStatus.PASSWORD_SETUP_PENDING &&
    this.passwordSetupExpiresAt &&
    this.passwordSetupExpiresAt.getTime() <= Date.now()
      ? AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED
      : accountOnboardingStatus;

  if (accountKind === AccountKind.SUPER_ADMIN) {
    return {
      id,
      email,
      accountKind: AccountKind.SUPER_ADMIN,
      displayName: 'Super Admin',
      fullName: 'Super Admin',
      administratorDesignation: false,
      accountOnboardingStatus: projectedOnboardingStatus,
      isPlayer: false,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
    };
  }

  if (!firstName || !lastName || !gender || !dateOfBirth || !membershipStatus) {
    throw new Error('Person account is missing required identity facts');
  }

  return {
    id,
    email,
    accountKind: AccountKind.PERSON,
    displayName: `${lastName}, ${firstName}`,
    firstName,
    lastName,
    fullName: `${lastName}, ${firstName}`,
    phone,
    gender,
    dateOfBirth,
    administratorDesignation,
    membershipType,
    membershipStatus,
    accountSuspension: accountSuspension
      ? {
          reason: accountSuspension.reason,
          suspendedAt: accountSuspension.suspendedAt,
          suspendedBy: accountSuspension.suspendedBy.toString(),
        }
      : undefined,
    accountOnboardingStatus: projectedOnboardingStatus,
    address,
    isPlayer,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };
};

// Apply validation plugin
userSchema.plugin(validationPlugin);

export const User = model<UserSchemaDocument>(
  'User',
  userSchema
) as unknown as Model<IUser>;
