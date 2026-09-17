import { describe, expect, it } from 'vitest';
import { getApplicantSubmissionCorrectionFields } from '../../lib/api/membershipApplicationApi';

function axiosFailure(data: unknown): unknown {
  return { isAxiosError: true, response: { data } };
}

describe('Membership Application API error adapter', () => {
  it('returns only validated semantic submission correction fields', () => {
    expect(
      getApplicantSubmissionCorrectionFields(
        axiosFailure({
          success: false,
          error: 'Application has missing or invalid submission information',
          code: 'MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_FAILED',
          details: { fields: ['street', 'membershipType'] },
        })
      )
    ).toEqual(['street', 'membershipType']);
  });

  it.each([
    { fields: [] },
    { fields: ['personalInfo.address.rawSchemaPath'] },
    { fields: ['street'], submittedValue: 'Synthetic private value' },
  ])('rejects malformed or over-broad details %#', (details) => {
    expect(
      getApplicantSubmissionCorrectionFields(
        axiosFailure({
          success: false,
          error: 'Invalid',
          code: 'MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_FAILED',
          details,
        })
      )
    ).toBeUndefined();
  });

  it('rejects unrelated transport errors', () => {
    expect(
      getApplicantSubmissionCorrectionFields(
        axiosFailure({
          success: false,
          error: 'Invalid',
          code: 'VALIDATION_ERROR',
          details: { fields: ['street'] },
        })
      )
    ).toBeUndefined();
  });
});
