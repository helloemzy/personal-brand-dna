import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { FcGoogle, FiArrowLeft } from '../../utils/icons';


const GoogleLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      // Supabase will redirect to Google
    } catch (err) {
      console.error('Google login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to login with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Back Button */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <FiArrowLeft className="mr-2" />
            Back
          </button>

          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to BrandPillar AI
            </h1>
            <p className="text-gray-600">
              Sign in to start building your personal brand
            </p>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <FcGoogle className="w-6 h-6" />
            {loading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Benefits */}
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Why BrandPillar AI?
            </h3>
            <div className="space-y-2">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-gray-600">
                  AI-powered brand discovery in 15 minutes
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-gray-600">
                  Automated content creation that sounds like you
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-gray-600">
                  Smart news monitoring for timely posts
                </p>
              </div>
            </div>
          </div>

          {/* Terms */}
          <p className="mt-6 text-xs text-center text-gray-500">
            By continuing, you agree to our{' '}
            <a href="/terms" className="underline hover:text-gray-700">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline hover:text-gray-700">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoogleLoginPage;