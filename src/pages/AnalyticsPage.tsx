import React from 'react';
import { useAppSelector } from '../hooks/redux.ts';

const AnalyticsPage: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  // If user is on free plan, show upgrade prompt
  if (user?.subscriptionTier === 'free') {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Analytics & Insights
          </h1>
          <p className="text-lg text-gray-600">
            Track your content performance and gain insights to improve your professional brand.
          </p>
        </div>

        {/* Upgrade Required */}
        <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-8 border border-yellow-200 text-center">
          <div className="text-6xl mb-6">📊</div>
          <h3 className="text-2xl font-semibold text-yellow-900 mb-4">
            Analytics Available in Professional Plan
          </h3>
          <p className="text-yellow-800 mb-8 max-w-2xl mx-auto">
            Unlock detailed analytics, performance insights, and content optimization 
            recommendations to maximize your professional impact on LinkedIn.
          </p>
          <div className="bg-white rounded-lg p-6 mb-8 max-w-lg mx-auto">
            <h4 className="font-semibold text-gray-900 mb-4">Analytics Features Include:</h4>
            <ul className="text-sm text-gray-700 space-y-2 text-left">
              <li>• Content performance tracking</li>
              <li>• Engagement rate analytics</li>
              <li>• Optimal posting time recommendations</li>
              <li>• Audience growth insights</li>
              <li>• Content type performance comparison</li>
              <li>• Career impact metrics</li>
            </ul>
          </div>
          <button
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            onClick={() => {
              window.location.href = '/subscription';
            }}
          >
            Upgrade to Professional - $49/month
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Analytics & Insights
        </h1>
        <p className="text-lg text-gray-600">
          Track your content performance and optimize your professional brand impact.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Content', value: '0', change: '+0%', icon: '📄' },
          { label: 'Total Views', value: '0', change: '+0%', icon: '👀' },
          { label: 'Engagement Rate', value: '0%', change: '+0%', icon: '💫' },
          { label: 'Career Opportunities', value: '0', change: '+0', icon: '🚀' },
        ].map((metric, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{metric.label}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                <p className="text-sm text-green-600">{metric.change}</p>
              </div>
              <div className="text-3xl">{metric.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Dashboard - Placeholder */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-6">📈</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Analytics Dashboard Coming Soon
          </h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Detailed analytics and insights will be displayed here once you start 
            generating and posting content.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left max-w-lg mx-auto">
            <h4 className="font-semibold text-blue-900 mb-2">Coming Features:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Real-time performance tracking</li>
              <li>• Content optimization recommendations</li>
              <li>• Audience engagement insights</li>
              <li>• Posting time optimization</li>
              <li>• Career impact measurement</li>
              <li>• Competitive benchmarking</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Performance</h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <p>No content data available yet</p>
              <p className="text-sm mt-1">Start generating content to see performance insights</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Trends</h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <p>No engagement data available yet</p>
              <p className="text-sm mt-1">Publish content to LinkedIn to track engagement</p>
            </div>
          </div>
        </div>
      </div>

      {/* Get Started */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              Start Tracking Your Success
            </h3>
            <p className="text-blue-700 text-sm">
              Generate and publish content to see detailed analytics and insights.
            </p>
          </div>
          <div>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              onClick={() => {
                window.location.href = '/content';
              }}
            >
              Generate Content
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;