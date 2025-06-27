import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConversationFlow from '../components/ConversationFlow';

const VoiceDiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleStart = () => {
    setHasStarted(true);
  };

  const handleComplete = (voiceProfileId: string) => {
    setIsCompleted(true);
    // Optionally navigate to dashboard or content generation
    setTimeout(() => {
      navigate('/dashboard');
    }, 3000);
  };

  if (hasStarted) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Voice Discovery
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Let's discover your authentic professional voice through a 5-minute conversation. 
            Our AI will analyze your communication style to create content that sounds genuinely like you.
          </p>
        </div>

        {/* Conversation Flow */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <ConversationFlow 
            onComplete={handleComplete}
            className="w-full"
          />
        </div>

        {isCompleted && (
          <div className="text-center">
            <p className="text-green-600 font-medium">
              Redirecting to your dashboard in 3 seconds...
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Voice Discovery
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Let's discover your authentic professional voice through a 5-minute conversation. 
          Our AI will analyze your communication style to create content that sounds genuinely like you.
        </p>
      </div>

      {/* Voice Discovery Interface Preview */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-6">🎙️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Ready to Discover Your Voice?
          </h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            We'll have a friendly 5-minute conversation about your work and communication style. 
            Our AI will then create your unique voice profile for generating authentic content.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left max-w-lg mx-auto">
            <h4 className="font-semibold text-blue-900 mb-2">What to Expect:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 5-6 conversational questions about your work</li>
              <li>• Audio recording with real-time visualization</li>
              <li>• AI analysis of your communication patterns</li>
              <li>• 14-dimensional voice signature creation</li>
              <li>• Ready to generate personalized content</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <div className="text-3xl mb-4">🎯</div>
          <h3 className="font-semibold text-gray-900 mb-2">Be Natural</h3>
          <p className="text-sm text-gray-600">
            Speak naturally as you would in a professional conversation. 
            Don't try to sound different - authenticity is key.
          </p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <div className="text-3xl mb-4">⏱️</div>
          <h3 className="font-semibold text-gray-900 mb-2">5 Minutes</h3>
          <p className="text-sm text-gray-600">
            The conversation typically takes 5 minutes. 
            We'll ask about your experience, goals, and communication style.
          </p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <div className="text-3xl mb-4">🔒</div>
          <h3 className="font-semibold text-gray-900 mb-2">Private & Secure</h3>
          <p className="text-sm text-gray-600">
            Your voice data is encrypted and automatically deleted after analysis. 
            Only your voice signature is stored.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          onClick={handleStart}
        >
          Start Voice Discovery
        </button>
        <p className="text-sm text-gray-500 mt-2">
          Make sure your microphone is enabled and you're in a quiet environment
        </p>
      </div>
    </div>
  );
};

export default VoiceDiscoveryPage;