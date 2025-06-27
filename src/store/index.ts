import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';
import { persistConfig } from './persistConfig';

// Import slices
import authSlice from './slices/authSlice.ts';
import voiceSlice from './slices/voiceSlice.ts';
import contentSlice from './slices/contentSlice.ts';
import analyticsSlice from './slices/analyticsSlice.ts';
import subscriptionSlice from './slices/subscriptionSlice.ts';
import uiSlice from './slices/uiSlice.ts';
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
  workshop: workshopSlice,
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
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: ['_persist', 'register', 'rehydrate'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Create persistor
export const persistor = persistStore(store);

// Types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store for testing
export default store;