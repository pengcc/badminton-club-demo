import { z } from 'zod';
import { Gender, MembershipStatus, MembershipType } from '../core/enums';
import { AccountOnboardingTargetKind } from '../domain/accountOnboarding';
import {
  addressSchema,
  dateOfBirthSchema,
  emailSchema,
  nameSchema,
  phoneSchema,
} from './user';

export const accountOnboardingIdentitySchema = z
  .object({
    email: z.preprocess(
      (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
      emailSchema
    ),
    firstName: nameSchema.transform((value) => value.trim()),
    lastName: nameSchema.transform((value) => value.trim()),
    dateOfBirth: dateOfBirthSchema,
    gender: z.nativeEnum(Gender),
    phone: phoneSchema.optional(),
    address: addressSchema.optional(),
  })
  .strict();

const memberEstablishmentSchema = accountOnboardingIdentitySchema.extend({
  targetKind: z.literal(AccountOnboardingTargetKind.MEMBER),
  establishPlayer: z.boolean(),
  initialMembershipStatus: z.union([
    z.literal(MembershipStatus.ACTIVE),
    z.literal(MembershipStatus.PASSIVE),
  ]),
  membershipType: z.nativeEnum(MembershipType).optional(),
  setupLocale: z.enum(['de', 'en', 'zh']).default('de'),
  sendPasswordSetupEmailNow: z.boolean().default(false),
});

const externalPlayerEstablishmentSchema =
  accountOnboardingIdentitySchema.extend({
    targetKind: z.literal(AccountOnboardingTargetKind.EXTERNAL_PLAYER),
    establishPlayer: z.literal(true),
    initialMembershipStatus: z.never().optional(),
    membershipType: z.never().optional(),
    setupLocale: z.enum(['de', 'en', 'zh']).default('de'),
  });

export const accountEstablishmentSchema = z.discriminatedUnion('targetKind', [
  memberEstablishmentSchema,
  externalPlayerEstablishmentSchema,
]);

export const directMemberEstablishmentSchema = memberEstablishmentSchema.extend(
  {
    establishPlayer: z.literal(false),
  }
);

export type AccountEstablishmentInput = z.infer<
  typeof accountEstablishmentSchema
>;
export type DirectMemberEstablishmentInput = z.infer<
  typeof directMemberEstablishmentSchema
>;
