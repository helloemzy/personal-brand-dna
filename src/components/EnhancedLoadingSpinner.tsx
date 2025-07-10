import React from 'react';
import { Loader2, Brain, Sparkles, Zap, Target, Users } from 'lucide-react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  type?: 'default' | 'dots' | 'pulse' | 'bounce' | 'gradient';
  context?: 'workshop' | 'content' | 'analysis' | 'saving' | 'processing';
  message?: string;
  showIcon?: boolean;
  duration?: number; // For progress indication
}

const EnhancedLoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  type = 'default',
  context = 'processing',
  message,
  showIcon = true,
  duration
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'md':
        return 'w-6 h-6';
      case 'lg':
        return 'w-8 h-8';
      case 'xl':
        return 'w-12 h-12';
      default:
        return 'w-6 h-6';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'text-indigo-600';
      case 'secondary':
        return 'text-gray-600';
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'danger':
        return 'text-red-600';
      default:
        return 'text-indigo-600';
    }
  };

  const getContextIcon = () => {
    const iconClass = `${getSizeClasses()} ${getVariantClasses()}`;
    
    switch (context) {
      case 'workshop':
        return <Target className={iconClass} />;
      case 'content':
        return <Sparkles className={iconClass} />;
      case 'analysis':
        return <Brain className={iconClass} />;
      case 'saving':
        return <Zap className={iconClass} />;
      case 'processing':
      default:
        return <Loader2 className={`${iconClass} animate-spin`} />;
    }
  };

  const getContextMessage = () => {
    if (message) return message;
    
    switch (context) {
      case 'workshop':
        return 'Building your brand framework...';
      case 'content':
        return 'Generating personalized content...';
      case 'analysis':
        return 'Analyzing your responses...';
      case 'saving':
        return 'Saving your progress...';
      case 'processing':
      default:
        return 'Processing...';
    }
  };

  const renderLoadingAnimation = () => {
    const baseClasses = `${getSizeClasses()} ${getVariantClasses()}`;
    
    switch (type) {
      case 'dots':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 ${getVariantClasses().replace('text-', 'bg-')} rounded-full animate-pulse`}
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        );
        
      case 'pulse':
        return (
          <div 
            className={`${baseClasses} rounded-full border-2 border-current opacity-75 animate-ping`}
          />
        );
        
      case 'bounce':
        return (
          <div className={`${baseClasses} animate-bounce`}>
            {showIcon && getContextIcon()}
          </div>
        );
        
      case 'gradient':
        return (
          <div className="relative">
            <div className={`${baseClasses} opacity-25`}>
              <Loader2 className="w-full h-full" />
            </div>
            <div className={`absolute inset-0 ${baseClasses} animate-spin`}>
              <Loader2 className="w-full h-full" />
            </div>
          </div>
        );
        
      case 'default':
      default:
        return (
          <div className={`${baseClasses} animate-spin`}>
            {showIcon && <Loader2 className="w-full h-full" />}
          </div>
        );
    }
  };

  const containerClasses = `
    flex flex-col items-center justify-center space-y-3 p-4
    ${size === 'xl' ? 'min-h-[200px]' : size === 'lg' ? 'min-h-[150px]' : 'min-h-[100px]'}
  `;

  return (
    <div className={containerClasses} role="status" aria-live="polite">
      <div className="relative">
        {renderLoadingAnimation()}
        
        {/* Progress ring if duration is provided */}
        {duration && (
          <div className="absolute inset-0 -m-2">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-gray-200"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray="283"
                strokeDashoffset="283"
                className={getVariantClasses()}
                style={{
                  animation: `progress ${duration}ms linear forwards`
                }}
              />
            </svg>
          </div>
        )}
      </div>
      
      {/* Loading message */}
      <div className="text-center">
        <p className={`text-sm font-medium ${getVariantClasses()}`}>
          {getContextMessage()}
        </p>
        
        {/* Contextual tips */}
        {context === 'workshop' && (
          <p className="text-xs text-gray-500 mt-1">
            This helps us personalize your content strategy
          </p>
        )}
        
        {context === 'content' && (
          <p className="text-xs text-gray-500 mt-1">
            Using your voice profile for authentic results
          </p>
        )}
        
        {context === 'analysis' && (
          <p className="text-xs text-gray-500 mt-1">
            Determining your unique brand archetype
          </p>
        )}
      </div>
      
      <style jsx>{`
        @keyframes progress {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};

// Preset configurations for common use cases
export const WorkshopLoadingSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <EnhancedLoadingSpinner 
    context="workshop" 
    size="lg" 
    type="gradient" 
    message={message}
  />
);

export const ContentGenerationSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <EnhancedLoadingSpinner 
    context="content" 
    size="md" 
    type="dots" 
    variant="primary"
    message={message}
  />
);

export const AnalysisSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <EnhancedLoadingSpinner 
    context="analysis" 
    size="lg" 
    type="pulse" 
    variant="secondary"
    message={message}
  />
);

export const SavingSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <EnhancedLoadingSpinner 
    context="saving" 
    size="sm" 
    type="default" 
    variant="success"
    message={message}
  />
);

export default EnhancedLoadingSpinner;