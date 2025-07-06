# Debug Guide for Workshop Values Selection Issue

## Problem
The Brand House workshop crashes with "Something went wrong" when selecting values (especially after 3 selections).

## Debugging Steps

### 1. Clear All State (Browser Console)
```javascript
// Run this in browser console to completely reset state
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 2. Enable Redux DevTools Debugging
```javascript
// In browser console, check Redux state
if (window.__REDUX_DEVTOOLS_EXTENSION__) {
  const state = window.__REDUX_DEVTOOLS_EXTENSION__.getState();
  console.log('Current Redux State:', state);
  console.log('Workshop State:', state.workshop);
}
```

### 3. Monitor for Errors
Open browser DevTools and watch for:
- Console errors (red text)
- Network failures
- Redux action failures

### 4. Test Incrementally
1. Navigate to Brand House
2. Open console
3. Select first value - check console
4. Select second value - check console
5. Select third value - check console
6. Select fourth value - THIS IS WHERE IT USUALLY CRASHES

### 5. Check for Common Issues

#### Redux Persistence Conflict
Look for this in Redux DevTools state:
```javascript
{
  workshop: {
    _persist: { ... },  // This shouldn't be here
    values: { ... }
  }
}
```

#### Corrupted State
If you see undefined or null where arrays should be:
```javascript
{
  workshop: {
    values: {
      selected: null,  // Should be []
      custom: undefined,  // Should be []
      rankings: "string"  // Should be {}
    }
  }
}
```

### 6. Emergency Fix
If the workshop is completely broken:

1. **Clear State and Try Again**:
```javascript
// Run in console
localStorage.removeItem('persist:root');
localStorage.removeItem('persist:workshop');
location.reload();
```

2. **Use Incognito/Private Mode**:
- This starts with completely fresh state
- If it works in incognito but not regular mode, it's a state corruption issue

3. **Check for Browser Extensions**:
- Disable all extensions (especially Redux DevTools)
- Some extensions can interfere with React apps

### 7. Collect Debug Info
If the issue persists, collect this info:

```javascript
// Run in console when error occurs
console.log('=== DEBUG INFO ===');
console.log('URL:', window.location.href);
console.log('User Agent:', navigator.userAgent);
console.log('Local Storage Keys:', Object.keys(localStorage));
console.log('Session Storage Keys:', Object.keys(sessionStorage));

// Get Redux state safely
try {
  const state = JSON.parse(localStorage.getItem('persist:root') || '{}');
  console.log('Persisted State:', state);
} catch (e) {
  console.log('Error reading persisted state:', e);
}
```

### 8. Temporary Workaround
If you need to continue testing other features:

1. Use the "Reset Workshop" button in the error boundary
2. Or manually navigate to: `/dashboard`
3. Try a different browser or device

## Root Cause Analysis

The issue is likely one of:
1. **Double Redux Persistence**: Workshop state being saved twice
2. **Redux DevTools Crash**: DevTools can't serialize the state
3. **State Corruption**: Previous bad state is being rehydrated
4. **Type Mismatch**: Arrays becoming strings/null during persistence

## Solution Applied

We've implemented:
1. ✅ Removed double persistence configuration
2. ✅ Added proper state selectors with safety checks
3. ✅ Enhanced error handling in components
4. ✅ Added state validation helpers
5. ✅ Improved error boundary logging

If the issue still occurs after these fixes, it may be a browser-specific issue or corrupted localStorage that needs clearing.