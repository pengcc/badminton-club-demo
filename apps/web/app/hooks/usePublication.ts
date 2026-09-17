'use client';

import { useState } from 'react';
import type { PublicationTarget } from '@club/shared-types/api/publication';
import { requestPublication } from '@app/lib/publication';

export function usePublication() {
  const [failedTarget, setFailedTarget] = useState<PublicationTarget | null>(
    null
  );
  const [isRetrying, setIsRetrying] = useState(false);

  const publish = async (target: PublicationTarget): Promise<boolean> => {
    try {
      await requestPublication(target);
      setFailedTarget(null);
      return true;
    } catch {
      setFailedTarget(target);
      return false;
    }
  };

  const retry = async (): Promise<boolean> => {
    if (!failedTarget) return true;
    setIsRetrying(true);
    try {
      await requestPublication(failedTarget);
      setFailedTarget(null);
      return true;
    } catch {
      return false;
    } finally {
      setIsRetrying(false);
    }
  };

  return {
    hasPublicationFailure: failedTarget !== null,
    isRetrying,
    publish,
    retry,
  };
}
