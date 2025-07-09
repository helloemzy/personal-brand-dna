import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { checkAuthStatus, setCredentials, clearAuth } from './store/slices/authSlice';
import { supabase } from './services/supabaseClient';
import { initSentry } from './config/sentry';
import { useSentryTracking } from './hooks/useSentryTracking';

// Initialize Sentry as early as possible
initSentry();

// Layout Components
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';

// Eagerly loaded components (needed immediately)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';

// Utility Components
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import PrivacyConsentBanner from './components/PrivacyConsentBanner';

// Accessibility Components
import AccessibilityAudit from './components/accessibility/AccessibilityAudit';
import KeyboardShortcuts from './components/accessibility/KeyboardShortcuts';

// Route Guards
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';

// Lazy loaded components
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const PhoneLoginPage = lazy(() => import('./pages/auth/PhoneLoginPage'));
const GoogleLoginPage = lazy(() => import('./pages/auth/GoogleLoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/auth/AuthCallbackPage'));
const GetStartedPage = lazy(() => import('./pages/GetStartedPage'));

// Protected Pages (all lazy loaded)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ContentGenerationPage = lazy(() => import('./pages/ContentGenerationPage'));
const ContentHistoryPage = lazy(() => import('./pages/ContentHistoryPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const TierSelectionPage = lazy(() => import('./pages/TierSelectionPage'));
const RSSSetupPage = lazy(() => import('./pages/RSSSetupPage'));
const EnhancedRSSSetupPage = lazy(() => import('./pages/EnhancedRSSSetupPage'));
const NewsMonitoringPage = lazy(() => import('./pages/NewsMonitoringPage'));
const ContentApprovalDashboard = lazy(() => import('./pages/ContentApprovalDashboard'));
const WorkshopContainer = lazy(() => import('./components/workshop/WorkshopContainer'));
const PreWorkshopAssessment = lazy(() => import('./components/workshop/PreWorkshopAssessment'));
const WorkshopResultsPage = lazy(() => import('./pages/WorkshopResultsPage'));
const SharedResultsPage = lazy(() => import('./pages/SharedResultsPage'));
const DebugWorkshopPage = lazy(() => import('./pages/DebugWorkshopPage'));
const LinkedInCallbackPage = lazy(() => import('./pages/LinkedInCallbackPage'));
const ContentCalendarPage = lazy(() => import('./pages/ContentCalendarPage'));
const AnalyticsDashboardPage = lazy(() => import('./pages/AnalyticsDashboardPage'));
const UserAnalyticsDashboard = lazy(() => import('./pages/UserAnalyticsDashboard'));
const AnalyticsSettingsPage = lazy(() => import('./pages/AnalyticsSettingsPage'));

// Create Sentry-enhanced router for performance monitoring
const SentryRoutes = Sentry.withSentryRouting(Routes);

function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  
  // Track user context and navigation in Sentry
  useSentryTracking();

  useEffect(() => {
    // Check for state reset request in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
      console.log('State reset requested - clearing persisted data');
      
      // Clear all localStorage data related to the app
      try {
        // Clear Redux persist data
        localStorage.removeItem('persist:root');
        localStorage.removeItem('persist:workshop');
        localStorage.removeItem('persist:auth');
        localStorage.removeItem('persist:content');
        
        // Clear any workshop-specific data
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('workshop_') || key.startsWith('brandhouse_')) {
            localStorage.removeItem(key);
          }
        });
        
        // Remove the reset parameter and reload
        urlParams.delete('reset');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.location.href = newUrl;
      } catch (error) {
        console.error('Error clearing state:', error);
        // Force reload anyway
        window.location.href = window.location.pathname;
      }
      return;
    }

    // Check for existing Supabase session on app load
    const checkSupabaseSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // User is logged in via Supabase, sync with Redux
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
          // No Supabase session, check legacy auth
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
        // User signed in
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
        // User signed out
        dispatch(clearAuth());
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Token was refreshed
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

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  // Set document language and title
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
    <ErrorBoundary>
      <div className="App min-h-screen bg-gray-50">
        <Toast />
        <AccessibilityAudit />
        <KeyboardShortcuts />
        <Suspense fallback={<LoadingSpinner />}>
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
                <PhoneLoginPage />
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/google-login" element={
            <PublicRoute>
              <PublicLayout>
                <GoogleLoginPage />
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/auth/callback" element={
            <AuthCallbackPage />
          } />
          
          <Route path="/linkedin/callback" element={
            <LinkedInCallbackPage />
          } />
          
          <Route path="/get-started" element={
            <PublicRoute>
              <PublicLayout>
                <GetStartedPage />
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/register" element={
            <PublicRoute>
              <PublicLayout>
                <RegisterPage />
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/forgot-password" element={
            <PublicRoute>
              <PublicLayout>
                <ForgotPasswordPage />
              </PublicLayout>
            </PublicRoute>
          } />
          
          <Route path="/reset-password" element={
            <PublicRoute>
              <PublicLayout>
                <ResetPasswordPage />
              </PublicLayout>
            </PublicRoute>
          } />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/brand-house/assessment" element={
            <ProtectedRoute>
              <PreWorkshopAssessment />
            </ProtectedRoute>
          } />

          <Route path="/brand-house" element={
            <ProtectedRoute>
              <Layout>
                <WorkshopContainer />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/workshop/results" element={
            <ProtectedRoute>
              <Layout>
                <WorkshopResultsPage />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Public Share Route */}
          <Route path="/share/:shareCode" element={
            <SharedResultsPage />
          } />

          {/* Debug route - only in development */}
          {process.env.NODE_ENV === 'development' && (
            <Route path="/debug-workshop" element={
              <ProtectedRoute>
                <Layout>
                  <DebugWorkshopPage />
                </Layout>
              </ProtectedRoute>
            } />
          )}

          <Route path="/tier-selection" element={
            <ProtectedRoute>
              <Layout>
                <TierSelectionPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/news-setup" element={
            <ProtectedRoute>
              <Layout>
                <EnhancedRSSSetupPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/news-monitoring" element={
            <ProtectedRoute>
              <Layout>
                <NewsMonitoringPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/content-approval" element={
            <ProtectedRoute>
              <Layout>
                <ContentApprovalDashboard />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/content" element={
            <ProtectedRoute>
              <Layout>
                <ContentGenerationPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/content/history" element={
            <ProtectedRoute>
              <Layout>
                <ContentHistoryPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/content/calendar" element={
            <ProtectedRoute>
              <Layout>
                <ContentCalendarPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute requiresSubscription="professional">
              <Layout>
                <AnalyticsPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <AnalyticsDashboardPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/users" element={
            <ProtectedRoute>
              <Layout>
                <UserAnalyticsDashboard />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/analytics/settings" element={
            <ProtectedRoute>
              <Layout>
                <AnalyticsSettingsPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/subscription" element={
            <ProtectedRoute>
              <Layout>
                <SubscriptionPage />
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
        </Suspense>

        {/* Global Toast Notifications */}
        <Toast />
        
        {/* Privacy Consent Banner */}
        <PrivacyConsentBanner />
      </div>
    </ErrorBoundary>
  );
}

export default App;