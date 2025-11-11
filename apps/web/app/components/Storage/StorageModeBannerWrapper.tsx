'use client';

import { useEffect, useState } from 'react';
import { StorageModeBanner } from './StorageModeBanner';

/**
 * Client-side wrapper for StorageModeBanner
 * Prevents hydration mismatch by only rendering after mount
 */
export function StorageModeBannerWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
    );
  }

  return <StorageModeBanner />;
}
