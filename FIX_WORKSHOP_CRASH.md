# Workshop Crash Fix

## Root Cause
The workshop is crashing due to two issues:

1. **Overly aggressive state validation** in WorkshopContainer that resets the workshop on every render if it detects any issue with the state structure
2. **Workshop API returning 503 errors** because Supabase is not configured in production

## Quick Fix

### Option 1: Remove the problematic validation (Recommended)
In `src/components/workshop/WorkshopContainer.tsx`, comment out or remove lines 98-110:

```typescript
// Remove this entire useEffect block:
/*
useEffect(() => {
  // Check if workshop state is corrupted
  if (!workshopState || 
      !workshopState.values || 
      !Array.isArray(workshopState.values.selected) ||
      typeof workshopState.values.rankings !== 'object') {
    console.error('Workshop state is corrupted, resetting...', workshopState);
    dispatch(resetWorkshop());
    dispatch(startWorkshop());
    return;
  }
}, [workshopState, dispatch]);
*/
```

### Option 2: Fix the validation logic
Replace the validation with a one-time check:

```typescript
// Only validate once on mount, not on every render
useEffect(() => {
  // Check if this is the first mount and state needs initialization
  if (!workshopState.startedAt && !workshopState.sessionId) {
    // Only reset if truly uninitialized
    if (!workshopState.values || !Array.isArray(workshopState.values.selected)) {
      console.log('Initializing workshop state...');
      dispatch(resetWorkshop());
      dispatch(startWorkshop());
    }
  }
}, []); // Empty dependency array - only run once
```

### Option 3: Disable API calls temporarily
Also comment out the auto-save functionality to prevent API errors:

```typescript
// In WorkshopContainer, comment out the debounced save:
// Debounced save function
// const debouncedSave = useMemo(
//   () => debouncedFunctions.workshopSave(saveWorkshopProgress),
//   [saveWorkshopProgress]
// );

// And the useEffect that triggers it:
// useEffect(() => {
//   if (workshopState.sessionId && !workshopState.isSaving) {
//     debouncedSave();
//   }
// }, [workshopState, debouncedSave]);
```

## Long-term Fix

1. **Configure Supabase properly** in Vercel with the correct environment variables
2. **Improve state initialization** to use the workshop state helper properly
3. **Add proper error handling** for API failures
4. **Re-enable persistence** once the state management is fixed

## Testing
After applying the fix:
1. Clear browser state: `localStorage.clear()`
2. Refresh the page
3. Try selecting multiple traits
4. Should work without crashes