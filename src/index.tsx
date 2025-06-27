import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initPerformanceMonitoring, trackWebVitals } from './utils/performance';

// Initialize performance monitoring
initPerformanceMonitoring();

// Track Web Vitals
trackWebVitals((metric) => {
  // You can send metrics to your analytics service here
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vital] ${metric.name}: ${metric.value}`);
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);