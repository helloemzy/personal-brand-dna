import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

interface TrialBannerProps {
  daysLeft: number;
  tier: string;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ daysLeft, tier }) => {
  if (daysLeft > 7) return null; // Don't show if more than 7 days left
  
  const urgencyClass = daysLeft <= 3 ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-400';
  const iconColor = daysLeft <= 3 ? 'text-red-400' : 'text-yellow-400';
  
  return (
    <div className={`border-l-4 p-4 mb-6 ${urgencyClass}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">
            Your free trial ends in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Upgrade now to keep using all {tier} features and maintain your posting schedule.
          </p>
          <div className="mt-3">
            <Link
              to="/subscription"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Upgrade to {tier} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;