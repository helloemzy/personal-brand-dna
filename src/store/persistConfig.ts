/**
 * Redux Persist Configuration
 * Handles persistent storage of Redux state with performance optimizations
 */

import storage from 'redux-persist/lib/storage';
import { createTransform } from 'redux-persist';
import { REDUX_PERSIST_CONFIG } from '../config/performance';

// Transform to compress large objects before persisting
const compressTransform = createTransform(
  // Transform state on the way to being serialized and persisted
  (inboundState: any, key: string) => {
    // You can add compression logic here if needed
    return inboundState;
  },
  // Transform state being rehydrated
  (outboundState: any, key: string) => {
    // You can add decompression logic here if needed
    return outboundState;
  }
);

// Transform to limit the size of persisted data
const sizeLimitTransform = createTransform(
  (inboundState: any, key: string) => {
    // Check size and potentially trim data if too large
    const stateSize = JSON.stringify(inboundState).length;
    if (stateSize > REDUX_PERSIST_CONFIG.maxSize * 1024) {
      console.warn(`State for ${key} exceeds size limit. Consider trimming.`);
      // Implement trimming logic here
    }
    return inboundState;
  }
);

// Transform to handle date serialization
const dateTransform = createTransform(
  // Serialize dates to ISO strings
  (inboundState: any) => {
    const serialized = JSON.parse(JSON.stringify(inboundState, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }));
    return serialized;
  },
  // Deserialize ISO strings back to dates
  (outboundState: any) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    const deserialized = JSON.parse(JSON.stringify(outboundState, (key, value) => {
      if (typeof value === 'string' && dateRegex.test(value)) {
        return new Date(value);
      }
      return value;
    }));
    return deserialized;
  }
);

// Main persist configuration
export const persistConfig = {
  key: 'root',
  storage,
  whitelist: REDUX_PERSIST_CONFIG.persistKeys,
  blacklist: REDUX_PERSIST_CONFIG.blacklist,
  transforms: [compressTransform, sizeLimitTransform, dateTransform],
  debug: process.env.NODE_ENV === 'development',
  throttle: REDUX_PERSIST_CONFIG.debounce,
};

// Specific persist configs for different slices
export const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['user', 'token', 'refreshToken'],
  blacklist: ['isLoading', 'error'],
};

export const workshopPersistConfig = {
  key: 'workshop',
  storage,
  whitelist: ['values', 'tonePreferences', 'audiencePersonas', 'writingSample', 'personalityQuiz'],
  blacklist: ['currentStep', 'isLoading'],
  throttle: 2000, // Debounce workshop saves
};

export const contentPersistConfig = {
  key: 'content',
  storage,
  whitelist: ['drafts', 'templates'],
  blacklist: ['isGenerating', 'error'],
};

// Utility to clear persisted state
export const clearPersistedState = async () => {
  try {
    await storage.removeItem('persist:root');
    await storage.removeItem('persist:auth');
    await storage.removeItem('persist:workshop');
    await storage.removeItem('persist:content');
    console.log('Persisted state cleared');
  } catch (error) {
    console.error('Error clearing persisted state:', error);
  }
};

// Utility to get persisted state size
export const getPersistedStateSize = async () => {
  try {
    const keys = ['persist:root', 'persist:auth', 'persist:workshop', 'persist:content'];
    let totalSize = 0;
    
    for (const key of keys) {
      const data = await storage.getItem(key);
      if (data) {
        const size = new Blob([data]).size;
        totalSize += size;
        console.log(`${key}: ${(size / 1024).toFixed(2)} KB`);
      }
    }
    
    console.log(`Total persisted state size: ${(totalSize / 1024).toFixed(2)} KB`);
    return totalSize;
  } catch (error) {
    console.error('Error calculating persisted state size:', error);
    return 0;
  }
};