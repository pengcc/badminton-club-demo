'use client';

import { useState } from 'react';
import { StorageModeModal } from './StorageModeModal';
import { Settings, HardDrive, Server } from 'lucide-react';
import { useStorage } from '@app/lib/storage';

/**
 * StorageModeBanner Component
 *
 * Displays current storage mode with button to open modal for switching
 * Designed for homepage and other pages where mode visibility is helpful
 */
export function StorageModeBanner() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { mode, isLocalModeEnabled } = useStorage();

  // Only show if local mode is enabled
  if (!isLocalModeEnabled) return null;

  const isLocal = mode === 'local';

  return (
    <>
      <div className={`
        rounded-lg border p-4 shadow-sm
        ${isLocal
          ? 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950'
          : 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
        }
      `}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isLocal ? (
              <HardDrive className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            ) : (
              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            )}
            <div>
              <p className={`font-semibold text-sm ${isLocal ? 'text-purple-900 dark:text-purple-100' : 'text-blue-900 dark:text-blue-100'}`}>
                {isLocal ? 'Local Storage Mode' : 'Server Storage Mode'}
              </p>
              <p className={`text-xs mt-0.5 ${isLocal ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'}`}>
                {isLocal
                  ? 'Instant access with browser storage (IndexedDB)'
                  : 'Full-stack with MongoDB (may take 10-20 min to start)'
                }
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
          >
            <Settings className="h-4 w-4" />
            Change Mode
          </button>
        </div>
      </div>

      <StorageModeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
