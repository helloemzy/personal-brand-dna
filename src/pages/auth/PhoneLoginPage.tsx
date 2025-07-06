import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/slices/authSlice';
import { authAPI } from '../../services/authAPI';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const PhoneLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const [step, setStep] = useState<'phone' | 'otp' | 'calling'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [otpCode, setOtpCode] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [callProgress, setCallProgress] = useState({
    status: 'preparing',
    message: 'Preparing your discovery call...'
  });

  // Timer for OTP resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Auto-focus next OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newDigits = [...otpDigits];
      newDigits[index] = value;
      setOtpDigits(newDigits);
      setOtpCode(newDigits.join(''));

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  // Handle backspace in OTP inputs
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Send OTP
  const handleSendOtp = async () => {
    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authAPI.sendPhoneOTP({ phoneNumber, countryCode });
      setStep('otp');
      setResendTimer(60); // 60 second cooldown
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authAPI.verifyPhoneOTP({
        phoneNumber,
        countryCode,
        otpCode
      });

      // Store auth credentials
      dispatch(setCredentials({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      }));

      // Navigate to brand house for new users, dashboard for existing
      if (response.user && !response.user.brandFrameworkCompleted) {
        navigate('/brand-house');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
      
      // Clear OTP inputs on error
      setOtpDigits(['', '', '', '', '', '']);
      setOtpCode('');
      document.getElementById('otp-0')?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Initiate voice discovery call
  const initiateVoiceCall = async (token: string) => {
    try {
      setCallProgress({
        status: 'initiating',
        message: 'Connecting your discovery call...'
      });

      const response = await fetch('/api/voice-discovery/initiate-call', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to initiate call');

      const data = await response.json();

      setCallProgress({
        status: 'calling',
        message: 'Your phone is ringing! This is a 5-minute discovery conversation.'
      });

      // Poll for call completion
      pollCallStatus(token, data.callId);
    } catch (err) {
      setError('Failed to initiate discovery call. Please try again.');
      setStep('otp');
    }
  };

  // Poll for call status
  const pollCallStatus = async (token: string, callId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/voice-discovery/check-status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (data.user.voiceDiscoveryStatus === 'completed') {
          clearInterval(interval);
          setCallProgress({
            status: 'completed',
            message: 'Discovery call completed! Preparing your personal brand framework...'
          });
          
          setTimeout(() => {
            navigate('/brand-framework');
          }, 3000);
        }
      } catch (err) {
        console.error('Status check error:', err);
      }
    }, 5000); // Check every 5 seconds

    // Stop polling after 10 minutes
    setTimeout(() => clearInterval(interval), 600000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            BrandPillar AI
          </h1>
          <p className="text-lg text-gray-600">
            Build your personal brand on autopilot
          </p>
        </div>

        {/* Phone Input Step */}
        {step === 'phone' && (
          <div className="bg-white p-8 rounded-2xl shadow-xl">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Start with your phone number
            </h2>
            
            <p className="text-gray-600 mb-6">
              Enter your phone number to get started with your free trial.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <PhoneInput
                  international
                  defaultCountry="US"
                  value={phoneNumber}
                  onChange={(value) => {
                    setPhoneNumber(value || '');
                    // Extract country code
                    if (value && value.startsWith('+')) {
                      const match = value.match(/^\+(\d{1,4})/);
                      if (match) {
                        setCountryCode('+' + match[1]);
                      }
                    }
                  }}
                  className="phone-input"
                  placeholder="Enter phone number"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading || !phoneNumber}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                By continuing, you agree to our{' '}
                <a href="/terms" className="text-purple-600 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-purple-600 hover:underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        )}

        {/* OTP Verification Step */}
        {step === 'otp' && (
          <div className="bg-white p-8 rounded-2xl shadow-xl">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Verify your phone number
            </h2>
            
            <p className="text-gray-600 mb-6">
              We sent a 6-digit code to {phoneNumber}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <div className="flex gap-2 justify-center">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none transition-colors"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <div className="text-center">
                <button
                  onClick={handleSendOtp}
                  disabled={resendTimer > 0}
                  className="text-sm text-purple-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  {resendTimer > 0
                    ? `Resend code in ${resendTimer}s`
                    : 'Resend code'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Voice Call Progress */}
        {step === 'calling' && (
          <div className="bg-white p-8 rounded-2xl shadow-xl">
            <div className="text-center space-y-6">
              {/* Animated calling indicator */}
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 bg-purple-200 rounded-full animate-ping"></div>
                <div className="absolute inset-4 bg-purple-300 rounded-full animate-ping animation-delay-200"></div>
                <div className="relative flex items-center justify-center w-full h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full">
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {callProgress.status === 'completed' 
                    ? 'Call Completed!' 
                    : 'Discovery Call in Progress'}
                </h2>
                <p className="text-gray-600">
                  {callProgress.message}
                </p>
              </div>

              {callProgress.status === 'calling' && (
                <div className="space-y-3 text-sm text-gray-500">
                  <p>💡 Tip: Be authentic and conversational</p>
                  <p>🎯 Focus on your professional journey and passions</p>
                  <p>⏱️ The call typically takes 5-7 minutes</p>
                </div>
              )}

              {callProgress.status === 'completed' && (
                <div className="flex items-center justify-center space-x-2 text-green-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Analysis complete</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Background decorative elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>
    </div>
  );
};

export default PhoneLoginPage;