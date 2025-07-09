# Redux Persist Migrations System

This migration system handles state structure changes over time for the workshop slice, preventing crashes when the state structure evolves.

## Overview

The migration system automatically runs when the app loads and detects an older version of persisted state. It transforms the old state structure to match the current expected structure.

## Migration Versions

- **Version 0 → 1**: Removes nested `_persist` metadata that can cause Redux DevTools crashes
- **Version 1 → 2**: Fixes array structures and ensures proper initialization
- **Version 2 → 3**: Adds missing fields and ensures complete structure matching WorkshopState interface

Current version: **3**

## Usage

### Automatic Migrations

Migrations run automatically when the app loads. No manual intervention is needed in most cases.

### Manual Recovery (Browser Console)

If the app crashes due to corrupted state, you can use these utilities in the browser console:

```javascript
// Inspect current persisted state
window.__persistDebug.inspect()

// Check if migration is needed
window.__persistDebug.checkMigration()

// Attempt automatic recovery
window.__persistDebug.recover()

// Force purge and restart (last resort - loses all data)
window.__persistDebug.purge()
```

### Adding New Migrations

When the workshop state structure changes:

1. Update `workshopMigrations.ts`:
```typescript
// Add new migration function
const migration3to4 = (state: PersistedState): PersistedState => {
  console.log('Running workshop migration 3 → 4: Your description here');
  // Transform state...
  return newState;
};

// Add to manifest
export const workshopMigrations: MigrationManifest = {
  1: migration0to1,
  2: migration1to2,
  3: migration2to3,
  4: migration3to4, // New migration
};

// Update version
export const WORKSHOP_MIGRATION_VERSION = 4;
```

2. The migration will run automatically on next app load

## Error Handling

The migration system includes several safety mechanisms:

1. **Try-Catch Blocks**: Each migration is wrapped in error handling
2. **State Validation**: Ensures state exists before transforming
3. **Clean State Fallback**: If migrations fail, provides a clean initial state
4. **Manual Recovery Tools**: Browser console utilities for debugging

## Best Practices

1. **Test Migrations**: Always test with real corrupted state data
2. **Incremental Changes**: Make small, focused migrations
3. **Preserve User Data**: Never delete user data unless absolutely necessary
4. **Version Bumping**: Always increment the version when adding migrations
5. **Console Logging**: Include descriptive logs for debugging

## Troubleshooting

### App Won't Load
1. Open browser console
2. Run `window.__persistDebug.inspect()` to see current state
3. Run `window.__persistDebug.recover()` to attempt recovery
4. If that fails, run `window.__persistDebug.purge()` to start fresh

### Migration Not Running
1. Check that version number was incremented
2. Verify migration is added to manifest
3. Check browser console for error messages
4. Ensure persistConfig imports the migrations

### State Still Corrupted After Migration
1. The migration may not cover all edge cases
2. Update the migration function to handle the specific corruption
3. Test with the actual corrupted state data
4. Consider adding more defensive checks

## Development Tools

In development mode, the following are available:

- Redux DevTools integration (with sanitization to prevent crashes)
- Console logging of migration progress
- Debug utilities at `window.__persistDebug`
- Detailed error messages

## Production Considerations

- Migrations run silently in production
- Errors are caught and handled gracefully
- Users see a loading state during migration
- Failed migrations fall back to clean state