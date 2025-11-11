'use client';

import { useStorage } from '@app/lib/storage';
import { Server, HardDrive } from 'lucide-react';

/**
 * StorageModeIndicator Component
 *
 * Shows a small badge indicating the current storage mode
 * Can be placed in headers, navigation bars, etc.
 */
export function StorageModeIndicator() {
  const { mode, isLocalModeEnabled } = useStorage();

  // Don't show indicator if local mode is disabled
  if (!isLocalModeEnabled) {
    return null;
  }

  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
      ${mode === 'server'
        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
        : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
      }
    `}>
      {mode === 'server' ? (
        <>
          <Server className="h-3.5 w-3.5" />
          <span>Server Mode</span>
        </>
      ) : (
        <>
          <HardDrive className="h-3.5 w-3.5" />
          <span>Local Mode</span>
        </>
      )}
    </div>
  );
}

/**
 * StorageModeBanner Component
 *
 * Shows a full-width banner at the top of the page indicating storage mode
 * Useful for development/demo environments
 */
export function StorageModeBanner() {
  const { mode, setMode, isLocalModeEnabled } = useStorage();

  // Don't show banner if local mode is disabled
  if (!isLocalModeEnabled) {
    return null;
  }

  return (
    <div className={`
      w-full px-4 py-2 text-sm
      ${mode === 'server'
        ? 'bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100 border-b border-blue-200 dark:border-blue-800'
        : 'bg-purple-50 dark:bg-purple-950 text-purple-900 dark:text-purple-100 border-b border-purple-200 dark:border-purple-800'
      }
    `}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mode === 'server' ? (
            <>
              <Server className="h-4 w-4" />
              <span>
                <strong>Server Mode:</strong> Using backend API and MongoDB
              </span>
            </>
          ) : (
            <>
              <HardDrive className="h-4 w-4" />
              <span>
                <strong>Local Mode:</strong> Data stored in browser (IndexedDB)
              </span>
            </>
          )}
        </div>

        <button
          onClick={() => setMode(mode === 'server' ? 'local' : 'server')}
          className="text-xs font-medium underline hover:no-underline"
        >
          Switch to {mode === 'server' ? 'Local' : 'Server'} Mode
        </button>
      </div>
    </div>
  );
}
