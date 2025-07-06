import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { checkAuthStatus, setCredentials, clearAuth } from './store/slices/authSlice';
import { supabase } from './services/supabaseClient';

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
const ContentApprovalDashboard = lazy(() => import('./pages/ContentApprovalDashboard'));
const WorkshopContainer = lazy(() => import('./components/workshop/WorkshopContainer'));

function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
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
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
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

          <Route path="/brand-house" element={
            <ProtectedRoute>
              <Layout>
                <WorkshopContainer />
              </Layout>
            </ProtectedRoute>
          } />

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
                <RSSSetupPage />
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

          <Route path="/analytics" element={
            <ProtectedRoute requiresSubscription="professional">
              <Layout>
                <AnalyticsPage />
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
          </Routes>
        </Suspense>

        {/* Global Toast Notifications */}
        <Toast />
      </div>
    </ErrorBoundary>
  );
}

export default App;