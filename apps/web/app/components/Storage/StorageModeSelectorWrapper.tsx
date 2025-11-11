'use client';

import { useEffect, useState } from 'react';
import { StorageModeSelector } from './StorageModeSelector';

/**
 * Client-side wrapper for StorageModeSelector
 * Prevents hydration mismatch by only rendering after mount
 */
export function StorageModeSelectorWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full max-w-2xl mx-auto h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
    );
  }

  return <StorageModeSelector />;
}
