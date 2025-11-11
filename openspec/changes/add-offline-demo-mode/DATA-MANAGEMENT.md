# Data Management Features - Quick Reference

## Environment Control

### Feature Flag

```bash
# .env.local (development)
NEXT_PUBLIC_ENABLE_LOCAL_MODE=true

# .env.production (Vercel)
NEXT_PUBLIC_ENABLE_LOCAL_MODE=true  # or false to disable
```

### Usage

```typescript
// Conditionally show local mode option
const isEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_MODE === 'true';

if (!isEnabled) {
  return <ServerModeOnly />;  // Only show server mode
}

return <StorageModeSelector />;  // Show both modes
```

### Benefits

- ✅ Enable/disable without code changes
- ✅ Instant rollback via Vercel dashboard
- ✅ A/B testing capability
- ✅ Different settings per environment

---

## Data Management UI

### Location
Available in Account/Settings page when in Local Mode

### Features

#### 1. Storage Information
```
┌─────────────────────────────────────┐
│ Storage Used:            247.3 KB   │
│ Data stored in your browser's       │
│ IndexedDB                           │
└─────────────────────────────────────┘
```

#### 2. Clear All Data
```
┌─────────────────────────────────────┐
│ [🗑️ Clear All Local Data]          │
│                                     │
│ Removes all data and reloads       │
│ default demo data                  │
└─────────────────────────────────────┘
```

#### 3. Reset to Defaults
```
┌─────────────────────────────────────┐
│ [🔄 Reset to Default Demo Data]    │
│                                     │
│ Restore original demo users,       │
│ matches, and teams                 │
└─────────────────────────────────────┘
```

#### 4. Export/Import (Optional)
```
┌─────────────────────────────────────┐
│ Advanced                            │
│ ├─ [⬇️ Export Data (JSON)]         │
│ └─ [⬆️ Import Data (JSON)]         │
└─────────────────────────────────────┘
```

---

## User Workflows

### Workflow 1: Exploring Features
```
1. User selects Local Mode
2. Explores dashboard, creates users, schedules matches
3. Data accumulates
4. Wants to start fresh
5. Goes to Account → Data Management
6. Clicks "Reset to Default Demo Data"
7. Data restored to original state
8. Can explore again with clean slate
```

### Workflow 2: Clearing Everything
```
1. User has been testing extensively
2. Wants to remove all traces
3. Goes to Account → Data Management
4. Clicks "Clear All Local Data"
5. All data deleted from IndexedDB
6. Default demo data reloaded
7. Fresh start
```

### Workflow 3: Exporting/Importing (Future)
```
1. User creates interesting test data
2. Clicks "Export Data (JSON)"
3. Saves JSON file to computer
4. Shares with team/reviewer
5. They click "Import Data (JSON)"
6. Same data loaded in their browser
7. Can review exact same state
```

---

## LocalAdapter Methods

### Core Methods

```typescript
class LocalAdapter {
  // Data Management
  async clearAllData(): Promise<void>
  async getStorageSize(): Promise<number>
  async checkStorageQuota(): Promise<QuotaInfo>

  // Optional: Export/Import
  async exportData(): Promise<string>
  async importData(json: string): Promise<void>

  // Existing: CRUD operations
  async getUsers(params): Promise<UsersResponse>
  async createUser(data): Promise<User>
  // ... etc
}
```

### Storage Size Calculation

```typescript
async getStorageSize(): Promise<number> {
  if (!navigator.storage?.estimate) {
    return 0;
  }

  const estimate = await navigator.storage.estimate();
  return estimate.usage || 0;
}

// Usage
const size = await adapter.getStorageSize();
console.log(`${(size / 1024).toFixed(2)} KB`); // "247.3 KB"
```

### Quota Monitoring

```typescript
async checkStorageQuota() {
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const percentage = quota > 0 ? (usage / quota) * 100 : 0;

  return { usage, quota, percentage };
}

// Usage
const quota = await adapter.checkStorageQuota();
if (quota.percentage > 80) {
  toast.warning('Storage almost full');
}
```

### Export Data

```typescript
async exportData(): Promise<string> {
  const users = await this.db.users.toArray();
  const matches = await this.db.matches.toArray();
  const teams = await this.db.teams.toArray();
  const players = await this.db.players.toArray();

  return JSON.stringify({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: { users, matches, teams, players }
  }, null, 2);
}

// Usage
const json = await adapter.exportData();
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// Download file...
```

---

## UI Component Structure

```
DataManagement Component
├─ Storage Info Card
│  └─ Display size and quota
│
├─ Clear Data Section
│  ├─ Clear All Button (with confirmation)
│  └─ Description text
│
├─ Reset Section
│  ├─ Reset to Defaults Button (with confirmation)
│  └─ Description text
│
└─ Advanced Section (Optional)
   ├─ Export Button
   └─ Import Button
```

---

## Confirmation Dialogs

### Clear Data
```
┌────────────────────────────────────────┐
│ Clear all local data?                  │
│                                        │
│ This will reset to default demo data.  │
│                                        │
│ [Cancel]  [Clear Data]                 │
└────────────────────────────────────────┘
```

### Reset to Defaults
```
┌────────────────────────────────────────┐
│ Reset all data to original demo state? │
│                                        │
│ All changes will be lost.              │
│                                        │
│ [Cancel]  [Reset]                      │
└────────────────────────────────────────┘
```

---

## Toast Notifications

### Success Messages
- ✅ "Local data cleared and reset to defaults"
- ✅ "Data reset to defaults"
- ✅ "Data exported successfully"
- ✅ "Data imported successfully"

### Error Messages
- ❌ "Failed to clear data"
- ❌ "Failed to reset data"
- ❌ "Invalid import format"
- ❌ "Storage quota exceeded"

---

## Browser Compatibility

### Storage API Support
- ✅ Chrome 52+
- ✅ Firefox 51+
- ✅ Safari 15.2+
- ✅ Edge 79+

### IndexedDB Support
- ✅ Chrome 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ Edge 12+

**Coverage**: 95%+ of users

---

## Storage Limits

### Typical Quotas
- Desktop Chrome: ~60% of available disk space
- Mobile Chrome: ~15-50% of available space
- Firefox: ~10% of available disk space
- Safari: ~1GB per origin

### Demo Data Size
- Default seed data: ~2MB
- Typical after exploration: ~5-10MB
- Maximum realistic: ~50MB

**Conclusion**: Storage limits are not a concern for portfolio demo

---

## Testing Checklist

### Data Management Features
- [ ] Clear data removes all records
- [ ] Reset loads default demo data
- [ ] Storage size updates correctly
- [ ] Quota check works on all browsers
- [ ] Export creates valid JSON
- [ ] Import loads data correctly
- [ ] Confirmations prevent accidental deletion
- [ ] Toast notifications appear
- [ ] Page reloads after clear/reset
- [ ] Environment flag hides/shows feature

### Edge Cases
- [ ] Handle quota exceeded gracefully
- [ ] Handle corrupt import data
- [ ] Handle missing navigator.storage API
- [ ] Handle concurrent operations
- [ ] Handle page reload during operation

---

## Portfolio Benefits

### For Visitors
1. **Clean Slate**: Reset data anytime to explore fresh
2. **No Pollution**: Previous explorations don't affect new visits
3. **Transparency**: Clear info about data storage
4. **Control**: User decides when to clear

### For Developer (You)
1. **Professional**: Shows attention to user control
2. **Privacy**: Emphasizes local storage, no tracking
3. **Polished**: Proper data management UX
4. **Flexible**: Environment flag for easy control

### For Recruiters/Clients
1. **Trust**: Clear data management builds confidence
2. **Exploration**: Can test freely knowing they can reset
3. **Understanding**: Transparent about storage mechanism
4. **Convenience**: One-click return to demo defaults

---

## Summary

**Environment Control**:
- `NEXT_PUBLIC_ENABLE_LOCAL_MODE` flag
- Instant enable/disable without code changes
- Per-environment configuration

**Data Management**:
- Clear all data (with reset to defaults)
- Reset to original demo data
- View storage usage
- Optional export/import

**User Benefits**:
- Easy exploration with clean slate option
- Transparent storage information
- Full control over local data
- Professional UX

**Developer Benefits**:
- Feature flag for control
- Easy testing and demos
- No backend required for data reset
- Portfolio polish
