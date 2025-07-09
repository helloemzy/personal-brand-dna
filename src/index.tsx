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

// Initialize Sentry before anything else
initSentry();

// Initialize performance monitoring
initPerformanceMonitoring();

// Setup accessibility testing in development
setupAxe();

// Track Web Vitals
trackWebVitals((metric) => {
  // You can send metrics to your analytics service here
  if (process.env['NODE_ENV'] === 'development') {
    console.log(`[Web Vital] ${metric.name}: ${metric.value}`);
  }
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