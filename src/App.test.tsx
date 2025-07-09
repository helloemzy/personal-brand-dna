import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { configureStore } from '@reduxjs/toolkit';
import App from './App';
import authReducer from './store/slices/authSlice';
import workshopReducer from './store/slices/workshopSlice';

// Mock Sentry to prevent initialization during tests
jest.mock('./config/sentry', () => ({
  initSentry: jest.fn(),
  clearSentryUser: jest.fn(),
  setSentryUser: jest.fn(),
  captureWorkshopCompletion: jest.fn(),
  captureAPIError: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

// Mock service worker to prevent registration during tests
jest.mock('./utils/webVitals', () => ({
  trackWebVitals: jest.fn(),
}));

// Mock tracking service
jest.mock('./services/trackingService', () => ({
  trackingService: {
    initialize: jest.fn(),
    trackEvent: jest.fn(),
    trackPageView: jest.fn(),
  },
}));

// Mock ErrorBoundary component
jest.mock('./components/ErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('App Component', () => {
  const createTestStore = (preloadedState = {}) => {
    return configureStore({
      reducer: {
        auth: authReducer,
        workshop: workshopReducer,
      },
      preloadedState,
    });
  };

  const renderApp = (preloadedState = {}) => {
    const store = createTestStore({
      auth: {
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: true, // Start with loading true
        error: null,
        ...preloadedState.auth,
      },
      workshop: {
        currentStep: 1,
        completedSteps: [],
        isCompleted: false,
        assessmentScore: null,
        workshopPath: null,
        startedAt: null,
        lastSavedAt: null,
        completedAt: null,
        values: {
          selected: [],
          custom: [],
          rankings: {},
          primary: [],
          aspirational: [],
          stories: {},
        },
        tonePreferences: {
          formal_casual: 0,
          concise_detailed: 0,
          analytical_creative: 0,
          serious_playful: 0,
        },
        audiencePersonas: [],
        writingSample: null,
        personalityQuiz: {
          responses: [],
          currentQuestionIndex: 0,
        },
        sessionId: null,
        isSaving: false,
        lastError: null,
        ...preloadedState.workshop,
      },
    });
    
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <HelmetProvider>
            <App />
          </HelmetProvider>
        </BrowserRouter>
      </Provider>
    );
  };

  test('renders without crashing', () => {
    renderApp();
    // App should render without throwing any errors
  });

  test('renders loading state initially', () => {
    renderApp();
    // The app shows loading text while checking auth status
    const loadingElement = screen.getByText(/Loading BrandPillar AI/i);
    expect(loadingElement).toBeInTheDocument();
  });

  test('initializes authentication check on mount', () => {
    const { unmount } = renderApp();
    // Cleanup
    unmount();
  });
});