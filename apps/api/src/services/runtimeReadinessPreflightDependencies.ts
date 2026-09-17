import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import { config } from '../config';
import { EmailTemplate } from '../models/EmailTemplate';
import { membershipApplicationBankingIntegrityService } from './membershipApplicationBankingIntegrityService';
import {
  findEmailTemplateContractViolations,
  SYSTEM_EMAIL_TEMPLATE_CONTRACTS,
} from './emailTemplateSystemContract';
import { runRuntimeReadinessPreflight } from './runtimeReadinessPreflightService';
import {
  inspectFileAccessibility,
  inspectStorageIsolation,
} from './runtimeReadinessStorageService';
import { inspectConfiguredSmtp } from './runtimeReadinessSmtpService';
import {
  inspectTasterSessionReadiness,
  inspectTasterSessionReleasePrerequisite,
} from './tasterSessionReadinessService';

async function inspectConsumedEmailTemplates() {
  const names = SYSTEM_EMAIL_TEMPLATE_CONTRACTS.map(({ name }) => name);
  const templates = await EmailTemplate.find({ name: { $in: names } })
    .select('name body isActive')
    .lean();
  const byName = new Map(
    templates.map((template) => [template.name, template])
  );
  let invalidCount = 0;

  for (const contract of SYSTEM_EMAIL_TEMPLATE_CONTRACTS) {
    const template = byName.get(contract.name);
    if (
      !template ||
      !template.isActive ||
      findEmailTemplateContractViolations(contract.name, template.body).length >
        0
    ) {
      invalidCount += 1;
    }
  }

  return { ready: invalidCount === 0, inspected: names.length, invalidCount };
}

async function inspectSmtp(verifyTransport: boolean) {
  return inspectConfiguredSmtp(config.smtp, verifyTransport, (options) =>
    nodemailer.createTransport(options)
  );
}

export async function runConfiguredRuntimeReadinessPreflight(options: {
  verifySmtp: boolean;
}) {
  return runRuntimeReadinessPreflight(
    {
      nodeMajorVersion: Number.parseInt(
        process.versions.node.split('.')[0] ?? '',
        10
      ),
      connectMongo: () =>
        mongoose
          .connect(config.mongoUri, { autoIndex: false })
          .then(() => undefined),
      disconnectMongo: () => mongoose.disconnect(),
      inspectMongoTransactionSupport: async () => {
        const database = mongoose.connection.db;
        if (!database) return false;
        const hello = await database.admin().command({ hello: 1 });
        return Boolean(hello.setName || hello.msg === 'isdbgrid');
      },
      inspectStorageIsolation: () =>
        inspectStorageIsolation(
          [config.publicUploadsRoot],
          config.privateUploadsRoot
        ),
      retainedPublicUploadsCoherent: !config.alternateDevelopmentDatabase,
      inspectMembershipApplicationBankingCompatibility: async () =>
        membershipApplicationBankingIntegrityService.inspectReleaseCompatibility(),
      inspectMembershipApplicationBanking: async () => {
        const report =
          await membershipApplicationBankingIntegrityService.verifyReady();
        return {
          ready: report.ready,
          inspected: report.inspected,
          findingCount: report.findings.length,
        };
      },
      inspectTasterSessionPersistence: async () => {
        const report = await inspectTasterSessionReleasePrerequisite(
          mongoose.connection
        );
        return {
          ready: report.ready,
          pendingMissingOrUnnormalizedEmailCount:
            report.pendingMissingOrUnnormalizedEmailCount,
          duplicatePendingNormalizedEmailGroups:
            report.duplicatePendingNormalizedEmailGroups,
          duplicatePendingDocuments: report.duplicatePendingDocuments,
          compatibleIndexCount: report.index.compatible ? 1 : 0,
          conflictingNamedIndexCount: report.index.conflictingNamedIndex
            ? 1
            : 0,
        };
      },
      inspectTasterSession: async () => {
        const report = await inspectTasterSessionReadiness(mongoose.connection);
        return {
          ready: report.readyForDeployment,
          documentCount: report.documentCount,
          blockerCount:
            report.blockers.length + (report.index.compatible ? 0 : 1),
        };
      },
      inspectConsumedEmailTemplates,
      inspectSmtp,
      inspectFileAccessibility: () =>
        inspectFileAccessibility([
          config.publicUploadsRoot,
          config.privateUploadsRoot,
        ]),
    },
    options
  );
}
