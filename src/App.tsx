import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './hooks/redux.ts';
import { checkAuthStatus } from './store/slices/authSlice.ts';

// Layout Components
import Layout from './components/Layout.tsx';
import PublicLayout from './components/PublicLayout.tsx';

// Eagerly loaded components (needed immediately)
import LandingPage from './pages/LandingPage.tsx';
import LoginPage from './pages/auth/LoginPage.tsx';

// Lazy loaded components
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage.tsx'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage.tsx'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage.tsx'));

// Protected Pages (all lazy loaded)
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'));
const VoiceDiscoveryPage = lazy(() => import('./pages/VoiceDiscoveryPage.tsx'));
const ContentGenerationPage = lazy(() => import('./pages/ContentGenerationPage.tsx'));
const ContentHistoryPage = lazy(() => import('./pages/ContentHistoryPage.tsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.tsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.tsx'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage.tsx'));

// Route Guards
import ProtectedRoute from './components/ProtectedRoute.tsx';
import PublicRoute from './components/PublicRoute.tsx';

// Utility Components
import ErrorBoundary from './components/ErrorBoundary.tsx';
import Toast from './components/Toast.tsx';
import LoadingSpinner from './components/LoadingSpinner.tsx';

function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Check authentication status on app load
    dispatch(checkAuthStatus());
  }, [dispatch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Personal Brand DNA System...</p>
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

          <Route path="/voice-discovery" element={
            <ProtectedRoute>
              <Layout>
                <VoiceDiscoveryPage />
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