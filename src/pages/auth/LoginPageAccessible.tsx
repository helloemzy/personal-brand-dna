import React, { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { loginUser, clearError } from '../../store/slices/authSlice';
import { toast } from '../../components/Toast';
import { useAnnounce, useFieldAccessibility } from '../../hooks/useAccessibility';
import { focusVisible } from '../../utils/accessibility';
import FormField from '../../components/accessibility/FormField';
import LiveRegion from '../../components/accessibility/LiveRegion';
import SEO from '../../components/SEO';

interface LoginFormData {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const announce = useAnnounce();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const emailRef = useRef<HTMLInputElement>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  useEffect(() => {
    // Clear any existing errors when component mounts
    dispatch(clearError());
    
    // Focus on email field
    emailRef.current?.focus();
    
    // Announce page
    announce('Login page loaded. Please enter your credentials.');
  }, [dispatch, announce]);

  useEffect(() => {
    // Announce errors
    if (error) {
      announce(`Login error: ${error}`);
    }
  }, [error, announce]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      await dispatch(loginUser(data)).unwrap();
      toast.success('Welcome back!', 'You have successfully logged in.');
      announce('Login successful. Redirecting to dashboard.');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error('Login Failed', error.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <SEO 
        title="Login - BrandPillar AI"
        description="Sign in to your BrandPillar AI account to manage your personal brand and content."
      />
      
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to BrandPillar AI
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to continue to your account
          </p>
        </div>
        
        <form 
          className="mt-8 space-y-6" 
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Login form"
        >
          <LiveRegion>
            {error && (
              <div className="rounded-md bg-red-50 p-4" role="alert">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </LiveRegion>

          <div className="rounded-md shadow-sm -space-y-px">
            <FormField 
              label="Email address" 
              error={errors.email?.message}
              required
            >
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                ref={(e) => {
                  register('email').ref(e);
                  emailRef.current = e;
                }}
                type="email"
                autoComplete="email"
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${focusVisible}`}
                placeholder="Email address"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </FormField>

            <FormField 
              label="Password" 
              error={errors.password?.message}
              required
            >
              <input
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
                type="password"
                autoComplete="current-password"
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${focusVisible}`}
                placeholder="Password"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${focusVisible}`}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link 
                to="/auth/forgot-password" 
                className={`font-medium text-blue-600 hover:text-blue-500 ${focusVisible}`}
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${focusVisible} ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-busy={isLoading}
              aria-live="polite"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg 
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                to="/auth/google"
                className={`w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${focusVisible}`}
                aria-label="Sign in with Google"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="ml-2">Google</span>
              </Link>

              <Link
                to="/auth/phone"
                className={`w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${focusVisible}`}
                aria-label="Sign in with phone number"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="ml-2">Phone</span>
              </Link>
            </div>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link 
                to="/auth/register" 
                className={`font-medium text-blue-600 hover:text-blue-500 ${focusVisible}`}
              >
                Sign up
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;