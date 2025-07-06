import React from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux';
import TrialBanner from '../components/TrialBanner';

const DashboardPage: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  const quickActions = [
    {
      title: 'Brand House',
      description: 'Complete your 15-minute brand assessment',
      icon: '🏛️',
      href: '/brand-house',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      cta: 'Start Assessment',
    },
    {
      title: 'Content Queue',
      description: 'Review and approve AI-generated posts',
      icon: '📋',
      href: '/content-approval',
      color: 'bg-green-50 border-green-200 hover:bg-green-100',
      cta: 'View Queue',
    },
    {
      title: 'News Sources',
      description: 'Add RSS feeds to monitor industry news',
      icon: '📰',
      href: '/news-setup',
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      cta: 'Manage Sources',
    },
    {
      title: 'Upgrade Plan',
      description: 'Unlock more posts and features',
      icon: '🚀',
      href: '/tier-selection',
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      cta: 'View Plans',
    },
  ];

  const filteredActions = quickActions.filter(action => {
    if (action.subscription === 'professional') {
      return user?.subscriptionTier !== 'free';
    }
    return true;
  });

  const stats = [
    { label: 'Posts This Week', value: '0', icon: '📄' },
    { label: 'Approval Rate', value: '0%', icon: '✅' },
    { label: 'News Sources', value: '0', icon: '📰' },
    { label: 'Engagement Rate', value: '0%', icon: '💫' },
  ];

  // Mock trial data - in production this would come from the backend
  const isTrialActive = true;
  const trialDaysLeft = 5;
  const currentTier = 'Professional';

  return (
    <div className="space-y-8">
      {/* Trial Banner */}
      {isTrialActive && (
        <TrialBanner daysLeft={trialDaysLeft} tier={currentTier} />
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome to BrandPillar AI!
        </h1>
        <p className="text-gray-600 mt-1">
          Build your personal brand on autopilot with AI-powered content.
        </p>
      </div>

      {/* Subscription Status */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 capitalize">
              {user?.subscriptionTier} Plan
            </h3>
            <p className="text-blue-700 text-sm">
              {user?.subscriptionTier === 'free' 
                ? 'You have 3 free posts remaining this month'
                : 'Unlimited content generation available'
              }
            </p>
          </div>
          <div>
            {user?.subscriptionTier === 'free' ? (
              <Link
                to="/subscription"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Upgrade
              </Link>
            ) : (
              <Link
                to="/subscription"
                className="bg-white text-blue-600 px-4 py-2 rounded-md text-sm font-medium border border-blue-300 hover:bg-blue-50 transition-colors"
              >
                Manage
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">{stat.icon}</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredActions.map((action, index) => (
            <Link
              key={index}
              to={action.href}
              className={`block p-6 rounded-lg border-2 transition-colors ${action.color}`}
            >
              <div className="flex items-start">
                <div className="text-3xl mr-4">{action.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {action.title}
                    {action.subscription && user?.subscriptionTier === 'free' && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                        PRO
                      </span>
                    )}
                  </h3>
                  <p className="text-gray-600 text-sm">{action.description}</p>
                </div>
                <div className="text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      {user?.subscriptionTier === 'free' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h2>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-4">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Complete Voice Discovery</h4>
                <p className="text-sm text-gray-600">Map your authentic communication style</p>
              </div>
              <Link
                to="/voice-discovery"
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Start →
              </Link>
            </div>
            <div className="flex items-center p-4 bg-gray-50 rounded-lg opacity-50">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-4">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Generate Your First Post</h4>
                <p className="text-sm text-gray-600">Create content that sounds like you</p>
              </div>
              <span className="text-gray-400 font-medium text-sm">Complete step 1 first</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">📭</div>
          <p>No recent activity yet</p>
          <p className="text-sm mt-1">Start by completing your voice discovery</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;