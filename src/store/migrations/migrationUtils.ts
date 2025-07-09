/**
 * Migration Utilities
 * Helper functions for managing redux-persist migrations
 */

import { persistor } from '../index';
import { clearPersistedState } from '../persistConfig';
import { manuallyMigrateWorkshopState, cleanCorruptedWorkshopState } from './workshopMigrations';

/**
 * Force a full purge and reload of persisted state
 * Use this when migrations fail or state is corrupted beyond repair
 */
export const forcePurgeAndReload = async () => {
  try {
    console.log('Starting force purge of persisted state...');
    
    // Pause persistence
    await persistor.pause();
    
    // Purge all persisted data
    await persistor.purge();
    
    // Clear from storage
    await clearPersistedState();
    
    // Force reload the page to start fresh
    window.location.reload();
  } catch (error) {
    console.error('Error during force purge:', error);
  }
};

/**
 * Attempt to recover workshop state from corruption
 * Tries migrations first, then falls back to clean state
 */
export const recoverWorkshopState = async () => {
  try {
    console.log('Attempting to recover workshop state...');
    
    // Get current persisted state
    const persistedData = await localStorage.getItem('persist:root');
    if (!persistedData) {
      console.log('No persisted data found');
      return;
    }
    
    const parsedData = JSON.parse(persistedData);
    const workshopData = parsedData.workshop ? JSON.parse(parsedData.workshop) : null;
    
    if (!workshopData) {
      console.log('No workshop data found');
      return;
    }
    
    // Try to migrate the data
    let recoveredData;
    try {
      recoveredData = manuallyMigrateWorkshopState(workshopData, 0);
      console.log('Successfully migrated workshop data');
    } catch (migrationError) {
      console.error('Migration failed, using clean state:', migrationError);
      recoveredData = cleanCorruptedWorkshopState();
    }
    
    // Update the persisted data
    parsedData.workshop = JSON.stringify(recoveredData);
    await localStorage.setItem('persist:root', JSON.stringify(parsedData));
    
    // Reload to apply changes
    window.location.reload();
  } catch (error) {
    console.error('Error recovering workshop state:', error);
    // As a last resort, purge everything
    await forcePurgeAndReload();
  }
};

/**
 * Debug utility to inspect current persisted state
 */
export const inspectPersistedState = async () => {
  try {
    const keys = ['persist:root', 'persist:auth', 'persist:workshop', 'persist:content'];
    const state: Record<string, any> = {};
    
    for (const key of keys) {
      const data = await localStorage.getItem(key);
      if (data) {
        try {
          state[key] = JSON.parse(data);
        } catch {
          state[key] = data;
        }
      }
    }
    
    console.log('Current persisted state:', state);
    return state;
  } catch (error) {
    console.error('Error inspecting persisted state:', error);
    return null;
  }
};

/**
 * Check if workshop state needs migration
 */
export const checkWorkshopMigrationNeeded = async (): Promise<boolean> => {
  try {
    const persistedData = await localStorage.getItem('persist:root');
    if (!persistedData) return false;
    
    const parsedData = JSON.parse(persistedData);
    const version = parsedData._persist?.version || 0;
    
    // Check if version is behind current
    const { WORKSHOP_MIGRATION_VERSION } = await import('./workshopMigrations');
    return version < WORKSHOP_MIGRATION_VERSION;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
};

/**
 * Global error handler for persistence issues
 * Add this to your app's error boundary or global error handler
 */
export const handlePersistenceError = (error: Error) => {
  console.error('Persistence error detected:', error);
  
  // Check if it's a Redux persist error
  if (error.message?.includes('persist') || error.message?.includes('_persist')) {
    console.log('Redux persist error detected, attempting recovery...');
    
    // Show user a friendly message
    const userConfirmed = window.confirm(
      'We detected an issue with your saved data. Would you like to reset and start fresh? Your progress will be lost.'
    );
    
    if (userConfirmed) {
      forcePurgeAndReload();
    } else {
      // Try to recover without user losing data
      recoverWorkshopState();
    }
  }
};

// Export utilities to window for emergency debugging
if (process.env.NODE_ENV === 'development') {
  (window as any).__persistDebug = {
    inspect: inspectPersistedState,
    recover: recoverWorkshopState,
    purge: forcePurgeAndReload,
    checkMigration: checkWorkshopMigrationNeeded,
  };
  
  console.log('Redux Persist debug utilities available at window.__persistDebug');
}