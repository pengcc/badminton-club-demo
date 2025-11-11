'use client';

import { useState, useEffect } from 'react';
import { useStorage } from '@app/lib/storage';
import { Trash2, RotateCcw, Download, Upload, HardDrive, AlertCircle } from 'lucide-react';
import { Button } from '@app/components/ui/button';

/**
 * DataManagement Component
 *
 * Provides UI for managing local storage data:
 * - View storage usage
 * - Clear all data
 * - Reset to default demo data
 * - Export data (optional)
 * - Import data (optional)
 */
export function DataManagement() {
  const { mode, adapter } = useStorage();
  const [storageSize, setStorageSize] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Load storage size
  const loadStorageSize = async () => {
    if (!adapter?.getStorageSize) return;

    try {
      const size = await adapter.getStorageSize();
      setStorageSize(size);
    } catch (error) {
      console.error('Failed to get storage size:', error);
    }
  };

  // Load storage size on mount
  useEffect(() => {
    if (mode === 'local' && adapter) {
      loadStorageSize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, adapter]);

  // Clear all data
  const handleClearData = async () => {
    if (!adapter?.clearAllData) return;
    if (!confirm('Clear all local data? This will reset to default demo data.')) {
      return;
    }

    setLoading(true);
    try {
      await adapter.clearAllData();
      await loadStorageSize();
      alert('Local data cleared and reset to defaults');
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear data');
    } finally {
      setLoading(false);
    }
  };

  // Reset to defaults
  const handleResetToDefaults = async () => {
    if (!adapter?.clearAllData) return;
    if (!confirm('Reset all data to original demo state? All changes will be lost.')) {
      return;
    }

    setLoading(true);
    try {
      await adapter.clearAllData();
      await loadStorageSize();
      alert('Data reset to defaults');
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset data:', error);
      alert('Failed to reset data');
    } finally {
      setLoading(false);
    }
  };

  // Export data
  const handleExportData = async () => {
    if (!adapter?.exportData) return;

    setLoading(true);
    try {
      const json = await adapter.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `badminton-club-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  // Import data
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!adapter?.importData) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const json = await file.text();
      await adapter.importData(json);
      await loadStorageSize();
      alert('Data imported successfully');
      window.location.reload();
    } catch (error) {
      console.error('Failed to import data:', error);
      alert('Failed to import data. Please check the file format.');
    } finally {
      setLoading(false);
      event.target.value = ''; // Reset file input
    }
  };

  // Only show in local mode
  if (mode !== 'local' || !adapter) {
    return null;
  }

  const sizeInKB = (storageSize / 1024).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Local Storage Management</h3>
        <p className="text-sm text-gray-600 mt-1">
          Manage data stored in your browser&apos;s IndexedDB
        </p>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">Local Storage Mode</p>
          <p className="text-xs text-amber-700 mt-1">
            Data is stored only in your browser. Clearing browser data will delete all information.
          </p>
        </div>
      </div>

      {/* Storage Info */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <HardDrive className="w-5 h-5 text-gray-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Storage Used</p>
          <p className="text-xs text-gray-600 mt-1">{sizeInKB} KB</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadStorageSize}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Clear Data Section */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Clear Data</h4>
          <p className="text-xs text-gray-600 mt-1">
            Remove all data and reload default demo data
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleClearData}
          disabled={loading}
          className="w-full justify-start"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Local Data
        </Button>
      </div>

      {/* Reset Section */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Reset to Defaults</h4>
          <p className="text-xs text-gray-600 mt-1">
            Restore original demo users, matches, and teams
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleResetToDefaults}
          disabled={loading}
          className="w-full justify-start"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Default Demo Data
        </Button>
      </div>

      {/* Advanced Section */}
      <div className="pt-6 border-t border-gray-200">
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-900">Advanced</h4>
          <p className="text-xs text-gray-600 mt-1">
            Export or import data for backup or sharing
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleExportData}
            disabled={loading}
            className="flex-1 justify-start"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data (JSON)
          </Button>
          <label className="flex-1">
            <Button
              variant="outline"
              disabled={loading}
              className="w-full justify-start"
              asChild
            >
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Import Data (JSON)
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
}
