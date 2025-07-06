import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { supabase } from '../../services/supabaseClient';
import { setCredentials } from '../../store/slices/authSlice';
import { AppDispatch } from '../../store';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        if (code) {
          // Exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) throw error;
          
          // Get the session to have access tokens
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session && data.user) {
            // Update Redux store with user credentials
            dispatch(setCredentials({
              user: {
                id: data.user.id,
                email: data.user.email || '',
                firstName: data.user.user_metadata?.full_name?.split(' ')[0] || data.user.user_metadata?.name?.split(' ')[0] || '',
                lastName: data.user.user_metadata?.full_name?.split(' ')[1] || data.user.user_metadata?.name?.split(' ')[1] || '',
                subscriptionTier: 'free',
                subscriptionStatus: 'active',
                isVerified: data.user.email_confirmed_at ? true : false,
                createdAt: data.user.created_at,
                updatedAt: data.user.updated_at || data.user.created_at,
              },
              accessToken: session.access_token,
              refreshToken: session.refresh_token || null,
            }));
            
            // Check if user has completed brand discovery
            const { data: profile } = await supabase
              .from('brand_frameworks')
              .select('id')
              .eq('user_id', data.user.id)
              .single();
            
            if (profile) {
              // User has completed setup, go to dashboard
              navigate('/dashboard');
            } else {
              // New user, go to brand discovery
              navigate('/get-started');
            }
          } else {
            throw new Error('No session created');
          }
        } else {
          // No code, something went wrong
          navigate('/login?error=auth_failed');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login?error=auth_failed');
      }
    };

    handleCallback();
  }, [navigate, dispatch]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;