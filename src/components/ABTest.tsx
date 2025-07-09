import React, { useEffect, useState } from 'react';
import { useTracking } from '../hooks/useTracking';

interface ABTestProps {
  testId: string;
  variants: {
    [key: string]: React.ReactNode;
  };
  defaultVariant?: string;
  onVariantShown?: (variant: string) => void;
  trackImpression?: boolean;
}

export const ABTest: React.FC<ABTestProps> = ({
  testId,
  variants,
  defaultVariant = 'control',
  onVariantShown,
  trackImpression = true,
}) => {
  const { getABTestVariant, trackABTestEvent } = useTracking();
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  useEffect(() => {
    // Get variant assignment
    const variantKeys = Object.keys(variants);
    const variant = getABTestVariant(testId, variantKeys);
    setSelectedVariant(variant);

    // Track impression
    if (trackImpression) {
      trackABTestEvent(testId, 'impression', { variant });
    }

    // Callback
    if (onVariantShown) {
      onVariantShown(variant);
    }
  }, [testId, variants, getABTestVariant, trackABTestEvent, trackImpression, onVariantShown]);

  // Return the selected variant or default
  const variantToShow = selectedVariant && variants[selectedVariant] 
    ? variants[selectedVariant] 
    : variants[defaultVariant];

  return <>{variantToShow}</>;
};

// Hook for programmatic A/B testing
export function useABTest(testId: string, variants: string[]): {
  variant: string;
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  trackConversion: (value?: number) => void;
} {
  const { getABTestVariant, trackABTestEvent, trackABTestConversion } = useTracking();
  const [variant, setVariant] = useState<string>('');

  useEffect(() => {
    const assignedVariant = getABTestVariant(testId, variants);
    setVariant(assignedVariant);
  }, [testId, variants, getABTestVariant]);

  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    trackABTestEvent(testId, eventName, properties);
  };

  const trackConversion = (value?: number) => {
    trackABTestConversion(testId, value);
  };

  return { variant, trackEvent, trackConversion };
}

// Feature flag component (simplified A/B test with on/off)
interface FeatureFlagProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureFlag: React.FC<FeatureFlagProps> = ({
  flag,
  children,
  fallback = null,
}) => {
  return (
    <ABTest
      testId={`feature_${flag}`}
      variants={{
        on: children,
        off: fallback,
      }}
      defaultVariant="off"
    />
  );
};

// Example usage components
export const ABTestExample: React.FC = () => {
  const { trackABTestConversion } = useTracking();

  return (
    <div className="space-y-8">
      {/* Example 1: Button variant test */}
      <ABTest
        testId="homepage_cta_button"
        variants={{
          control: (
            <button 
              onClick={() => trackABTestConversion('homepage_cta_button', 1)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Get Started
            </button>
          ),
          variant_a: (
            <button 
              onClick={() => trackABTestConversion('homepage_cta_button', 1)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Start Free Trial
            </button>
          ),
          variant_b: (
            <button 
              onClick={() => trackABTestConversion('homepage_cta_button', 1)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              Build Your Brand <span>→</span>
            </button>
          ),
        }}
      />

      {/* Example 2: Headline variant test */}
      <ABTest
        testId="homepage_headline"
        variants={{
          control: (
            <h1 className="text-4xl font-bold text-gray-900">
              Build Your Personal Brand with AI
            </h1>
          ),
          emotional: (
            <h1 className="text-4xl font-bold text-gray-900">
              Stop Being the Best-Kept Secret in Your Industry
            </h1>
          ),
          value_prop: (
            <h1 className="text-4xl font-bold text-gray-900">
              10-Minute Setup, Lifetime of Opportunities
            </h1>
          ),
        }}
      />

      {/* Example 3: Feature flag */}
      <FeatureFlag flag="new_onboarding_flow">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">New Interactive Onboarding!</h2>
          <p>Experience our enhanced workshop with real-time guidance.</p>
        </div>
      </FeatureFlag>
    </div>
  );
};

// A/B Test Dashboard Component
export const ABTestDashboard: React.FC = () => {
  const [tests, setTests] = useState<Array<{
    testId: string;
    variants: string[];
    impressions: Record<string, number>;
    conversions: Record<string, number>;
  }>>([]);

  // In production, this would fetch from analytics API
  useEffect(() => {
    setTests([
      {
        testId: 'homepage_cta_button',
        variants: ['control', 'variant_a', 'variant_b'],
        impressions: { control: 1000, variant_a: 980, variant_b: 1020 },
        conversions: { control: 50, variant_a: 78, variant_b: 92 },
      },
      {
        testId: 'homepage_headline',
        variants: ['control', 'emotional', 'value_prop'],
        impressions: { control: 3000, emotional: 2950, value_prop: 3050 },
        conversions: { control: 150, emotional: 205, value_prop: 195 },
      },
    ]);
  }, []);

  const calculateConversionRate = (conversions: number, impressions: number) => {
    return impressions > 0 ? (conversions / impressions * 100).toFixed(2) : '0.00';
  };

  const calculateLift = (variant: number, control: number): string => {
    if (control === 0) return '0';
    return ((variant - control) / control * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Active A/B Tests</h2>
      
      {tests.map((test) => {
        const controlRate = parseFloat(
          calculateConversionRate(test.conversions.control, test.impressions.control)
        );

        return (
          <div key={test.testId} className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-medium mb-4">{test.testId}</h3>
            
            <div className="space-y-3">
              {test.variants.map((variant) => {
                const conversionRate = parseFloat(
                  calculateConversionRate(test.conversions[variant], test.impressions[variant])
                );
                const lift = variant === 'control' ? 0 : 
                  parseFloat(calculateLift(conversionRate, controlRate));
                const isWinning = conversionRate === Math.max(
                  ...test.variants.map(v => 
                    parseFloat(calculateConversionRate(test.conversions[v], test.impressions[v]))
                  )
                );

                return (
                  <div key={variant} className={`border rounded-lg p-4 ${
                    isWinning ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{variant}</span>
                        {isWinning && (
                          <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                            WINNING
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{conversionRate}%</p>
                        {variant !== 'control' && (
                          <p className={`text-sm ${
                            lift > 0 ? 'text-green-600' : lift < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {lift > 0 ? '+' : ''}{lift}% vs control
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {test.impressions[variant]} impressions • 
                      {test.conversions[variant]} conversions
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};