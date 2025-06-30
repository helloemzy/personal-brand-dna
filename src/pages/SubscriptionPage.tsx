import React from 'react';
import { useAppSelector } from '../hooks/redux';

const SubscriptionPage: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        'Voice discovery',
        '3 posts per month',
        'Basic templates',
        'Email support',
      ],
      current: user?.subscriptionTier === 'free',
      buttonText: 'Current Plan',
      buttonStyle: 'bg-gray-100 text-gray-600 cursor-not-allowed',
    },
    {
      name: 'Professional',
      price: '$49',
      period: 'per month',
      features: [
        'Everything in Free',
        'Unlimited posts',
        'Advanced analytics',
        'Content calendar',
        'Priority support',
        'Industry trend integration',
      ],
      current: user?.subscriptionTier === 'professional',
      popular: true,
      buttonText: user?.subscriptionTier === 'professional' ? 'Current Plan' : 'Upgrade Now',
      buttonStyle: user?.subscriptionTier === 'professional' 
        ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
        : 'bg-blue-600 text-white hover:bg-blue-700',
    },
    {
      name: 'Executive',
      price: '$149',
      period: 'per month',
      features: [
        'Everything in Professional',
        'Speaking prep assistance',
        'Team features',
        'Brand consistency tools',
        'Custom templates',
        'Dedicated account manager',
      ],
      current: user?.subscriptionTier === 'executive',
      buttonText: user?.subscriptionTier === 'executive' ? 'Current Plan' : 'Upgrade Now',
      buttonStyle: user?.subscriptionTier === 'executive'
        ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
        : 'bg-blue-600 text-white hover:bg-blue-700',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Subscription & Billing
        </h1>
        <p className="text-lg text-gray-600">
          Choose the plan that best fits your professional content needs.
        </p>
      </div>

      {/* Current Subscription Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              Current Plan: {user?.subscriptionTier}
            </h3>
            <p className="text-gray-600">
              {user?.subscriptionTier === 'free' 
                ? 'You have 3 free posts remaining this month'
                : `Billing cycle: Monthly • Next billing: February 15, 2024`
              }
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {user?.subscriptionTier === 'free' 
                ? '$0'
                : user?.subscriptionTier === 'professional' 
                ? '$49'
                : '$149'
              }
            </div>
            <div className="text-sm text-gray-500">per month</div>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan, index) => (
          <div
            key={index}
            className={`bg-white rounded-lg shadow-lg p-8 relative ${
              plan.popular ? 'border-2 border-blue-500' : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
            )}
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold text-gray-900 mb-1">{plan.price}</div>
              <div className="text-sm text-gray-500">{plan.period}</div>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, featureIndex) => (
                <li key={featureIndex} className="flex items-center text-sm">
                  <svg className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${plan.buttonStyle}`}
              disabled={plan.current}
              onClick={() => {
                if (!plan.current) {
                  alert('Stripe integration will be implemented for payment processing');
                }
              }}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing History</h3>
        
        {user?.subscriptionTier === 'free' ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">💳</div>
            <p>No billing history available</p>
            <p className="text-sm mt-1">You're currently on the free plan</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Placeholder for billing history */}
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">📄</div>
              <p>Billing history will appear here</p>
              <p className="text-sm mt-1">Recent invoices and payment history</p>
            </div>
          </div>
        )}
      </div>

      {/* FAQs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Can I change my plan anytime?</h4>
            <p className="text-sm text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">What happens to my content if I downgrade?</h4>
            <p className="text-sm text-gray-600">Your existing content remains accessible, but new content generation will be limited to your plan's allowance.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Do you offer refunds?</h4>
            <p className="text-sm text-gray-600">We offer a 30-day money-back guarantee for all paid plans if you're not satisfied.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;