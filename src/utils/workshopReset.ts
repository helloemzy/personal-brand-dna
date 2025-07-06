/**
 * Utility to reset workshop state when encountering errors
 */

export const resetWorkshopState = async () => {
  try {
    // Clear workshop specific storage
    localStorage.removeItem('persist:workshop');
    
    // Clear the entire root state if needed
    // localStorage.removeItem('persist:root');
    
    console.log('Workshop state has been reset');
    return true;
  } catch (error) {
    console.error('Failed to reset workshop state:', error);
    return false;
  }
};

export const clearAllPersistedState = async () => {
  try {
    // Get all localStorage keys
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('persist:')) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all persist keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('All persisted state has been cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear persisted state:', error);
    return false;
  }
};

// Add a debug function to check the current state
export const debugWorkshopState = () => {
  try {
    const workshopState = localStorage.getItem('persist:workshop');
    const rootState = localStorage.getItem('persist:root');
    
    console.group('Workshop State Debug');
    console.log('Workshop State:', workshopState ? JSON.parse(workshopState) : 'Not found');
    console.log('Root State:', rootState ? JSON.parse(rootState) : 'Not found');
    console.groupEnd();
  } catch (error) {
    console.error('Failed to debug workshop state:', error);
  }
};