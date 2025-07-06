import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';

interface TierOption {
  id: string;
  name: string;
  tagline: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  limitations: string[];
  bestFor: string[];
  icon: string;
  color: string;
  recommended?: boolean;
}

interface Goal {
  id: string;
  label: string;
  description: string;
  recommendedTier: string;
}

const TierSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);

  const goals: Goal[] = [
    {
      id: 'presence',
      label: 'Maintain Professional Presence',
      description: 'Stay visible without overwhelming my network',
      recommendedTier: 'starter'
    },
    {
      id: 'thought-leader',
      label: 'Build Thought Leadership',
      description: 'Establish myself as an industry expert',
      recommendedTier: 'professional'
    },
    {
      id: 'business-growth',
      label: 'Drive Business Growth',
      description: 'Generate leads and close deals through content',
      recommendedTier: 'professional'
    },
    {
      id: 'job-search',
      label: 'Accelerate Job Search',
      description: 'Get noticed by recruiters and hiring managers',
      recommendedTier: 'professional'
    },
    {
      id: 'market-domination',
      label: 'Dominate My Market',
      description: 'Become the go-to voice in my industry',
      recommendedTier: 'executive'
    },
    {
      id: 'speaking',
      label: 'Land Speaking Opportunities',
      description: 'Get invited to conferences and podcasts',
      recommendedTier: 'executive'
    }
  ];

  const tiers: TierOption[] = [
    {
      id: 'starter',
      name: 'Starter',
      tagline: 'Perfect for building your brand presence',
      price: {
        monthly: 39,
        yearly: 374
      },
      features: [
        '7-day free trial',
        '3 posts per week',
        '5 news sources',
        'Brand House assessment',
        '24-hour approval window',
        'Basic analytics',
        'Email support'
      ],
      limitations: [
        'No trend detection',
        'No competitor analysis',
        'Limited customization'
      ],
      bestFor: [
        'Busy executives',
        'Introverted professionals',
        'Quality-focused leaders'
      ],
      icon: '🌱',
      color: 'green'
    },
    {
      id: 'professional',
      name: 'Professional',
      tagline: 'Build thought leadership systematically',
      price: {
        monthly: 79,
        yearly: 758
      },
      features: [
        '7-day free trial',
        '5 posts per week + 1 article/month',
        '25 news sources',
        'Advanced Brand House',
        'Custom posting schedule',
        'Trend detection',
        'Analytics dashboard',
        'Priority support'
      ],
      recommended: true,
      limitations: [
        'No instant posting',
        'No multimedia content',
        'No dedicated success manager'
      ],
      bestFor: [
        'Consultants & coaches',
        'Business developers',
        'Career climbers'
      ],
      icon: '🚀',
      color: 'blue'
    },
    {
      id: 'executive',
      name: 'Executive',
      tagline: 'Maximum impact for industry leaders',
      price: {
        monthly: 149,
        yearly: 1430
      },
      features: [
        '7-day free trial',
        'Daily posts + 2 articles/month',
        'Unlimited news sources',
        'White-glove onboarding',
        'Custom brand workshop',
        'Dedicated success manager',
        'API access',
        'Monthly strategy calls'
      ],
      limitations: [],
      bestFor: [
        'Founders & CEOs',
        'Public speakers',
        'Industry disruptors',
        'Media personalities'
      ],
      icon: '🔥',
      color: 'purple'
    }
  ];

  useEffect(() => {
    // Auto-recommend based on brand framework
    if (user?.brandFramework) {
      const { targetAudience, personalityTraits } = user.brandFramework;
      
      // Simple recommendation logic
      if (personalityTraits.includes('Introvert')) {
        setSelectedTier('starter');
      } else if (targetAudience.includes('C-suite')) {
        setSelectedTier('executive');
      } else {
        setSelectedTier('professional');
      }
    }
  }, [user]);

  const getRecommendedTier = () => {
    if (selectedGoal) {
      const goal = goals.find(g => g.id === selectedGoal);
      return goal?.recommendedTier || 'professional';
    }
    return '';
  };

  const calculateSavings = (tier: TierOption) => {
    const yearlySavings = (tier.price.monthly * 12) - tier.price.yearly;
    const percentSavings = Math.round((yearlySavings / (tier.price.monthly * 12)) * 100);
    return { amount: yearlySavings, percent: percentSavings };
  };

  const handleSelectTier = async (tierId: string) => {
    setSelectedTier(tierId);
    
    // Update user's tier
    try {
      const response = await fetch('/api/subscription/select-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.accessToken}`
        },
        body: JSON.stringify({
          tier: tierId,
          billingCycle,
          goal: selectedGoal
        })
      });

      if (response.ok) {
        const data = await response.json();
        dispatch(updateUser({ postingTier: tierId }));
        
        // Redirect to payment or RSS setup
        navigate('/rss-setup');
      }
    } catch (error) {
      console.error('Error selecting tier:', error);
    }
  };

  const recommendedTierId = getRecommendedTier();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Content Velocity
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Select a posting tier that matches your goals and lifestyle
          </p>
        </div>

        {/* Goal Selection */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            What's your primary goal with LinkedIn?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setSelectedGoal(goal.id)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedGoal === goal.id
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h3 className="font-semibold text-gray-900 mb-1">
                  {goal.label}
                </h3>
                <p className="text-sm text-gray-600">
                  {goal.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-full p-1 shadow-md">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600'
              }`}
            >
              Yearly (Save 20%)
            </button>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {tiers.map((tier) => {
            const isRecommended = recommendedTierId === tier.id;
            const savings = calculateSavings(tier);
            
            return (
              <div
                key={tier.id}
                className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all hover:scale-105 ${
                  isRecommended ? 'ring-4 ring-purple-600' : ''
                }`}
              >
                {isRecommended && (
                  <div className="absolute top-0 right-0 bg-purple-600 text-white px-4 py-1 rounded-bl-lg text-sm font-semibold">
                    Recommended
                  </div>
                )}

                <div className={`p-8 bg-gradient-to-br from-${tier.color}-50 to-white`}>
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-3">{tier.icon}</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {tier.name}
                    </h3>
                    <p className="text-gray-600">{tier.tagline}</p>
                  </div>

                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-gray-900">
                      ${billingCycle === 'monthly' ? tier.price.monthly : Math.round(tier.price.yearly / 12)}
                      <span className="text-lg font-normal text-gray-600">/month</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-sm text-green-600 font-medium mt-1">
                        Save ${savings.amount} ({savings.percent}% off)
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    <h4 className="font-semibold text-gray-900">Features:</h4>
                    {tier.features.map((feature, index) => (
                      <div key={index} className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {tier.limitations.length > 0 && (
                    <div className="space-y-2 mb-6">
                      <h4 className="font-semibold text-gray-900">Not included:</h4>
                      {tier.limitations.map((limitation, index) => (
                        <div key={index} className="flex items-start">
                          <span className="text-gray-400 mr-2">•</span>
                          <span className="text-sm text-gray-500">{limitation}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-2">Best for:</h4>
                    <div className="flex flex-wrap gap-2">
                      {tier.bestFor.map((persona, index) => (
                        <span
                          key={index}
                          className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full"
                        >
                          {persona}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectTier(tier.id)}
                    className={`w-full py-3 rounded-lg font-semibold transition-all ${
                      isRecommended
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {selectedTier === tier.id ? 'Selected' : 'Select This Plan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center"
          >
            {showComparison ? 'Hide' : 'Show'} detailed comparison
            <svg
              className={`w-5 h-5 ml-1 transform transition-transform ${
                showComparison ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {showComparison && (
          <div className="bg-white rounded-2xl shadow-xl p-8 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-4 px-4">Feature</th>
                  {tiers.map((tier) => (
                    <th key={tier.id} className="text-center py-4 px-4">
                      <div className="text-2xl mb-1">{tier.icon}</div>
                      <div className="font-semibold">{tier.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Posts per week</td>
                  <td className="text-center py-4 px-4">2-3</td>
                  <td className="text-center py-4 px-4">5-7</td>
                  <td className="text-center py-4 px-4">14-21</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">RSS feeds</td>
                  <td className="text-center py-4 px-4">5</td>
                  <td className="text-center py-4 px-4">15</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Content variations</td>
                  <td className="text-center py-4 px-4">3</td>
                  <td className="text-center py-4 px-4">5</td>
                  <td className="text-center py-4 px-4">10+</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Approval window</td>
                  <td className="text-center py-4 px-4">24 hours</td>
                  <td className="text-center py-4 px-4">2 hours</td>
                  <td className="text-center py-4 px-4">Instant</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Trend detection</td>
                  <td className="text-center py-4 px-4">❌</td>
                  <td className="text-center py-4 px-4">✅</td>
                  <td className="text-center py-4 px-4">✅</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Competitor analysis</td>
                  <td className="text-center py-4 px-4">❌</td>
                  <td className="text-center py-4 px-4">✅</td>
                  <td className="text-center py-4 px-4">✅</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Success manager</td>
                  <td className="text-center py-4 px-4">❌</td>
                  <td className="text-center py-4 px-4">❌</td>
                  <td className="text-center py-4 px-4">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I change tiers anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your tier at any time. Changes take effect at your next billing cycle.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Do I need to connect LinkedIn?
              </h3>
              <p className="text-gray-600">
                Yes, LinkedIn connection is required for auto-posting. We use official LinkedIn APIs and never store your password.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                What happens to unused posts?
              </h3>
              <p className="text-gray-600">
                Posts don't roll over month-to-month, but you can always manually post any generated content.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Your first voice discovery call is free. After that, you can start with any tier and cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TierSelectionPage;