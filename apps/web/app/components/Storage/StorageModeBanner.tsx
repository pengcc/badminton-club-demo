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
        rounded-lg border p-3 sm:p-4 shadow-sm
        ${isLocal
          ? 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950'
          : 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
        }
      `}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {isLocal ? (
              <HardDrive className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            ) : (
              <Server className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className={`font-semibold text-xs sm:text-sm ${isLocal ? 'text-purple-900 dark:text-purple-100' : 'text-blue-900 dark:text-blue-100'}`}>
                {isLocal ? 'Local Storage Mode' : 'Server Storage Mode'}
              </p>
              <p className={`text-xs mt-0.5 ${isLocal ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'} line-clamp-2 sm:line-clamp-1`}>
                {isLocal
                  ? 'Instant access with browser storage'
                  : 'Full-stack with MongoDB (10-20 min start)'
                }
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
