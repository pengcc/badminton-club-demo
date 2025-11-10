import type { Domain } from '../domain/pdf';

/**
 * API types for PDF operations
 */
export namespace Api {
  // Request types
  export interface GeneratePdfRequest {
    template: string;
    data: Record<string, unknown>;
    config?: Domain.PdfConfig;
  }

  export interface MembershipPdfRequest {
    personalInfo: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      dateOfBirth: string;
      gender: string;
      address: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
      };
    };
    membershipType: 'regular' | 'student';
  }

  export interface SepaMandateRequest {
    accountHolder: string;
    iban: string;
    bic: string;
    bankName: string;
    accountHolderAddress: string;
    debitFrequency: 'quarterly' | 'annually';
  }

  export interface MembershipPackageRequest extends MembershipPdfRequest {
    bankingInfo: SepaMandateRequest;
  }

  // Response types
  export interface GeneratePdfResponse {
    document: Domain.PdfDocument;
  }

  export interface PdfGenerationError {
    message: string;
    code: string;
    details?: {
      template?: string;
      data?: Record<string, unknown>;
    };
  }
}