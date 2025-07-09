import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { createFilter } from 'redux-persist-transform-filter';

// Core reducers (always loaded)
import authReducer from './slices/authSlice';

// Lazy load heavy reducers
const workshopReducer = () => import('./slices/workshopSlice').then(module => module.default);
const contentReducer = () => import('./slices/contentSlice').then(module => module.default);
const subscriptionReducer = () => import('./slices/subscriptionSlice').then(module => module.default);
const analyticsReducer = () => import('./slices/analyticsSlice').then(module => module.default);
const rssFeedReducer = () => import('./slices/rssFeedSlice').then(module => module.default);
const contentSchedulingReducer = () => import('./slices/contentSchedulingSlice').then(module => module.default);

// Create filters for selective persistence
const authFilter = createFilter('auth', ['user', 'accessToken', 'refreshToken', 'isAuthenticated']);
const workshopFilter = createFilter('workshop', ['values', 'audiencePersonas', 'tonePreferences', 'writingSample', 'personalityQuiz', 'completedSteps']);

// Import migration configuration
import { workshopMigrate, WORKSHOP_MIGRATION_VERSION } from './migrations/workshopMigrations';

// Redux persist configuration
const persistConfig = {
  key: 'root',
  version: WORKSHOP_MIGRATION_VERSION,
  storage,
  whitelist: ['auth', 'workshop'], // Persist auth and workshop
  transforms: [authFilter],
  // Throttle persistence to reduce performance impact
  throttle: 1000,
  // Use workshop migration system
  migrate: workshopMigrate,
};

// Workshop persist config (separate to avoid double persistence)
const workshopPersistConfig = {
  key: 'workshop',
  storage,
  version: WORKSHOP_MIGRATION_VERSION,
  whitelist: ['values', 'audiencePersonas', 'tonePreferences', 'writingSample', 'personalityQuiz', 'completedSteps', 'currentStep', 'sessionId', 'startedAt', 'lastSavedAt'],
  transforms: [workshopFilter],
  throttle: 2000, // Less frequent saves for workshop
  migrate: workshopMigrate,
};

// Async reducer injection
class AsyncReducerManager {
  private reducers: Record<string, any> = {};
  private store: any = null;
  
  constructor(initialReducers: Record<string, any>) {
    this.reducers = initialReducers;
  }

  setStore(store: any) {
    this.store = store;
  }

  getReducerMap() {
    return this.reducers;
  }

  async injectReducer(key: string, asyncReducer: () => Promise<any>) {
    if (this.reducers[key]) {
      return; // Already loaded
    }

    const reducer = await asyncReducer();
    this.reducers[key] = reducer;

    if (this.store) {
      this.store.replaceReducer(this.createRootReducer());
    }
  }

  createRootReducer() {
    // Apply persistence only to specific reducers
    const persistedReducers: Record<string, any> = {
      auth: this.reducers.auth,
    };

    if (this.reducers.workshop) {
      persistedReducers.workshop = persistReducer(workshopPersistConfig, this.reducers.workshop);
    }

    return combineReducers({
      ...persistedReducers,
      // Non-persisted reducers
      content: this.reducers.content,
      subscription: this.reducers.subscription,
      analytics: this.reducers.analytics,
      rssFeeds: this.reducers.rssFeeds,
      contentScheduling: this.reducers.contentScheduling,
    });
  }
}

// Create async reducer manager
const asyncReducerManager = new AsyncReducerManager({
  auth: authReducer,
});

// Create root reducer
const rootReducer = asyncReducerManager.createRootReducer();

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store with optimizations
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredPaths: ['workshop._persist', '_persist'],
      },
      // Optimize for production
      immutableCheck: process.env.NODE_ENV !== 'production' ? true : false,
      thunk: {
        extraArgument: {
          // Add any extra arguments for thunks here
        },
      },
    }),
  devTools: process.env.NODE_ENV !== 'production' && {
    // Limit devtools features in production
    maxAge: 50,
    trace: false,
    traceLimit: 25,
    actionsBlacklist: ['@@INIT', '@@redux/INIT'],
  },
});

// Set store reference
asyncReducerManager.setStore(store);

// Export persistor
export const persistor = persistStore(store);

// Async reducer injection functions
export const injectReducers = {
  workshop: async () => {
    await asyncReducerManager.injectReducer('workshop', workshopReducer);
  },
  content: async () => {
    await asyncReducerManager.injectReducer('content', contentReducer);
  },
  subscription: async () => {
    await asyncReducerManager.injectReducer('subscription', subscriptionReducer);
  },
  analytics: async () => {
    await asyncReducerManager.injectReducer('analytics', analyticsReducer);
  },
  rssFeeds: async () => {
    await asyncReducerManager.injectReducer('rssFeeds', rssFeedReducer);
  },
  contentScheduling: async () => {
    await asyncReducerManager.injectReducer('contentScheduling', contentSchedulingReducer);
  },
};

// Types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Performance monitoring
if (process.env.NODE_ENV !== 'production') {
  // Monitor Redux performance
  let actionCount = 0;
  let lastReportTime = Date.now();

  store.subscribe(() => {
    actionCount++;
    const now = Date.now();
    
    // Report every 10 seconds
    if (now - lastReportTime > 10000) {
      console.log(`Redux: ${actionCount} actions in last 10s (${(actionCount / 10).toFixed(1)} actions/sec)`);
      actionCount = 0;
      lastReportTime = now;
    }
  });
}

// Preload critical reducers
export const preloadCriticalReducers = async () => {
  await Promise.all([
    injectReducers.workshop(),
    injectReducers.content(),
  ]);
};

// Export store utilities
export const storeUtils = {
  // Clear all persisted state
  clearPersistedState: async () => {
    await persistor.purge();
    localStorage.removeItem('persist:root');
    localStorage.removeItem('persist:workshop');
  },
  
  // Get current state size
  getStateSize: () => {
    const state = store.getState();
    return new Blob([JSON.stringify(state)]).size;
  },
  
  // Monitor state size
  monitorStateSize: () => {
    const interval = setInterval(() => {
      const sizeKB = (storeUtils.getStateSize() / 1024).toFixed(2);
      console.log(`Redux state size: ${sizeKB}KB`);
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  },
};