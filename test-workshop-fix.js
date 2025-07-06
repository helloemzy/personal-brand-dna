#!/usr/bin/env node

/**
 * Test script to verify the Brand House Workshop fix
 * Run this in the browser console at https://brandpillar-ai.vercel.app
 */

console.log('🧪 Starting Brand House Workshop Test...\n');

// Step 1: Check if Redux store exists
if (!window.store) {
  console.error('❌ Redux store not found. Make sure you\'re on the app and logged in.');
  console.log('💡 Try: window.__REDUX_DEVTOOLS_EXTENSION__.store');
} else {
  console.log('✅ Redux store found');
}

// Step 2: Enable debugging
console.log('\n📊 Enabling workshop debugging...');
if (window.enableWorkshopDebugging) {
  window.enableWorkshopDebugging();
  console.log('✅ Workshop debugging enabled');
} else {
  console.log('⚠️  Workshop debugging function not found');
}

// Step 3: Check current workshop state
console.log('\n📋 Current Workshop State:');
const state = window.store?.getState();
if (state?.workshop) {
  console.log('Selected values:', state.workshop.values?.selected || []);
  console.log('Custom values:', state.workshop.values?.custom || []);
  console.log('Current step:', state.workshop.currentStep);
  console.log('Has _persist?', '_persist' in state.workshop);
} else {
  console.log('❌ No workshop state found');
}

// Step 4: Check localStorage
console.log('\n💾 LocalStorage Check:');
const persistRoot = localStorage.getItem('persist:root');
const persistWorkshop = localStorage.getItem('persist:workshop');
console.log('persist:root exists:', !!persistRoot);
console.log('persist:root size:', persistRoot ? (persistRoot.length / 1024).toFixed(2) + ' KB' : 'N/A');
console.log('persist:workshop exists:', !!persistWorkshop);
console.log('persist:workshop size:', persistWorkshop ? (persistWorkshop.length / 1024).toFixed(2) + ' KB' : 'N/A');

// Step 5: Test value selection (simulate)
console.log('\n🎯 Testing Value Selection (Simulation):');
console.log('To test manually:');
console.log('1. Navigate to /brand-house');
console.log('2. Try selecting 5 values one by one');
console.log('3. Watch the console for debug logs');
console.log('4. If it crashes, note the error message');

// Step 6: Recovery options
console.log('\n🛠️  Recovery Options:');
console.log('Option 1: Add ?reset=true to URL');
console.log('Option 2: Run: localStorage.clear(); location.reload();');
console.log('Option 3: Use incognito/private browsing mode');

// Step 7: Manual test steps
console.log('\n📝 Manual Test Steps:');
console.log('1. Clear state: localStorage.clear(); location.reload();');
console.log('2. Login with Google');
console.log('3. Go to Brand House (/brand-house)');
console.log('4. Enable debugging: window.enableWorkshopDebugging();');
console.log('5. Select values one by one');
console.log('6. Check console for errors after each selection');
console.log('7. If crash occurs, check Redux DevTools');

console.log('\n✅ Test script complete. Follow the manual steps above to verify the fix.');