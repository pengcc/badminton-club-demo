import { Schema, model } from 'mongoose';
import {
  Gender,
  MembershipType,
  MemberApplicationStatus
} from '@club/shared-types/core/enums';
import { validationPlugin } from '../plugins/mongooseValidation';
import { BaseDocument } from '../types/persistence/base';
import { Types } from 'mongoose';

/**
 * Mongoose schema for MembershipApplication
 * 
 * IMPORTANT: Validation rules here are intentionally duplicated with frontend validation.
 * 
 * Backend validation (this schema):
 * - Purpose: Security boundary - prevents invalid data from reaching database
 * - Behavior: Strict all-or-nothing validation on incoming requests
 * - Cannot be bypassed by malicious users
 * 
 * Frontend validation (apps/web/app/lib/validation.ts):
 * - Purpose: Fast UX feedback for better user experience
 * - Behavior: Progressive disclosure, partial validation as user types
 * - Can be bypassed, so backend must validate everything
 * 
 * Maintenance: Keep both in sync when updating validation rules.
 * Always update backend first (security boundary), then frontend (UX).
 * 
 * See: openspec/ARCHITECTURE.md#validation-strategy for full rationale
 */

/**
 * Local type definitions for membership application model
 */
interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  address: Address;
}

interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

interface BankingInfo {
  accountHolder: string;
  iban: string;
  bic?: string;
  bankName: string;
}

interface MedicalInfo {
  hasConditions: boolean;
  conditions?: string;
  canParticipate: boolean;
}

interface IMembershipApplication extends BaseDocument {
  personalInfo: PersonalInfo;
  membershipType: MembershipType;
  bankingInfo?: BankingInfo;
  medicalInfo: MedicalInfo;
  motivation?: string;
  status: MemberApplicationStatus;
  submittedAt: Date;
  reviewDate?: Date;
  reviewer?: Types.ObjectId | string;
  reviewNotes?: string;
  isActive: boolean;
}

/**
 * Extended attributes with populated fields
 */
interface PopulatedApplication extends Omit<IMembershipApplication, 'reviewer'> {
  reviewer?: {
    _id: Schema.Types.ObjectId;
    name: string;
  };
}

/**
 * View model for frontend
 */
interface MembershipApplicationView {
  readonly id: string;
  readonly personalInfo: PersonalInfo;
  readonly membershipType: MembershipType;
  readonly bankingInfo?: BankingInfo;
  readonly medicalInfo: MedicalInfo;
  readonly motivation?: string;
  readonly status: MemberApplicationStatus;
  readonly submittedAt: Date;
  readonly reviewDate?: Date;
  readonly reviewer?: {
    readonly id: string;
    readonly name: string;
  };
  readonly reviewNotes?: string;
}

/**
 * Validation rules
 */
const membershipValidationRules = {
  personalInfo: {
    firstName: {
      required: true,
      minLength: 2,
      maxLength: 50
    },
    lastName: {
      required: true,
      minLength: 2,
      maxLength: 50
    },
    email: {
      required: true,
      pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
    },
    phone: {
      required: true,
      pattern: /^\+?[\d\s-]{8,}$/
    },
    dateOfBirth: {
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}$/
    },
    gender: {
      required: true,
      custom: (value: unknown) => Object.values(Gender).includes(value as Gender)
    },
    address: {
      required: true,
      custom: (value: unknown) => {
        const addr = value as Address;
        return !!(addr?.street && addr?.city && addr?.postalCode && addr?.country);
      }
    }
  },
  membershipType: {
    required: true,
    custom: (value: unknown) => Object.values(MembershipType).includes(value as MembershipType)
  },
  bankingInfo: {
    iban: {
      pattern: /^DE\d{20}$/
    }
  },
  medicalInfo: {
    required: true,
    custom: (value: unknown) => {
      const info = value as MedicalInfo;
      return typeof info?.hasConditions === 'boolean' && typeof info?.canParticipate === 'boolean';
    }
  }
} as const;

/**
 * Membership application schema
 */
const membershipApplicationSchema = new Schema<IMembershipApplication>({
  personalInfo: {
    firstName: {
      type: String,
      required: membershipValidationRules.personalInfo.firstName.required,
      trim: true,
      minlength: [membershipValidationRules.personalInfo.firstName.minLength, 'First name too short'],
      maxlength: [membershipValidationRules.personalInfo.firstName.maxLength, 'First name too long']
    },
    lastName: {
      type: String,
      required: membershipValidationRules.personalInfo.lastName.required,
      trim: true,
      minlength: [membershipValidationRules.personalInfo.lastName.minLength, 'Last name too short'],
      maxlength: [membershipValidationRules.personalInfo.lastName.maxLength, 'Last name too long']
    },
    email: {
      type: String,
      required: membershipValidationRules.personalInfo.email.required,
      lowercase: true,
      trim: true,
      validate: [
        {
          validator: (v: string) => membershipValidationRules.personalInfo.email.pattern?.test(v) ?? false,
          message: 'Please enter a valid email'
        }
      ]
    },
    phone: {
      type: String,
      required: membershipValidationRules.personalInfo.phone.required,
      trim: true,
      validate: [
        {
          validator: (v: string) => membershipValidationRules.personalInfo.phone.pattern?.test(v) ?? false,
          message: 'Please enter a valid phone number'
        }
      ]
    },
    dateOfBirth: {
      type: String,
      required: membershipValidationRules.personalInfo.dateOfBirth.required,
      validate: [
        {
          validator: (v: string) => (membershipValidationRules.personalInfo.dateOfBirth.pattern?.test(v) ?? false),
          message: 'Please enter a valid date (YYYY-MM-DD)'
        },
        {
          // Disallow future dates
          validator: (v: string) => {
            if (!(membershipValidationRules.personalInfo.dateOfBirth.pattern?.test(v) ?? false)) return false;
            const d = new Date(`${v}T00:00:00Z`);
            if (isNaN(d.getTime())) return false;
            const today = new Date();
            return d <= today;
          },
          message: 'Date of birth cannot be in the future'
        },
        {
          // Enforce minimum age of 14 years
          validator: (v: string) => {
            if (!(membershipValidationRules.personalInfo.dateOfBirth.pattern?.test(v) ?? false)) return false;
            const d = new Date(`${v}T00:00:00Z`);
            if (isNaN(d.getTime())) return false;
            const today = new Date();
            const ageYears = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            return ageYears >= 14;
          },
          message: 'Minimum age is 14'
        }
      ]
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      required: membershipValidationRules.personalInfo.gender.required
    },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true }
    }
  },
  membershipType: {
    type: String,
    required: membershipValidationRules.membershipType.required,
    enum: Object.values(MembershipType),
    default: MembershipType.REGULAR
  },
  bankingInfo: {
    accountHolder: { type: String, trim: true },
    iban: {
      type: String,
      trim: true,
      validate: [
        {
          validator: (v: string) => !v || membershipValidationRules.bankingInfo.iban.pattern?.test(v.replace(/\s/g, '')),
          message: 'Please enter a valid German IBAN'
        }
      ]
    },
    bic: { type: String, trim: true },
    bankName: { type: String, trim: true }
  },
  medicalInfo: {
    hasConditions: { type: Boolean, required: true, default: false },
    conditions: { type: String, trim: true },
    canParticipate: { type: Boolean, required: true, default: true }
  },
  motivation: { type: String, trim: true },
  status: {
    type: String,
    required: true,
    enum: Object.values(MemberApplicationStatus),
    default: MemberApplicationStatus.PENDING_REVIEW
  },
  submittedAt: { type: Date, default: Date.now },
  reviewDate: { type: Date },
  reviewer: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes for efficient queries
membershipApplicationSchema.index({ 'personalInfo.email': 1 });
membershipApplicationSchema.index({ status: 1 });
membershipApplicationSchema.index({ submittedAt: -1 });

/**
 * Convert to view model
 */
membershipApplicationSchema.methods.toView = async function(this: PopulatedApplication): Promise<MembershipApplicationView> {
  const populated = this.reviewer ? await this.populate('reviewer', 'name') : this;

  return {
    id: populated._id.toString(),
    personalInfo: populated.personalInfo,
    membershipType: populated.membershipType,
    bankingInfo: populated.bankingInfo,
    medicalInfo: populated.medicalInfo,
    motivation: populated.motivation,
    status: populated.status,
    submittedAt: populated.submittedAt,
    reviewDate: populated.reviewDate,
    reviewer: (populated.reviewer && typeof populated.reviewer === 'object' && '_id' in populated.reviewer && 'name' in populated.reviewer) ? {
      id: (populated.reviewer as { _id: Schema.Types.ObjectId; name: string })._id.toString(),
      name: (populated.reviewer as { _id: Schema.Types.ObjectId; name: string }).name
    } : undefined,
    reviewNotes: populated.reviewNotes
  };
};

// Apply validation plugin
membershipApplicationSchema.plugin(validationPlugin);

// Export model
export const MembershipApplication = model<IMembershipApplication>('MembershipApplication', membershipApplicationSchema);