'use client';

import { useStorage } from '@app/lib/storage';
import { Server, HardDrive, X } from 'lucide-react';

interface StorageModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Storage Mode Selection Modal
 * Allows users to choose between server mode and local mode
 */
export function StorageModeModal({ isOpen, onClose }: StorageModeModalProps) {
  const { mode, setMode, isLoading } = useStorage();
  const isLocalModeEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_MODE === 'true';

  const handleModeSelect = (selectedMode: 'server' | 'local') => {
    setMode(selectedMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Storage Mode</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Select how you want to store and access your data
          </p>
        </div>

        {/* Mode Options */}
        <div className="space-y-4">
          {/* Server Mode Option */}
          <button
            onClick={() => handleModeSelect('server')}
            disabled={isLoading}
            className={`
              w-full p-4 rounded-lg border-2 transition-all text-left
              ${mode === 'server'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800'}
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-start gap-3">
              <Server className={`h-6 w-6 mt-1 ${mode === 'server' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Server Mode</h3>
                  {mode === 'server' && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Full-stack authentication with MongoDB Atlas
                </p>
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                    ⚠️ First load may take 10-20 minutes (free tier hosting - backend wakes up from sleep)
                  </p>
                </div>
              </div>
            </div>
          </button>

          {/* Local Mode Option */}
          {isLocalModeEnabled ? (
            <button
              onClick={() => handleModeSelect('local')}
              disabled={isLoading}
              className={`
                w-full p-4 rounded-lg border-2 transition-all text-left
                ${mode === 'local'
                  ? 'border-green-600 bg-green-50 dark:bg-green-950'
                  : 'border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-800'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-start gap-3">
                <HardDrive className={`h-6 w-6 mt-1 ${mode === 'local' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Local Mode</h3>
                    {mode === 'local' && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                      Recommended
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Browser-based storage (IndexedDB) - Instant access
                  </p>
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <p className="text-xs text-green-800 dark:text-green-200">
                      ✓ Loads instantly (no backend required)<br />
                      ✓ All features available offline<br />
                      ✓ Data stored in your browser
                    </p>
                  </div>
                </div>
              </div>
            </button>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Local mode is not enabled in this environment.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You can change the storage mode anytime from your account settings.
          </p>
        </div>
      </div>
    </div>
  );
}
