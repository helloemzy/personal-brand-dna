import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import { combineReducers } from '@reduxjs/toolkit';
import { persistConfig } from './persistConfig';
import { configureReduxDevTools } from '../utils/reduxDevtools';
import { errorLoggerMiddleware } from './middleware/errorLogger';
import { workshopDebuggerMiddleware } from './middleware/workshopDebugger';

// Import slices
import authSlice from './slices/authSlice';
import voiceSlice from './slices/voiceSlice';
import contentSlice from './slices/contentSlice';
import analyticsSlice from './slices/analyticsSlice';
import subscriptionSlice from './slices/subscriptionSlice';
import uiSlice from './slices/uiSlice';
import workshopSlice from './slices/workshopSlice';
import newsSlice from './slices/newsSlice';

// Root reducer
const rootReducer = combineReducers({
  auth: authSlice,
  voice: voiceSlice,
  content: contentSlice,
  analytics: analyticsSlice,
  subscription: subscriptionSlice,
  ui: uiSlice,
  workshop: workshopSlice, // Fixed: Remove double persistence
  news: newsSlice,
});

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          FLUSH, 
          REHYDRATE, 
          PAUSE, 
          PERSIST, 
          PURGE, 
          REGISTER,
          'workshop/selectValue',
          'workshop/deselectValue',
          'workshop/rankValue',
          'workshop/addCustomValue',
          'workshop/updateTonePreferences',
          'workshop/addAudiencePersona',
          'workshop/setWritingSample',
          'workshop/submitQuizAnswer',
        ],
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp', 'payload.date'],
        ignoredPaths: [
          '_persist',
          'register', 
          'rehydrate',
          'workshop.lastSavedAt',
          'workshop.sessionStartedAt',
        ],
      },
    }).concat(errorLoggerMiddleware, workshopDebuggerMiddleware),
  devTools: process.env.NODE_ENV !== 'production' && {
    serialize: {
      options: {
        undefined: true,
        function: false,
        symbol: false,
      },
    },
    actionSanitizer: (action: { type?: string; [key: string]: unknown }) => {
      // Sanitize workshop actions to prevent DevTools crashes
      if (action.type && action.type.startsWith('workshop/')) {
        return { ...action, _sanitized: true };
      }
      return action;
    },
    stateSanitizer: (state: RootState & { _persist?: unknown }) => {
      // Remove _persist metadata from state display to prevent DevTools issues
      if (state._persist) {
        const { _persist, ...stateWithoutPersist } = state;
        return stateWithoutPersist;
      }
      return state;
    },
  },
});

// Create persistor
export const persistor = persistStore(store);

// Types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store for testing
export default store;