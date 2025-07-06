import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPhone, FaSpinner, FaCheckCircle, FaClock, FaMicrophone } from 'react-icons/fa';
import { authAPI } from '../services/authAPI';

const BrandDiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const [callStatus, setCallStatus] = useState<'pending' | 'initiated' | 'in-progress' | 'completed' | 'failed'>('pending');
  const [error, setError] = useState('');
  const [callId, setCallId] = useState('');

  useEffect(() => {
    // Initiate the voice call when component mounts
    initiateCall();
  }, []);

  const initiateCall = async () => {
    setCallStatus('initiated');
    setError('');

    // Get user's phone number from token or storage
    const phoneNumber = sessionStorage.getItem('userPhoneNumber');
    
    if (!phoneNumber) {
      setError('Phone number not found. Please login again.');
      setCallStatus('failed');
      return;
    }

    try {
      const response = await authAPI.initiateVoiceCall(phoneNumber);
      
      if (response.success && response.callId) {
        setCallId(response.callId);
        setCallStatus('in-progress');
        
        // Start polling for call status
        startPollingCallStatus(response.callId);
      } else {
        setError(response.message || 'Failed to initiate call');
        setCallStatus('failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while initiating the call');
      setCallStatus('failed');
    }
  };

  const startPollingCallStatus = (callId: string) => {
    // Poll every 5 seconds for call status
    const pollInterval = setInterval(async () => {
      try {
        const response = await authAPI.checkCallStatus(callId);
        
        if (response.callStatus === 'completed') {
          clearInterval(pollInterval);
          setCallStatus('completed');
          
          // Navigate to brand framework page after a short delay
          setTimeout(() => {
            navigate('/brand-framework');
          }, 2000);
        } else if (response.callStatus === 'failed') {
          clearInterval(pollInterval);
          setCallStatus('failed');
          setError('The call could not be completed');
        }
      } catch (err) {
        console.error('Error polling call status:', err);
      }
    }, 5000);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 600000);
  };

  const getStatusIcon = () => {
    switch (callStatus) {
      case 'pending':
      case 'initiated':
        return <FaSpinner className="animate-spin text-blue-600 text-4xl" />;
      case 'in-progress':
        return <FaPhone className="text-green-600 text-4xl animate-pulse" />;
      case 'completed':
        return <FaCheckCircle className="text-green-600 text-4xl" />;
      case 'failed':
        return <FaClock className="text-red-600 text-4xl" />;
      default:
        return <FaMicrophone className="text-gray-600 text-4xl" />;
    }
  };

  const getStatusMessage = () => {
    switch (callStatus) {
      case 'pending':
        return 'Preparing your brand discovery call...';
      case 'initiated':
        return 'Calling your phone now...';
      case 'in-progress':
        return 'Great! Your 5-minute brand discovery conversation is in progress.';
      case 'completed':
        return 'Excellent! Your brand discovery is complete. Analyzing your responses...';
      case 'failed':
        return 'We couldn\'t complete the call. Please try again.';
      default:
        return 'Getting ready...';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            {getStatusIcon()}
          </div>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            AI Voice Discovery
          </h1>
          
          <p className="text-lg text-gray-600 mb-6">
            {getStatusMessage()}
          </p>

          {callStatus === 'in-progress' && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">During the call:</h3>
              <ul className="text-left text-blue-700 space-y-1">
                <li>• Speak naturally and authentically</li>
                <li>• Share your professional experiences</li>
                <li>• Describe your ideal clients</li>
                <li>• Express your unique value</li>
              </ul>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          {callStatus === 'failed' && (
            <button
              onClick={initiateCall}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Try Again
            </button>
          )}

          {callStatus === 'in-progress' && (
            <p className="text-sm text-gray-500 mt-4">
              The call typically takes 5-7 minutes. We'll automatically detect when it's complete.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandDiscoveryPage;