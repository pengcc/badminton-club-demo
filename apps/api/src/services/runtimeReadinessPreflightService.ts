export type PreflightStatus = 'blocked' | 'degraded' | 'unverified' | 'ready';

export interface PreflightCheckResult {
  checkId: string;
  status: PreflightStatus;
  reasonCode: string;
  observedAt: string;
  aggregates?: Record<string, number>;
}

export interface RuntimeReadinessPreflightReport {
  status: PreflightStatus;
  observedAt: string;
  checks: PreflightCheckResult[];
}

interface RuntimeReadinessPreflightDependencies {
  nodeMajorVersion: number;
  connectMongo: () => Promise<void>;
  disconnectMongo: () => Promise<void>;
  inspectMongoTransactionSupport: () => Promise<boolean>;
  inspectStorageIsolation: () => Promise<boolean>;
  retainedPublicUploadsCoherent: boolean;
  inspectMembershipApplicationBankingCompatibility: () => Promise<{
    ready: boolean;
    inspected: number;
    referencedKeyVersionCount: number;
    unavailableKeyVersionCount: number;
  }>;
  inspectMembershipApplicationBanking: () => Promise<{
    ready: boolean;
    inspected: number;
    findingCount: number;
  }>;
  inspectTasterSessionPersistence: () => Promise<{
    ready: boolean;
    pendingMissingOrUnnormalizedEmailCount: number;
    duplicatePendingNormalizedEmailGroups: number;
    duplicatePendingDocuments: number;
    compatibleIndexCount: number;
    conflictingNamedIndexCount: number;
  }>;
  inspectTasterSession: () => Promise<{
    ready: boolean;
    documentCount: number;
    blockerCount: number;
  }>;
  inspectConsumedEmailTemplates: () => Promise<{
    ready: boolean;
    inspected: number;
    invalidCount: number;
  }>;
  inspectSmtp: (verifyTransport: boolean) => Promise<{
    configured: boolean;
    verified: boolean;
  }>;
  inspectFileAccessibility: () => Promise<{
    accessible: boolean;
    checkedRootCount: number;
  }>;
}

function check(
  checkId: string,
  status: PreflightStatus,
  reasonCode: string,
  observedAt: string,
  aggregates?: Record<string, number>
): PreflightCheckResult {
  return {
    checkId,
    status,
    reasonCode,
    observedAt,
    ...(aggregates ? { aggregates } : {}),
  };
}

function overallStatus(checks: PreflightCheckResult[]): PreflightStatus {
  if (checks.some((result) => result.status === 'blocked')) return 'blocked';
  if (checks.some((result) => result.status === 'degraded')) return 'degraded';
  if (checks.some((result) => result.status === 'unverified'))
    return 'unverified';
  return 'ready';
}

export async function runRuntimeReadinessPreflight(
  dependencies: RuntimeReadinessPreflightDependencies,
  options: { verifySmtp: boolean; now?: Date }
): Promise<RuntimeReadinessPreflightReport> {
  const observedAt = (options.now ?? new Date()).toISOString();
  const checks: PreflightCheckResult[] = [];
  const nodeSupported = dependencies.nodeMajorVersion === 24;
  checks.push(
    check(
      'node-runtime',
      nodeSupported ? 'ready' : 'blocked',
      nodeSupported ? 'NODE_RUNTIME_SUPPORTED' : 'NODE_RUNTIME_UNSUPPORTED',
      observedAt
    )
  );

  let mongoConnected = false;
  try {
    await dependencies.connectMongo();
    mongoConnected = true;
    checks.push(
      check('mongo-connectivity', 'ready', 'MONGO_CONNECTED', observedAt)
    );
  } catch {
    checks.push(
      check(
        'mongo-connectivity',
        'blocked',
        'MONGO_CONNECTION_FAILED',
        observedAt
      ),
      check(
        'mongo-transactions',
        'blocked',
        'MONGO_TRANSACTION_SUPPORT_UNVERIFIED',
        observedAt
      )
    );
  }

  if (mongoConnected) {
    try {
      const transactionCapable =
        await dependencies.inspectMongoTransactionSupport();
      checks.push(
        check(
          'mongo-transactions',
          transactionCapable ? 'ready' : 'blocked',
          transactionCapable
            ? 'MONGO_TRANSACTIONS_SUPPORTED'
            : 'MONGO_TRANSACTIONS_UNSUPPORTED',
          observedAt
        )
      );
    } catch {
      checks.push(
        check(
          'mongo-transactions',
          'blocked',
          'MONGO_TRANSACTION_SUPPORT_UNVERIFIED',
          observedAt
        )
      );
    }
  }

  let storageIsolated = false;
  try {
    storageIsolated = await dependencies.inspectStorageIsolation();
    checks.push(
      check(
        'storage-isolation',
        storageIsolated ? 'ready' : 'blocked',
        storageIsolated ? 'STORAGE_ROOTS_ISOLATED' : 'STORAGE_ROOTS_ALIAS',
        observedAt
      )
    );
  } catch {
    checks.push(
      check(
        'storage-isolation',
        'blocked',
        'STORAGE_ISOLATION_UNVERIFIED',
        observedAt
      )
    );
  }

  checks.push(
    check(
      'retained-public-uploads',
      dependencies.retainedPublicUploadsCoherent ? 'ready' : 'degraded',
      dependencies.retainedPublicUploadsCoherent
        ? 'RETAINED_PUBLIC_UPLOADS_COHERENT'
        : 'RETAINED_PUBLIC_UPLOADS_UNVERIFIED_FOR_ALTERNATE_DATABASE',
      observedAt
    )
  );

  if (mongoConnected) {
    try {
      const banking =
        await dependencies.inspectMembershipApplicationBankingCompatibility();
      checks.push(
        check(
          'membership-application-banking-compatibility',
          banking.ready ? 'ready' : 'blocked',
          banking.ready
            ? 'APPLICATION_BANKING_COMPATIBLE'
            : 'APPLICATION_BANKING_KEY_VERSION_UNAVAILABLE',
          observedAt,
          {
            inspected: banking.inspected,
            referencedKeyVersionCount: banking.referencedKeyVersionCount,
            unavailableKeyVersionCount: banking.unavailableKeyVersionCount,
          }
        )
      );
    } catch {
      checks.push(
        check(
          'membership-application-banking-compatibility',
          'blocked',
          'APPLICATION_BANKING_COMPATIBILITY_CHECK_FAILED',
          observedAt
        )
      );
    }

    try {
      const banking = await dependencies.inspectMembershipApplicationBanking();
      checks.push(
        check(
          'membership-application-banking',
          banking.ready ? 'ready' : 'degraded',
          banking.ready
            ? 'APPLICATION_BANKING_READY'
            : 'APPLICATION_BANKING_FINDINGS',
          observedAt,
          { inspected: banking.inspected, findingCount: banking.findingCount }
        )
      );
    } catch {
      checks.push(
        check(
          'membership-application-banking',
          'degraded',
          'APPLICATION_BANKING_CHECK_FAILED',
          observedAt
        )
      );
    }

    try {
      const taster = await dependencies.inspectTasterSessionPersistence();
      checks.push(
        check(
          'taster-session-persistence',
          taster.ready ? 'ready' : 'blocked',
          taster.ready
            ? 'TASTER_SESSION_PERSISTENCE_READY'
            : 'TASTER_SESSION_PERSISTENCE_BLOCKED',
          observedAt,
          {
            pendingMissingOrUnnormalizedEmailCount:
              taster.pendingMissingOrUnnormalizedEmailCount,
            duplicatePendingNormalizedEmailGroups:
              taster.duplicatePendingNormalizedEmailGroups,
            duplicatePendingDocuments: taster.duplicatePendingDocuments,
            compatibleIndexCount: taster.compatibleIndexCount,
            conflictingNamedIndexCount: taster.conflictingNamedIndexCount,
          }
        )
      );
    } catch {
      checks.push(
        check(
          'taster-session-persistence',
          'blocked',
          'TASTER_SESSION_PERSISTENCE_CHECK_FAILED',
          observedAt
        )
      );
    }

    try {
      const taster = await dependencies.inspectTasterSession();
      checks.push(
        check(
          'taster-session-readiness',
          taster.ready ? 'ready' : 'degraded',
          taster.ready ? 'TASTER_SESSION_READY' : 'TASTER_SESSION_FINDINGS',
          observedAt,
          {
            documentCount: taster.documentCount,
            blockerCount: taster.blockerCount,
          }
        )
      );
    } catch {
      checks.push(
        check(
          'taster-session-readiness',
          'degraded',
          'TASTER_SESSION_CHECK_FAILED',
          observedAt
        )
      );
    }

    try {
      const templates = await dependencies.inspectConsumedEmailTemplates();
      checks.push(
        check(
          'consumed-email-templates',
          templates.ready ? 'ready' : 'degraded',
          templates.ready
            ? 'CONSUMED_TEMPLATES_READY'
            : 'CONSUMED_TEMPLATES_INVALID',
          observedAt,
          {
            inspected: templates.inspected,
            invalidCount: templates.invalidCount,
          }
        )
      );
    } catch {
      checks.push(
        check(
          'consumed-email-templates',
          'degraded',
          'CONSUMED_TEMPLATES_CHECK_FAILED',
          observedAt
        )
      );
    }
  } else {
    for (const checkId of [
      'membership-application-banking-compatibility',
      'membership-application-banking',
      'taster-session-persistence',
      'taster-session-readiness',
      'consumed-email-templates',
    ]) {
      checks.push(
        check(checkId, 'unverified', 'MONGO_DEPENDENCY_UNAVAILABLE', observedAt)
      );
    }
  }

  try {
    const smtp = await dependencies.inspectSmtp(options.verifySmtp);
    checks.push(
      check(
        'smtp',
        !smtp.configured ? 'degraded' : smtp.verified ? 'ready' : 'unverified',
        !smtp.configured
          ? 'SMTP_CONFIGURATION_INCOMPLETE'
          : smtp.verified
            ? 'SMTP_TRANSPORT_VERIFIED'
            : 'SMTP_TRANSPORT_NOT_REQUESTED',
        observedAt
      )
    );
  } catch {
    checks.push(
      check('smtp', 'degraded', 'SMTP_TRANSPORT_UNAVAILABLE', observedAt)
    );
  }

  if (storageIsolated) {
    try {
      const files = await dependencies.inspectFileAccessibility();
      checks.push(
        check(
          'file-accessibility',
          files.accessible ? 'ready' : 'degraded',
          files.accessible
            ? 'FILE_ROOTS_ACCESSIBLE'
            : 'FILE_ROOTS_INACCESSIBLE',
          observedAt,
          { checkedRootCount: files.checkedRootCount }
        )
      );
    } catch {
      checks.push(
        check(
          'file-accessibility',
          'degraded',
          'FILE_ACCESS_CHECK_FAILED',
          observedAt
        )
      );
    }
  } else {
    checks.push(
      check(
        'file-accessibility',
        'unverified',
        'STORAGE_ISOLATION_REQUIRED',
        observedAt
      )
    );
  }

  if (mongoConnected) {
    await dependencies.disconnectMongo().catch(() => undefined);
  }

  return { status: overallStatus(checks), observedAt, checks };
}
