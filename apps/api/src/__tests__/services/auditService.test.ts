import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuditEventType,
  EntityType,
  AccountKind,
} from '@club/shared-types/core/enums';
import { AuditLog } from '../../models/AuditLog';
import { AuditService } from '../../services/auditService';
import { RequiredAuditPersistenceError } from '../../utils/errors';

const params = {
  eventType: AuditEventType.USER_UPDATED,
  entityType: EntityType.USER,
  entityId: new Types.ObjectId(),
  actor: { id: new Types.ObjectId(), accountKind: AccountKind.PERSON },
  changes: [
    { field: 'administratorDesignation', oldValue: false, newValue: true },
  ],
};

describe('AuditService persistence semantics', () => {
  afterEach(() => vi.restoreAllMocks());

  it('propagates required persistence failure', async () => {
    vi.spyOn(AuditLog, 'create').mockRejectedValue(new Error('unavailable'));
    await expect(AuditService.writeRequired(params)).rejects.toMatchObject({
      name: 'RequiredAuditPersistenceError',
      operation: 'audit_write_required',
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId.toString(),
    } satisfies Partial<RequiredAuditPersistenceError>);
  });

  it('returns without waiting and contains best-effort persistence failure', async () => {
    let rejectPersistence: ((error: Error) => void) | undefined;
    vi.spyOn(AuditLog, 'create').mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPersistence = reject;
        }) as never
    );
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(AuditService.writeBestEffort(params)).toBeUndefined();
    expect(diagnostic).not.toHaveBeenCalled();

    rejectPersistence?.(new Error('sensitive raw database detail'));

    await vi.waitFor(() =>
      expect(diagnostic).toHaveBeenCalledWith('Audit persistence failed', {
        operation: 'audit_write',
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId.toString(),
      })
    );
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(
      'sensitive raw database detail'
    );
  });

  it('rejects removed broad fields from new Audit documents', () => {
    expect(
      () =>
        new AuditLog({
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId,
          actorId: params.actor.id,
          actorAccountKind: params.actor.accountKind,
          source: 'human',
          actorEmail: 'not-retained@example.test',
          metadata: { request: 'not retained' },
        })
    ).toThrow();
  });
});
