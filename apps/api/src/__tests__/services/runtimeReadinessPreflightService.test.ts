import { describe, expect, it, vi } from 'vitest';
import { runRuntimeReadinessPreflight } from '../../services/runtimeReadinessPreflightService';

function createDependencies() {
  return {
    nodeMajorVersion: 24,
    connectMongo: vi.fn(async () => undefined),
    disconnectMongo: vi.fn(async () => undefined),
    inspectMongoTransactionSupport: vi.fn(async () => true),
    inspectStorageIsolation: vi.fn(async () => true),
    retainedPublicUploadsCoherent: true,
    inspectMembershipApplicationBankingCompatibility: vi.fn(async () => ({
      ready: true,
      inspected: 2,
      referencedKeyVersionCount: 1,
      unavailableKeyVersionCount: 0,
    })),
    inspectMembershipApplicationBanking: vi.fn(async () => ({
      ready: true,
      inspected: 4,
      findingCount: 0,
    })),
    inspectTasterSessionPersistence: vi.fn(async () => ({
      ready: true,
      pendingMissingOrUnnormalizedEmailCount: 0,
      duplicatePendingNormalizedEmailGroups: 0,
      duplicatePendingDocuments: 0,
      compatibleIndexCount: 1,
      conflictingNamedIndexCount: 0,
    })),
    inspectTasterSession: vi.fn(async () => ({
      ready: true,
      documentCount: 3,
      blockerCount: 0,
    })),
    inspectConsumedEmailTemplates: vi.fn(async () => ({
      ready: true,
      inspected: 21,
      invalidCount: 0,
    })),
    inspectSmtp: vi.fn(async (verifyTransport: boolean) => ({
      configured: true,
      verified: verifyTransport,
    })),
    inspectFileAccessibility: vi.fn(async () => ({
      accessible: true,
      checkedRootCount: 2,
    })),
  };
}

const now = new Date('2026-08-10T10:00:00.000Z');

describe('runtime readiness preflight', () => {
  it('is unverified when read-only checks pass and SMTP transport was not requested', async () => {
    const dependencies = createDependencies();
    const report = await runRuntimeReadinessPreflight(dependencies, {
      verifySmtp: false,
      now,
    });

    expect(report.status).toBe('unverified');
    expect(dependencies.inspectSmtp).toHaveBeenCalledWith(false);
    expect(report.checks).toContainEqual({
      checkId: 'smtp',
      status: 'unverified',
      reasonCode: 'SMTP_TRANSPORT_NOT_REQUESTED',
      observedAt: now.toISOString(),
    });
    expect(dependencies.disconnectMongo).toHaveBeenCalledOnce();
  });

  it('blocks unsupported Mongo topology without hiding the other read-only checks', async () => {
    const dependencies = createDependencies();
    dependencies.inspectMongoTransactionSupport.mockResolvedValue(false);

    const report = await runRuntimeReadinessPreflight(dependencies, {
      verifySmtp: true,
      now,
    });

    expect(report.status).toBe('blocked');
    expect(report.checks).toContainEqual({
      checkId: 'mongo-transactions',
      status: 'blocked',
      reasonCode: 'MONGO_TRANSACTIONS_UNSUPPORTED',
      observedAt: now.toISOString(),
    });
    expect(
      dependencies.inspectMembershipApplicationBanking
    ).toHaveBeenCalledOnce();
    expect(
      dependencies.inspectMembershipApplicationBankingCompatibility
    ).toHaveBeenCalledOnce();
    expect(dependencies.inspectTasterSessionPersistence).toHaveBeenCalledOnce();
    expect(dependencies.inspectTasterSession).toHaveBeenCalledOnce();
  });

  it('blocks unavailable current application banking key versions separately from integrity diagnostics', async () => {
    const dependencies = createDependencies();
    dependencies.inspectMembershipApplicationBankingCompatibility.mockResolvedValue(
      {
        ready: false,
        inspected: 3,
        referencedKeyVersionCount: 2,
        unavailableKeyVersionCount: 1,
      }
    );

    const report = await runRuntimeReadinessPreflight(dependencies, {
      verifySmtp: true,
      now,
    });

    expect(report.status).toBe('blocked');
    expect(report.checks).toContainEqual({
      checkId: 'membership-application-banking-compatibility',
      status: 'blocked',
      reasonCode: 'APPLICATION_BANKING_KEY_VERSION_UNAVAILABLE',
      observedAt: now.toISOString(),
      aggregates: {
        inspected: 3,
        referencedKeyVersionCount: 2,
        unavailableKeyVersionCount: 1,
      },
    });
  });

  it('keeps banking readiness scoped to the existing Membership Application owner', async () => {
    const dependencies = createDependencies();
    dependencies.inspectMembershipApplicationBanking.mockResolvedValue({
      ready: false,
      inspected: 2,
      findingCount: 1,
    });

    const report = await runRuntimeReadinessPreflight(dependencies, {
      verifySmtp: true,
      now,
    });

    expect(report.status).toBe('degraded');
    expect(report.checks).toContainEqual({
      checkId: 'membership-application-banking',
      status: 'degraded',
      reasonCode: 'APPLICATION_BANKING_FINDINGS',
      observedAt: now.toISOString(),
      aggregates: { inspected: 2, findingCount: 1 },
    });
  });

  it('marks retained public uploads degraded for an alternate development database', async () => {
    const dependencies = createDependencies();
    dependencies.retainedPublicUploadsCoherent = false;

    const report = await runRuntimeReadinessPreflight(dependencies, {
      verifySmtp: true,
      now,
    });

    expect(report.status).toBe('degraded');
    expect(report.checks).toContainEqual({
      checkId: 'retained-public-uploads',
      status: 'degraded',
      reasonCode: 'RETAINED_PUBLIC_UPLOADS_UNVERIFIED_FOR_ALTERNATE_DATABASE',
      observedAt: now.toISOString(),
    });
  });

  it('blocks the Taster persistence prerequisite while retaining the broad audit as a diagnostic', async () => {
    const dependencies = createDependencies();
    dependencies.inspectTasterSessionPersistence.mockResolvedValue({
      ready: false,
      pendingMissingOrUnnormalizedEmailCount: 1,
      duplicatePendingNormalizedEmailGroups: 0,
      duplicatePendingDocuments: 0,
      compatibleIndexCount: 0,
      conflictingNamedIndexCount: 0,
    });
    dependencies.inspectTasterSession.mockResolvedValue({
      ready: false,
      documentCount: 2,
      blockerCount: 1,
    });

    const report = await runRuntimeReadinessPreflight(dependencies, {
      verifySmtp: true,
      now,
    });

    expect(report.status).toBe('blocked');
    expect(report.checks).toContainEqual({
      checkId: 'taster-session-persistence',
      status: 'blocked',
      reasonCode: 'TASTER_SESSION_PERSISTENCE_BLOCKED',
      observedAt: now.toISOString(),
      aggregates: {
        pendingMissingOrUnnormalizedEmailCount: 1,
        duplicatePendingNormalizedEmailGroups: 0,
        duplicatePendingDocuments: 0,
        compatibleIndexCount: 0,
        conflictingNamedIndexCount: 0,
      },
    });
    expect(report.checks).toContainEqual({
      checkId: 'taster-session-readiness',
      status: 'degraded',
      reasonCode: 'TASTER_SESSION_FINDINGS',
      observedAt: now.toISOString(),
      aggregates: { documentCount: 2, blockerCount: 1 },
    });
  });

  it('normalizes child failures without leaking raw retained-data details', async () => {
    const dependencies = createDependencies();
    dependencies.inspectTasterSession.mockRejectedValue(
      new Error('person@example.test at /private/retained/path')
    );

    const report = await runRuntimeReadinessPreflight(dependencies, {
      verifySmtp: true,
      now,
    });
    const output = JSON.stringify(report);

    expect(report.status).toBe('degraded');
    expect(output).toContain('TASTER_SESSION_CHECK_FAILED');
    expect(output).not.toContain('person@example.test');
    expect(output).not.toContain('/private/retained/path');
  });

  it('fails closed when mandatory evidence cannot be established without leaking the cause', async () => {
    const dependencies = createDependencies();
    dependencies.inspectMembershipApplicationBankingCompatibility.mockRejectedValue(
      new Error('key v3 for person@example.test')
    );

    const report = await runRuntimeReadinessPreflight(dependencies, {
      verifySmtp: true,
      now,
    });
    const output = JSON.stringify(report);

    expect(report.status).toBe('blocked');
    expect(output).toContain('APPLICATION_BANKING_COMPATIBILITY_CHECK_FAILED');
    expect(output).not.toContain('person@example.test');
    expect(output).not.toContain('key v3');
  });
});
