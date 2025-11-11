'use client';

import { useStorage } from '@app/lib/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/components/ui/card';
import { Server, HardDrive, AlertCircle } from 'lucide-react';

/**
 * StorageModeSelector Component
 *
 * Allows users to choose between server mode and local mode
 * Displays warnings about cold start times for server mode
 */
export function StorageModeSelector() {
  const { mode, setMode, isLoading } = useStorage();

  // Check if local mode is enabled via environment variable
  const isLocalModeEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_MODE === 'true';

  // If local mode is disabled, only show server mode
  if (!isLocalModeEnabled) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Storage Mode</CardTitle>
          <CardDescription>
            Server mode is active. All data is stored on the backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">Server Mode Active</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Full-stack authentication with MongoDB Atlas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Choose Storage Mode</CardTitle>
        <CardDescription>
          Local mode is the default for instant access. Server mode requires backend startup (10-20 minutes on Render free tier).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server Mode Option */}
        <button
          onClick={() => setMode('server')}
          disabled={isLoading}
          className={`
            w-full p-4 rounded-lg border-2 transition-all text-left
            ${mode === 'server'
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-start gap-3">
            <Server className={`h-6 w-6 mt-0.5 ${mode === 'server' ? 'text-blue-600' : 'text-gray-600'}`} />
            <div className="flex-1">
              <h3 className={`font-semibold mb-1 ${mode === 'server' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}`}>
                Server Mode
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Full-stack demonstration with backend API and MongoDB
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                  Full Features
                </span>
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                  Authentication
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Server Mode Warning */}
        {mode === 'server' && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-100">
              <strong>Note:</strong> Current deployment on Render free tier is experiencing extended cold starts (10-20 minutes).
              Working on securing a new free instance with better uptime. For immediate access, please use Local Mode.
            </div>
          </div>
        )}

        {/* Local Mode Option */}
        <button
          onClick={() => setMode('local')}
          disabled={isLoading}
          className={`
            w-full p-4 rounded-lg border-2 transition-all text-left
            ${mode === 'local'
              ? 'border-purple-600 bg-purple-50 dark:bg-purple-950'
              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-start gap-3">
            <HardDrive className={`h-6 w-6 mt-0.5 ${mode === 'local' ? 'text-purple-600' : 'text-gray-600'}`} />
            <div className="flex-1">
              <h3 className={`font-semibold mb-1 ${mode === 'local' ? 'text-purple-900 dark:text-purple-100' : 'text-gray-900 dark:text-gray-100'}`}>
                Local Mode
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Instant access with data stored in your browser (IndexedDB)
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded">
                  {mode === 'local' ? 'Active' : 'Default'}
                </span>
                <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                  Instant Load
                </span>
                <span className="text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded">
                  Browser Only
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Local Mode Info */}
        {mode === 'local' && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Local Mode:</strong> All data is stored in your browser&apos;s IndexedDB.
              Data persists between sessions but is specific to this browser.
              Perfect for exploring features without waiting for server wake-up.
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Switching storage mode...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
