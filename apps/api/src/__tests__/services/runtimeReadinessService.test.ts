import { describe, expect, it } from 'vitest';
import { RuntimeReadinessService } from '../../services/runtimeReadinessService';

describe('RuntimeReadinessService', () => {
  it('reports listening state and stable unique degradation reason codes', () => {
    const service = new RuntimeReadinessService();

    expect(service.snapshot()).toEqual({
      listening: false,
      degradationReasonCodes: [],
    });

    service.recordDegradation(
      'MEMBERSHIP_APPLICATION_RETENTION_SCHEDULER_UNAVAILABLE'
    );
    service.recordDegradation('MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE');
    service.recordDegradation('MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE');
    service.markListening();

    expect(service.snapshot()).toEqual({
      listening: true,
      degradationReasonCodes: [
        'MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE',
        'MEMBERSHIP_APPLICATION_RETENTION_SCHEDULER_UNAVAILABLE',
      ],
    });
  });
});
