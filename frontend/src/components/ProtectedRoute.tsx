import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux.ts';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresSubscription?: 'professional' | 'executive' | 'enterprise';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiresSubscription 
}) => {
  const { isAuthenticated, user, isLoading } = useAppSelector((state) => state.auth);

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check subscription requirements
  if (requiresSubscription && user) {
    const subscriptionHierarchy = {
      free: 0,
      professional: 1,
      executive: 2,
      enterprise: 3,
    };

    const userLevel = subscriptionHierarchy[user.subscriptionTier];
    const requiredLevel = subscriptionHierarchy[requiresSubscription];

    if (userLevel < requiredLevel) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-6">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Subscription Required
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                This feature requires a {requiresSubscription} subscription or higher.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={() => window.location.href = '/subscription'}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Render children if all checks pass
  return <>{children}</>;
};

export default ProtectedRoute;