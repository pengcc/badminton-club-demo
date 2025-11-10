import apiClient from './client';
import type { Api } from '@club/shared-types/api/pdf';

/**
 * PDF Generation API module
 * Handles all PDF generation HTTP requests with full type safety
 */

/**
 * Generate membership application PDF
 */
export const generateMembershipApplicationPDF = async (
  applicationData: Api.MembershipPdfRequest
): Promise<Blob> => {
  const response = await apiClient.post<Blob>(
    '/pdf/membership-application',
    applicationData,
    {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf',
      },
    }
  );
  return response.data;
};

/**
 * Generate SEPA mandate PDF
 */
export const generateSEPAMandatePDF = async (
  personalInfo: Api.MembershipPdfRequest['personalInfo'],
  bankingInfo: Api.SepaMandateRequest
): Promise<Blob> => {
  const response = await apiClient.post<Blob>(
    '/pdf/sepa-mandate',
    {
      personalInfo,
      bankingInfo,
    },
    {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf',
      },
    }
  );
  return response.data;
};

/**
 * Generate complete membership package PDF (application + SEPA mandate)
 */
export const generateMembershipPackagePDF = async (
  applicationData: Api.MembershipPackageRequest
): Promise<Blob> => {
  const response = await apiClient.post<Blob>(
    '/pdf/membership-package',
    applicationData,
    {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf',
      },
    }
  );
  return response.data;
};
