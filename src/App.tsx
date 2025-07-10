import { useEffect, Suspense, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import * as Sentry from '@sentry/react';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { checkAuthStatus, setCredentials, clearAuth } from './store/slices/authSlice';
import { supabase } from './services/supabaseClient';
import { initSentry } from './config/sentry';
import { useSentryTracking } from './hooks/useSentryTracking';
import { trackingService } from './services/trackingService';
import { lazyWithPreload, preloadOnIdle, lazyWithRetry } from './utils/lazyWithPreload';
import LazyLoadingFallback, { 
  WorkshopLoadingFallback, 
  DashboardLoadingFallback,
  ContentLoadingFallback,
  AnalyticsLoadingFallback 
} from './components/LazyLoadingFallback';

// Initialize i18n
import './i18n/config';

// Initialize Sentry as early as possible
initSentry();

// Eagerly loaded critical components
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';

// Lazy loaded with preload capability
const RegisterPage = lazyWithPreload(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazyWithPreload(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithPreload(() => import('./pages/auth/ResetPasswordPage'));
const PhoneLoginPage = lazyWithPreload(() => import('./pages/auth/PhoneLoginPage'));
const GoogleLoginPage = lazyWithPreload(() => import('./pages/auth/GoogleLoginPage'));
const AuthCallbackPage = lazyWithPreload(() => import('./pages/auth/AuthCallbackPage'));
const GetStartedPage = lazyWithPreload(() => import('./pages/GetStartedPage'));

// Protected Pages with retry capability
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
const ContentGenerationPage = lazyWithRetry(() => import('./pages/ContentGenerationPage'));
const ContentHistoryPage = lazyWithRetry(() => import('./pages/ContentHistoryPage'));
const AnalyticsPage = lazyWithRetry(() => import('./pages/AnalyticsPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const SubscriptionPage = lazyWithRetry(() => import('./pages/SubscriptionPage'));
const TierSelectionPage = lazyWithRetry(() => import('./pages/TierSelectionPage'));
const RSSSetupPage = lazyWithRetry(() => import('./pages/RSSSetupPage'));
const EnhancedRSSSetupPage = lazyWithRetry(() => import('./pages/EnhancedRSSSetupPage'));
const NewsMonitoringPage = lazyWithRetry(() => import('./pages/NewsMonitoringPage'));
const ContentApprovalDashboard = lazyWithRetry(() => import('./pages/ContentApprovalDashboard'));
const LinkedInCallbackPage = lazyWithRetry(() => import('./pages/LinkedInCallbackPage'));
// const ContentCalendarPage = lazyWithRetry(() => import('./pages/ContentCalendarPage'));
const AnalyticsDashboardPage = lazyWithRetry(() => import('./pages/AnalyticsDashboardPage'));
const UserAnalyticsDashboard = lazyWithRetry(() => import('./pages/UserAnalyticsDashboard'));
const AnalyticsSettingsPage = lazyWithRetry(() => import('./pages/AnalyticsSettingsPage'));
const FeedbackAnalyticsPage = lazyWithRetry(() => import('./pages/FeedbackAnalyticsPage'));

// Workshop components with special handling
const WorkshopContainer = lazyWithPreload(() => import('./components/workshop/WorkshopContainer'));
const PreWorkshopAssessment = lazyWithPreload(() => import('./components/workshop/PreWorkshopAssessment'));
const WorkshopSessionsPage = lazyWithPreload(() => import('./pages/WorkshopSessionsPage'));
const WorkshopResultsPage = lazyWithPreload(() => import('./pages/WorkshopResultsPage'));
const SharedResultsPage = lazyWithPreload(() => import('./pages/SharedResultsPage'));
const ResultsHistoryPage = lazyWithPreload(() => import('./pages/ResultsHistoryPage'));

// Development only components
const DebugWorkshopPage = process.env.NODE_ENV === 'development' 
  ? lazyWithRetry(() => import('./pages/DebugWorkshopPage'))
  : null;

// Optional feature components loaded on demand
const PrivacyConsentBanner = lazyWithRetry(() => import('./components/PrivacyConsentBanner'));
const AccessibilityAudit = lazyWithRetry(() => import('./components/accessibility/AccessibilityAudit'));
const KeyboardShortcuts = lazyWithRetry(() => import('./components/accessibility/KeyboardShortcuts'));
const DiagnosticTools = lazyWithRetry(() => import('./components/DiagnosticTools'));
const LiveNotificationSystem = lazyWithRetry(() => import('./components/notifications/LiveNotificationSystem'));

// Create Sentry-enhanced router for performance monitoring
const SentryRoutes = Sentry.withSentryRouting(Routes);

function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);
  const [showPrivacyBanner, setShowPrivacyBanner] = useState(false);
  
  // Track user context and navigation in Sentry
  useSentryTracking();

  // Initialize analytics with user context
  useEffect(() => {
    if (user?.id) {
      trackingService.setUserId(user.id);
    }
  }, [user]);

  // Check if we need to show privacy banner
  useEffect(() => {
    const privacySettings = trackingService.getPrivacySettings();
    if (!privacySettings.consentGiven) {
      setShowPrivacyBanner(true);
    }
  }, []);

  // Preload commonly used routes when idle
  useEffect(() => {
    if (isAuthenticated) {
      // Preload dashboard and common authenticated routes
      preloadOnIdle(DashboardPage);
      preloadOnIdle(WorkshopContainer);
      preloadOnIdle(ContentGenerationPage);
    } else {
      // Preload auth routes
      preloadOnIdle(RegisterPage);
      preloadOnIdle(GetStartedPage);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Check for state reset request in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
      console.log('State reset requested - clearing persisted data');
      
      try {
        // Clear all localStorage data
        ['persist:root', 'persist:workshop', 'persist:auth', 'persist:content']
          .forEach(key => localStorage.removeItem(key));
        
        // Clear workshop-specific data
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('workshop_') || key.startsWith('brandhouse_')) {
            localStorage.removeItem(key);
          }
        });
        
        // Reload without reset parameter
        urlParams.delete('reset');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.location.href = newUrl;
      } catch (error) {
        console.error('Error clearing state:', error);
        window.location.href = window.location.pathname;
      }
      return;
    }

    // Check for existing Supabase session
    const checkSupabaseSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          dispatch(setCredentials({
            user: {
              id: session.user.id,
              email: session.user.email || '',
              firstName: session.user.user_metadata?.full_name?.split(' ')[0] || session.user.user_metadata?.name?.split(' ')[0] || '',
              lastName: session.user.user_metadata?.full_name?.split(' ')[1] || session.user.user_metadata?.name?.split(' ')[1] || '',
              subscriptionTier: 'free',
              subscriptionStatus: 'active',
              isVerified: session.user.email_confirmed_at ? true : false,
              createdAt: session.user.created_at,
              updatedAt: session.user.updated_at || session.user.created_at,
            },
            accessToken: session.access_token,
            refreshToken: session.refresh_token || null,
          }));
        } else {
          dispatch(checkAuthStatus());
        }
      } catch (error) {
        console.error('Session check error:', error);
        dispatch(checkAuthStatus());
      }
    };

    checkSupabaseSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      
      if (event === 'SIGNED_IN' && session) {
        dispatch(setCredentials({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            firstName: session.user.user_metadata?.full_name?.split(' ')[0] || session.user.user_metadata?.name?.split(' ')[0] || '',
            lastName: session.user.user_metadata?.full_name?.split(' ')[1] || session.user.user_metadata?.name?.split(' ')[1] || '',
            subscriptionTier: 'free',
            subscriptionStatus: 'active',
            isVerified: session.user.email_confirmed_at ? true : false,
            createdAt: session.user.created_at,
            updatedAt: session.user.updated_at || session.user.created_at,
          },
          accessToken: session.access_token,
          refreshToken: session.refresh_token || null,
        }));
      } else if (event === 'SIGNED_OUT') {
        dispatch(clearAuth());
      } else if (event === 'TOKEN_REFRESHED' && session) {
        dispatch(setCredentials({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            firstName: session.user.user_metadata?.full_name?.split(' ')[0] || session.user.user_metadata?.name?.split(' ')[0] || '',
            lastName: session.user.user_metadata?.full_name?.split(' ')[1] || session.user.user_metadata?.name?.split(' ')[1] || '',
            subscriptionTier: 'free',
            subscriptionStatus: 'active',
            isVerified: session.user.email_confirmed_at ? true : false,
            createdAt: session.user.created_at,
            updatedAt: session.user.updated_at || session.user.created_at,
          },
          accessToken: session.access_token,
          refreshToken: session.refresh_token || null,
        }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  // Set document metadata
  useEffect(() => {
    document.documentElement.lang = 'en';
    if (!document.title) {
      document.title = 'BrandPillar AI - Build Your Personal Brand';
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading BrandPillar AI...</p>
        </div>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <div className="App min-h-screen bg-gray-50">
          <Toast />
          
          {/* Privacy Consent Banner */}
          {showPrivacyBanner && (
            <Suspense fallback={null}>
            <PrivacyConsentBanner onClose={() => setShowPrivacyBanner(false)} />
          </Suspense>
        )}
        
        {/* Lazy load accessibility features */}
        <Suspense fallback={null}>
          <AccessibilityAudit />
          <KeyboardShortcuts />
        </Suspense>
        
        {/* Live Notification System */}
        {isAuthenticated && (
          <Suspense fallback={null}>
            <LiveNotificationSystem position="top-right" enableSound={true} enableBrowserNotifications={true} />
          </Suspense>
        )}
        
        <SentryRoutes>
          {/* Public Routes */}
          <Route path="/" element={
            <PublicRoute>
              <PublicLayout>
                <LandingPage />
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/login" element={
            <PublicRoute>
              <PublicLayout>
                <LoginPage />
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/phone-login" element={
            <PublicRoute>
              <PublicLayout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <PhoneLoginPage />
                </Suspense>
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/google-login" element={
            <PublicRoute>
              <PublicLayout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <GoogleLoginPage />
                </Suspense>
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/auth/callback" element={
            <Suspense fallback={<LoadingSpinner />}>
              <AuthCallbackPage />
            </Suspense>
          } />
          
          <Route path="/linkedin/callback" element={
            <Suspense fallback={<LoadingSpinner />}>
              <LinkedInCallbackPage />
            </Suspense>
          } />
          
          <Route path="/get-started" element={
            <PublicRoute>
              <PublicLayout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <GetStartedPage />
                </Suspense>
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/register" element={
            <PublicRoute>
              <PublicLayout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <RegisterPage />
                </Suspense>
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/forgot-password" element={
            <PublicRoute>
              <PublicLayout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <ForgotPasswordPage />
                </Suspense>
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/reset-password" element={
            <PublicRoute>
              <PublicLayout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <ResetPasswordPage />
                </Suspense>
              </PublicLayout>
            </PublicRoute>
          } />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<DashboardLoadingFallback />}>
                  <DashboardPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/brand-house/assessment" element={
            <ProtectedRoute>
              <Suspense fallback={<WorkshopLoadingFallback />}>
                <PreWorkshopAssessment />
              </Suspense>
            </ProtectedRoute>
          } />

          <Route path="/brand-house" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<WorkshopLoadingFallback />}>
                  <WorkshopContainer />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/workshop/results" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<WorkshopLoadingFallback />}>
                  <WorkshopResultsPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/workshop/sessions" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<WorkshopLoadingFallback />}>
                  <WorkshopSessionsPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/results/history" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<WorkshopLoadingFallback />}>
                  <ResultsHistoryPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Public Share Route */}
          <Route path="/share/:shareCode" element={
            <Suspense fallback={<LazyLoadingFallback />}>
              <SharedResultsPage />
            </Suspense>
          } />

          {/* Debug route - only in development */}
          {process.env.NODE_ENV === 'development' && DebugWorkshopPage && (
            <Route path="/debug-workshop" element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<LazyLoadingFallback />}>
                    <DebugWorkshopPage />
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            } />
          )}

          <Route path="/tier-selection" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <TierSelectionPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/news-setup" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ContentLoadingFallback />}>
                  <EnhancedRSSSetupPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/news-monitoring" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ContentLoadingFallback />}>
                  <NewsMonitoringPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/content-approval" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ContentLoadingFallback />}>
                  <ContentApprovalDashboard />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/content" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ContentLoadingFallback />}>
                  <ContentGenerationPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/content/history" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ContentLoadingFallback />}>
                  <ContentHistoryPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          {/* <Route path="/content/calendar" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ContentLoadingFallback />}>
                  <ContentCalendarPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } /> */}

          <Route path="/analytics" element={
            <ProtectedRoute requiresSubscription="professional">
              <Layout>
                <Suspense fallback={<AnalyticsLoadingFallback />}>
                  <AnalyticsPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<AnalyticsLoadingFallback />}>
                  <AnalyticsDashboardPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/users" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<AnalyticsLoadingFallback />}>
                  <UserAnalyticsDashboard />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/settings" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <AnalyticsSettingsPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/feedback" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<AnalyticsLoadingFallback />}>
                  <FeedbackAnalyticsPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <ProfilePage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/subscription" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<LazyLoadingFallback />}>
                  <SubscriptionPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />

          {/* Redirects */}
          <Route path="/app" element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          } />

          {/* 404 Route */}
          <Route path="*" element={
            <PublicLayout>
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-900">404</h1>
                  <p className="text-xl text-gray-600 mt-4">Page not found</p>
                  <button
                    onClick={() => window.history.back()}
                    className="mt-8 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </PublicLayout>
          } />
        </SentryRoutes>

        {/* Privacy Consent Banner - Lazy loaded */}
        <Suspense fallback={null}>
          <PrivacyConsentBanner />
        </Suspense>

        {/* Diagnostic Tools - Only in development */}
        {process.env.NODE_ENV === 'development' && (
          <Suspense fallback={null}>
            <DiagnosticTools />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;