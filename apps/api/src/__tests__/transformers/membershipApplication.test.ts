import { describe, it, expect } from '@jest/globals';
import { MembershipApplicationApiTransformer, MembershipApplicationPersistenceTransformer } from '../../transformers/membershipApplication';
import { Domain } from '@club/shared-types/domain/membershipApplication';
import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import type { MembershipApplicationPersistenceType } from '../../types/persistence/membershipApplication';

describe('MembershipApplication Transformers - dateOfBirth handling', () => {
  it('fromCreateRequest preserves dateOfBirth as string', () => {
    const request = {
      personalInfo: {
        firstName: 'Alice',
        lastName: 'Tester',
        email: 'alice@example.com',
        phone: '+49123456789',
        dateOfBirth: '1990-01-15',
        gender: 'female',
        address: { street: 'X', city: 'Y', postalCode: '12345', country: 'DE' }
      },
      membershipType: 'regular',
      hasConditions: false,
      canParticipate: true
    } as any;

    const result = MembershipApplicationApiTransformer.fromCreateRequest(request);
    expect(result.personalInfo.dateOfBirth).toBe('1990-01-15');
    expect(typeof result.personalInfo.dateOfBirth).toBe('string');
  });

  it('toApi returns dateOfBirth string unchanged', () => {
    const domain: Domain.MembershipApplication = {
      id: 'uuid-1234',
      personalInfo: {
        firstName: 'Bob',
        lastName: 'Tester',
        email: 'bob@example.com',
        phone: '+49123456789',
        dateOfBirth: '1985-12-01',
        gender: 'male',
        address: { street: 'A', city: 'B', postalCode: '54321', country: 'DE' }
      },
      membershipType: 'student',
      bankingInfo: undefined,
      canParticipate: true,
      motivation: undefined,
      hasConditions: false,
      conditions: undefined,
      status: MemberApplicationStatus.PENDING_REVIEW as any,
      documents: {},
      reviewer: undefined,
      reviewDate: undefined,
      reviewNotes: undefined,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-02T00:00:00Z')
    };

    const api = MembershipApplicationApiTransformer.toApi(domain);
    expect(api.personalInfo.dateOfBirth).toBe('1985-12-01');
    expect(typeof api.personalInfo.dateOfBirth).toBe('string');
  });

  it('toDomain preserves dateOfBirth from persistence string', () => {
    const persistence: MembershipApplicationPersistenceType = {
      _id: '665544332211' as any,
      personalInfo: {
        firstName: 'Carol',
        lastName: 'Tester',
        email: 'carol@example.com',
        phone: '+49123456789',
        dateOfBirth: '2000-06-30',
        gender: 'female',
        address: { street: 'S', city: 'C', postalCode: '10115', country: 'DE' }
      },
      membershipType: 'regular',
      bankingInfo: undefined as any,
      canParticipate: true,
      motivation: undefined as any,
      hasConditions: false,
      conditions: undefined as any,
      status: MemberApplicationStatus.PENDING_REVIEW as any,
      documents: {},
      reviewer: undefined as any,
      reviewDate: undefined as any,
      reviewNotes: undefined as any,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-02T00:00:00Z')
    };

  const domain = MembershipApplicationPersistenceTransformer.toDomain(persistence as any);
    expect(domain.personalInfo.dateOfBirth).toBe('2000-06-30');
    expect(typeof domain.personalInfo.dateOfBirth).toBe('string');
  });
});
