import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { linkedinAPI } from '../services/linkedinAPI';
import { useAppSelector } from '../hooks/redux';

const LinkedInCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  
  const user = useAppSelector(state => state.auth.user);

  useEffect(() => {
    handleLinkedInCallback();
  }, []);

  const handleLinkedInCallback = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle LinkedIn OAuth errors
    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || 'LinkedIn authorization was denied');
      setTimeout(() => navigate('/dashboard'), 3000);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMessage('Missing authorization code or state');
      setTimeout(() => navigate('/dashboard'), 3000);
      return;
    }

    if (!user?.id) {
      setStatus('error');
      setErrorMessage('You must be logged in to connect LinkedIn');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    try {
      // Exchange code for access token
      await linkedinAPI.handleCallback({
        code,
        state,
        userId: user.id
      });

      setStatus('success');
      
      // Redirect to dashboard or wherever the user was trying to go
      setTimeout(() => {
        const returnUrl = localStorage.getItem('linkedin_return_url') || '/dashboard';
        localStorage.removeItem('linkedin_return_url');
        navigate(returnUrl);
      }, 2000);
    } catch (error: any) {
      console.error('LinkedIn callback error:', error);
      setStatus('error');
      setErrorMessage(error.response?.data?.error || 'Failed to connect LinkedIn account');
      setTimeout(() => navigate('/dashboard'), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {status === 'processing' && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connecting LinkedIn Account
            </h2>
            <p className="text-gray-600">
              Please wait while we complete the authorization...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              LinkedIn Connected Successfully!
            </h2>
            <p className="text-gray-600">
              Your LinkedIn account has been connected. Redirecting you back...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-600 mb-4">
              {errorMessage}
            </p>
            <p className="text-sm text-gray-500">
              Redirecting you back...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkedInCallbackPage;