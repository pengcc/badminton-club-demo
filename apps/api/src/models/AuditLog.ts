import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import {
  AuditEventType,
  AccountKind,
  EntityType,
} from '@club/shared-types/core/enums';

export interface FieldChange {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export type AuditExecutionSource = 'human' | 'scheduled';

export interface IAuditLog extends Document {
  eventType: AuditEventType;
  entityType: EntityType;
  entityId?: Types.ObjectId;
  actorId: Types.ObjectId;
  actorAccountKind: AccountKind;
  source: AuditExecutionSource;
  reason?: string;
  changes?: FieldChange[];
  createdAt: Date;
}

const fieldChangeSchema = new Schema<FieldChange>(
  {
    field: { type: String, required: true, trim: true, maxlength: 80 },
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
  },
  { _id: false, strict: true }
);

const auditLogSchema = new Schema<IAuditLog>(
  {
    eventType: {
      type: String,
      enum: Object.values(AuditEventType),
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: Object.values(EntityType),
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, index: true },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorAccountKind: {
      type: String,
      enum: Object.values(AccountKind),
      required: true,
    },
    source: {
      type: String,
      enum: ['human', 'scheduled'],
      default: 'human',
      required: true,
    },
    reason: { type: String, trim: true, maxlength: 1000 },
    changes: {
      type: [fieldChangeSchema],
      validate: {
        validator: (changes: FieldChange[]) => changes.length <= 24,
        message: 'Audit changes cannot contain more than 24 fields',
      },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'auditlogs',
    strict: 'throw',
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ eventType: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
