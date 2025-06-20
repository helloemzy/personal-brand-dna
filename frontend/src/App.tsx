import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './hooks/redux.ts';
import { checkAuthStatus } from './store/slices/authSlice.ts';

// Layout Components
import Layout from './components/Layout.tsx';
import PublicLayout from './components/PublicLayout.tsx';

// Public Pages
import LandingPage from './pages/LandingPage.tsx';
import LoginPage from './pages/auth/LoginPage.tsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.tsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.tsx';

// Protected Pages
import DashboardPage from './pages/DashboardPage.tsx';
import VoiceDiscoveryPage from './pages/VoiceDiscoveryPage.tsx';
import ContentGenerationPage from './pages/ContentGenerationPage.tsx';
import ContentHistoryPage from './pages/ContentHistoryPage.tsx';
import AnalyticsPage from './pages/AnalyticsPage.tsx';
import ProfilePage from './pages/ProfilePage.tsx';
import SubscriptionPage from './pages/SubscriptionPage.tsx';

// Route Guards
import ProtectedRoute from './components/ProtectedRoute.tsx';
import PublicRoute from './components/PublicRoute.tsx';

// Utility Components
import ErrorBoundary from './components/ErrorBoundary.tsx';
import Toast from './components/Toast.tsx';

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

        {/* Global Toast Notifications */}
        <Toast />
      </div>
    </ErrorBoundary>
  );
}

export default App;