import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter } from 'react-router-dom';
import { initSentry } from './config/sentry';
import './index.css';
import App from './App';
import { store, persistor } from './store';
import { initPerformanceMonitoring, trackWebVitals } from './utils/performance';
import { setupAxe } from './utils/axeSetup';
import { validateEnvironment } from './utils/envValidation';
import { logger } from './utils/logger';

// Validate environment variables before app startup
try {
  validateEnvironment();
} catch (error) {
  logger.error('Environment validation failed:', error);
  // In production, show error to user
  if (process.env.NODE_ENV === 'production') {
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui;">
        <div style="text-align: center; padding: 2rem;">
          <h1 style="color: #ef4444;">Configuration Error</h1>
          <p style="color: #6b7280;">The application is not properly configured. Please contact support.</p>
        </div>
      </div>
    `;
    throw error;
  }
}

// Initialize Sentry before anything else
initSentry();

// Initialize performance monitoring
initPerformanceMonitoring();

// Setup accessibility testing in development
setupAxe();

// Track Web Vitals
trackWebVitals((metric) => {
  // You can send metrics to your analytics service here
  logger.debug(`[Web Vital] ${metric.name}: ${metric.value}`);
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);