/**
 * Storage Provider Context
 *
 * Provides storage adapter (Server or Local) to the entire application.
 * Handles mode switching and adapter instantiation.
 *
 * ARCHITECTURE RULES:
 * - Single source of truth for storage mode
 * - Lazy initialization of LocalAdapter
 * - Environment flag control via NEXT_PUBLIC_ENABLE_LOCAL_MODE
 * - Mode persisted in localStorage
 * - ServerAdapter is default (safe fallback)
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { StorageAdapter } from './StorageAdapter';
import { ServerAdapter } from './ServerAdapter';

// Storage mode type
export type StorageMode = 'server' | 'local';

// Context value interface
interface StorageContextValue {
  adapter: StorageAdapter;
  mode: StorageMode;
  setMode: (mode: StorageMode) => void;
  isLocalModeEnabled: boolean;
}

// Create context
const StorageContext = createContext<StorageContextValue | undefined>(undefined);

// Check if local mode is enabled via environment variable
const isLocalModeEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_ENABLE_LOCAL_MODE === 'true';
};

// Get saved mode from localStorage
const getSavedMode = (): StorageMode => {
  if (typeof window === 'undefined') {
    return 'server'; // Default to server on SSR
  }

  try {
    const saved = localStorage.getItem('storage-mode');
    if (saved === 'local' && isLocalModeEnabled()) {
      return 'local';
    }
  } catch (error) {
    console.warn('Failed to read storage mode from localStorage:', error);
  }

  return 'server'; // Default to server
};

// Save mode to localStorage
const saveMode = (mode: StorageMode): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('storage-mode', mode);
  } catch (error) {
    console.warn('Failed to save storage mode to localStorage:', error);
  }
};

interface StorageProviderProps {
  children: React.ReactNode;
  defaultMode?: StorageMode;
}

/**
 * StorageProvider Component
 *
 * Wraps the application and provides storage adapter access
 */
export const StorageProvider: React.FC<StorageProviderProps> = ({
  children,
  defaultMode
}) => {
  const [mode, setModeState] = useState<StorageMode>(() => {
    // Use provided defaultMode or get from localStorage
    if (defaultMode) return defaultMode;
    return getSavedMode();
  });

  const [localAdapter, setLocalAdapter] = useState<StorageAdapter | null>(null);

  // Load LocalAdapter dynamically when needed
  useEffect(() => {
    if (mode === 'local' && !localAdapter) {
      // Dynamic import to avoid loading LocalAdapter code in server mode
      import('./LocalAdapter').then(module => {
        const adapter = new module.LocalAdapter();
        setLocalAdapter(adapter);
      }).catch(error => {
        console.error('Failed to load LocalAdapter:', error);
        // Fallback to server mode if LocalAdapter fails to load
        setModeState('server');
        saveMode('server');
      });
    }
  }, [mode, localAdapter]);

  // Get the active adapter
  const adapter = useMemo<StorageAdapter>(() => {
    if (mode === 'local' && localAdapter) {
      return localAdapter;
    }
    // Default to ServerAdapter
    return new ServerAdapter();
  }, [mode, localAdapter]);

  // Mode setter with persistence
  const setMode = (newMode: StorageMode): void => {
    // Check if local mode is allowed
    if (newMode === 'local' && !isLocalModeEnabled()) {
      console.warn('Local mode is disabled. Set NEXT_PUBLIC_ENABLE_LOCAL_MODE=true to enable.');
      return;
    }

    setModeState(newMode);
    saveMode(newMode);

    // Clear localAdapter if switching to server mode
    if (newMode === 'server') {
      setLocalAdapter(null);
    }
  };

  const value: StorageContextValue = {
    adapter,
    mode,
    setMode,
    isLocalModeEnabled: isLocalModeEnabled()
  };

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
};

/**
 * Hook to access storage adapter and mode
 *
 * @example
 * ```tsx
 * const { adapter, mode, setMode } = useStorage();
 * const users = await adapter.getUsers();
 * ```
 */
export const useStorage = (): StorageContextValue => {
  const context = useContext(StorageContext);

  if (context === undefined) {
    throw new Error('useStorage must be used within a StorageProvider');
  }

  return context;
};

/**
 * Hook to access storage adapter directly
 * Convenience hook for components that only need the adapter
 *
 * @example
 * ```tsx
 * const adapter = useStorageAdapter();
 * const users = await adapter.getUsers();
 * ```
 */
export const useStorageAdapter = (): StorageAdapter => {
  const { adapter } = useStorage();
  return adapter;
};
