import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/redux';
import { setCredentials } from '../store/slices/authSlice';
import { authAPI } from '../services/authAPI';
import { toast } from '../components/Toast';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      const response = await authAPI.demoLogin();
      const { user, accessToken, refreshToken } = response.data;
      
      dispatch(setCredentials({ user, accessToken, refreshToken }));
      toast.success('Welcome to BrandPillar AI!', 'Start your 7-day free trial with full access.');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Demo Login Failed', 'Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 to-blue-800 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Build Your Personal Brand
              <span className="block text-blue-200">On Autopilot</span>
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              The only platform that combines AI brand discovery, automated content creation, 
              and intelligent news monitoring to grow your LinkedIn influence effortlessly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Loading...' : 'Start 7-Day Free Trial'}
              </button>
              <Link
                to="/login"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              The Only Platform That Does It All
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              AI brand discovery + automated content + news monitoring = Your personal brand on autopilot
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏛️</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                15-Minute Brand House
              </h3>
              <p className="text-gray-600">
                Complete our AI-powered assessment to discover your brand pillars and unique value
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📰</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Smart News Monitoring
              </h3>
              <p className="text-gray-600">
                AI monitors your industry news and creates timely content that positions you as a thought leader
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Automated Posting
              </h3>
              <p className="text-gray-600">
                Review and approve content with 1-hour notice, then watch your influence grow on autopilot
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Why BrandPillar AI?
              </h2>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Authentic Voice</h3>
                    <p className="text-gray-600">Content that genuinely sounds like you, not generic AI</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Business Results</h3>
                    <p className="text-gray-600">Focus on career opportunities, not just engagement</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Time Saving</h3>
                    <p className="text-gray-600">Never stare at a blank screen wondering "what to post"</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-100 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Join Thousands of Professionals
              </h3>
              <p className="text-gray-600 mb-6">
                Who are already using their authentic voice to advance their careers
              </p>
              <button
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Loading...' : 'Get Started Free'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Start Your 7-Day Free Trial
            </h2>
            <p className="text-lg text-gray-600">
              No credit card required. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Starter</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">$39<span className="text-lg font-normal">/mo</span></div>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>✅ 7-day free trial</li>
                <li>📄 3 posts/week</li>
                <li>📰 5 news sources</li>
                <li>🏛️ Brand House assessment</li>
                <li>⏱️ 24-hour approval</li>
              </ul>
              <Link
                to="/get-started"
                className="bg-gray-100 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-block"
              >
                Start Free Trial
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 text-center border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm">
                Most Popular
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Professional</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">$79<span className="text-lg font-normal">/mo</span></div>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>✅ 7-day free trial</li>
                <li>📄 5 posts/week + 1 article</li>
                <li>📰 25 news sources</li>
                <li>📈 Trend detection</li>
                <li>📋 Custom schedule</li>
              </ul>
              <Link
                to="/get-started"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-block"
              >
                Start Free Trial
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Executive</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">$149<span className="text-lg font-normal">/mo</span></div>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>✅ 7-day free trial</li>
                <li>📄 Daily posts + 2 articles</li>
                <li>📰 Unlimited news sources</li>
                <li>🤝 Success manager</li>
                <li>🚀 API access</li>
              </ul>
              <Link
                to="/get-started"
                className="bg-gray-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-900 transition-colors inline-block"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;