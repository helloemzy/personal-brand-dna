# Workshop State Debugging Guide

## Current Issue Status (January 7, 2025)

The Brand House Workshop crashes with "Something went wrong" when users select values. Despite multiple fixes, the issue persists.

## Quick Fixes for Users

### Option 1: URL Reset (Easiest)
```
https://brandpillar-ai.vercel.app/?reset=true
```
This will clear all persisted state and give you a fresh start.

### Option 2: Browser Console Reset
```javascript
// Open browser console (F12) and run:
localStorage.clear();
location.reload();
```

### Option 3: Incognito Mode
Use a private/incognito browser window to avoid any persisted state issues.

## For Developers: Debugging Steps

### 1. Enable Debug Mode
```javascript
// In browser console:
window.enableWorkshopDebugging();
```
This will log detailed information about every workshop action.

### 2. Access Debug Panel (Development Only)
Navigate to: `/debug-workshop`

This page shows:
- Current workshop state
- localStorage usage
- Debug action buttons

### 3. Check Console for Errors
Look for these specific error patterns:
- `Redux middleware error` - Issue with action processing
- `Workshop error detected` - Workshop-specific error
- `WARNING: More than 10 values selected` - State corruption
- `CRITICAL: Selected values is not an array` - Severe state corruption
- `WARNING: _persist metadata found` - Persistence issue

### 4. Analyze Redux DevTools
1. Open Redux DevTools (browser extension)
2. Look for the action that causes the crash
3. Check the state diff
4. Look for `_persist` metadata in state

## Root Cause Analysis

### Primary Issues Identified:
1. **Redux Persist Configuration** - Workshop state was being persisted at multiple levels
2. **Array Serialization** - Selected values array might be corrupted during persistence
3. **DevTools Serialization** - Redux DevTools can't handle certain state structures

### Already Applied Fixes:
1. ✅ Removed double persistence configuration
2. ✅ Added null safety checks to all workshop actions
3. ✅ Enhanced Redux DevTools configuration
4. ✅ Added state validation helpers
5. ✅ Created error boundaries
6. ✅ Added debugging middleware
7. ✅ Implemented state reset mechanism

## Testing the Fix

### Step 1: Clear State
```bash
# Add ?reset=true to URL or run in console:
localStorage.clear();
```

### Step 2: Test Workshop Flow
1. Go to `/brand-house`
2. Select 5-10 values (one at a time)
3. Check console for any errors
4. Complete all workshop steps

### Step 3: Verify Persistence
1. Refresh the page
2. Check if selected values are preserved
3. Continue workshop from where you left off

## Emergency Recovery

If the workshop is completely broken:

### 1. Nuclear Reset
```javascript
// This will clear EVERYTHING
Object.keys(localStorage).forEach(key => localStorage.removeItem(key));
sessionStorage.clear();
location.href = '/';
```

### 2. Disable Workshop Persistence (Temporary)
In `src/config/performance.ts`, remove 'workshop' from persistKeys:
```typescript
persistKeys: [
  'auth',
  // 'workshop', // Temporarily disabled
  'userPreferences',
  'contentDrafts',
],
```

### 3. Use Session Storage Instead
Modify `src/store/persistConfig.ts`:
```typescript
import sessionStorage from 'redux-persist/lib/storage/session';
// Use sessionStorage instead of localStorage for workshop
```

## Monitoring for Recurrence

### Set Up Error Tracking
1. Enable workshop debugging permanently for affected users
2. Monitor browser console for patterns
3. Check Redux DevTools for state anomalies

### Key Metrics to Track
- Number of values selected when crash occurs
- Browser and version
- Size of localStorage before crash
- Specific action that triggers crash

## Prevention Measures

1. **Add E2E Tests**: Test selecting 10+ values repeatedly
2. **Limit Array Sizes**: Enforce hard limits in reducers
3. **Validate State Shape**: Add runtime validation
4. **Monitor Storage Size**: Warn when approaching limits
5. **Implement Gradual Rollout**: Test with small user group first

## Contact for Help

If the issue persists:
1. Collect browser console logs
2. Export Redux DevTools state
3. Note exact steps to reproduce
4. Check localStorage size
5. Report at: https://github.com/anthropics/claude-code/issues