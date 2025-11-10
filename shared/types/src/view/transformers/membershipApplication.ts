import { Domain } from '../../domain/membershipApplication';
import { BaseTransformer } from './base';
import {
  AddressView,
  PersonalInfoView,
  BankingInfoView,
  MembershipApplicationView,
  membershipApplicationViewSchema
} from '../membershipApplication';

/**
 * View layer transformer for membership application data
 */
export class MembershipApplicationTransformer extends BaseTransformer {
  /**
   * Transform domain address to view address
   */
  private static toAddressView(address: Domain.Address): AddressView {
    return {
      street: address.street,
      city: address.city,
      postalCode: address.postalCode,
      country: address.country
    };
  }

  /**
   * Transform domain personal info to view personal info
   */
  private static toPersonalInfoView(info: Domain.PersonalInfo): PersonalInfoView {
    return {
      firstName: info.firstName,
      lastName: info.lastName,
      email: info.email,
      phone: info.phone,
      dateOfBirth: this.toDate(info.dateOfBirth) || '',
      gender: info.gender,
      address: this.toAddressView(info.address)
    };
  }

  /**
   * Transform domain banking info to view banking info
   */
  private static toBankingInfoView(info: Domain.BankingInfo): BankingInfoView {
    return {
      accountHolderType: info.accountHolderType,
      accountHolderFirstName: info.accountHolderFirstName,
      accountHolderLastName: info.accountHolderLastName,
      accountHolderAddress: info.accountHolderAddress,
      bankName: info.bankName,
      bic: info.bic,
      iban: info.iban,
      debitFrequency: info.debitFrequency
    };
  }

  /**
   * Transform application data for frontend display
   */
  static toApplicationView(app: Domain.MembershipApplication): MembershipApplicationView {
    const view: MembershipApplicationView = {
      id: app.id,
      personalInfo: this.toPersonalInfoView(app.personalInfo),
      membershipType: app.membershipType,
      bankingInfo: app.bankingInfo
        ? this.toBankingInfoView(app.bankingInfo)
        : undefined,
      canParticipate: app.canParticipate,
      motivation: app.motivation,
      hasConditions: app.hasConditions,
      conditions: app.conditions,
      status: app.status,
      documents: {
        application: app.documents.application,
        sepaMandate: app.documents.sepaMandate
      },
      reviewer: app.reviewer,
      reviewDate: app.reviewDate ? this.toDate(app.reviewDate) : undefined,
      reviewNotes: app.reviewNotes,
      createdAt: this.toDate(app.createdAt) || '',
      updatedAt: this.toDate(app.updatedAt) || ''
    };

    return this.validate(view, membershipApplicationViewSchema);
  }

  /**
   * Transform array of domain membership applications to view types
   */
  public static toMembershipApplicationViews(
    applications: Domain.MembershipApplication[]
  ): MembershipApplicationView[] {
    return applications.map(app => this.toApplicationView(app));
  }
}