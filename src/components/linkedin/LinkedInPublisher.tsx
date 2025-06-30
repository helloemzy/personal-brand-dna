import React, { useState, useEffect } from 'react';
import { 
  FaLinkedin, 
  FaCheckCircle, 
  FaTimesCircle,
  FaExclamationTriangle,
  FaChartLine,
  FaShieldAlt
} from 'react-icons/fa';

// Type assertion to fix React Icons issue
const FaLinkedinIcon = FaLinkedin as any;
const FaCheckCircleIcon = FaCheckCircle as any;
const FaTimesCircleIcon = FaTimesCircle as any;
const FaExclamationTriangleIcon = FaExclamationTriangle as any;
const FaChartLineIcon = FaChartLine as any;
const FaShieldAltIcon = FaShieldAlt as any;

interface LinkedInPublisherProps {
  contentId?: string;
  initialContent?: string;
}

interface SafetyCheck {
  type: string;
  passed: boolean;
  message: string;
}

interface RateLimits {
  daily: { used: number; limit: number; remaining: number };
  hourly: { used: number; limit: number; remaining: number };
  weekly: { used: number; limit: number; remaining: number };
  monthly: { used: number; limit: number; remaining: number };
}

const LinkedInPublisher: React.FC<LinkedInPublisherProps> = ({ 
  contentId, 
  initialContent = '' 
}) => {
  
  const [postText, setPostText] = useState(initialContent);
  const [postType, setPostType] = useState<'text' | 'article' | 'image'>('text');
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [safetyChecks, setSafetyChecks] = useState<SafetyCheck[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimits | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'info' });

  // Check LinkedIn connection status
  useEffect(() => {
    checkLinkedInStatus();
    fetchRateLimits();
  }, []);

  // Real-time safety checks as user types will be handled after performSafetyChecks is defined

  const checkLinkedInStatus = async () => {
    try {
      const response = await fetch('/api/linkedin/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setIsConnected(data.connected);
    } catch (error) {
      console.error('Failed to check LinkedIn status:', error);
    }
  };

  const fetchRateLimits = async () => {
    try {
      const response = await fetch('/api/linkedin/limits', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setRateLimits(data.limits);
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
    }
  };

  const performSafetyChecks = () => {
    const checks: SafetyCheck[] = [];
    
    // Length check
    const length = postText.length;
    checks.push({
      type: 'length',
      passed: length <= 3000,
      message: length <= 3000 
        ? `Content length: ${length}/3000 characters`
        : `Content too long: ${length}/3000 characters`
    });
    
    // Hashtag check
    const hashtags = (postText.match(/#\w+/g) || []).length;
    checks.push({
      type: 'hashtags',
      passed: hashtags <= 30,
      message: hashtags <= 30
        ? `Hashtags: ${hashtags}/30`
        : `Too many hashtags: ${hashtags}/30`
    });
    
    // URL check
    const urls = (postText.match(/https?:\/\/[^\s]+/g) || []).length;
    checks.push({
      type: 'urls',
      passed: urls <= 10,
      message: urls <= 10
        ? `URLs: ${urls}/10`
        : `Too many URLs: ${urls}/10`
    });
    
    // Sensitive info check
    const hasSensitive = checkSensitiveInfo(postText);
    checks.push({
      type: 'sensitive',
      passed: !hasSensitive,
      message: hasSensitive
        ? 'May contain sensitive information'
        : 'No sensitive information detected'
    });
    
    setSafetyChecks(checks);
    setShowSafetyWarning(checks.some(check => !check.passed));
  };

  const checkSensitiveInfo = (text: string): boolean => {
    const patterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/, // Credit card
      /password\s*[:=]/i,
      /api[_-]?key\s*[:=]/i
    ];
    return patterns.some(pattern => pattern.test(text));
  };

  // Real-time safety checks as user types
  useEffect(() => {
    if (postText) {
      const timer = setTimeout(() => {
        performSafetyChecks();
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [postText]);

  const connectLinkedIn = () => {
    window.location.href = '/api/linkedin/auth';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      setToast({
        show: true,
        message: 'Please connect your LinkedIn account first',
        type: 'error'
      });
      return;
    }
    
    if (showSafetyWarning) {
      setShowPreview(true);
      return;
    }
    
    await addToQueue();
  };

  const addToQueue = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/linkedin/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contentId,
          postText,
          postType,
          scheduledFor: isScheduled ? scheduledFor : null
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setToast({
          show: true,
          message: 'Content added to publishing queue for review',
          type: 'success'
        });
        setPostText('');
        setScheduledFor('');
        setIsScheduled(false);
        fetchRateLimits(); // Refresh rate limits
      } else {
        setToast({
          show: true,
          message: data.error || 'Failed to add to queue',
          type: 'error'
        });
      }
    } catch (error) {
      setToast({
        show: true,
        message: 'An error occurred. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
      setShowPreview(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <FaLinkedinIcon className="mr-2 text-blue-600" />
          LinkedIn Publisher
        </h2>
        
        {!isConnected ? (
          <button
            onClick={connectLinkedIn}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <FaLinkedinIcon className="mr-2" />
            Connect LinkedIn
          </button>
        ) : (
          <div className="flex items-center text-green-600">
            <FaCheckCircleIcon className="mr-2" />
            LinkedIn Connected
          </div>
        )}
      </div>

      {/* Rate Limits Display */}
      {rateLimits && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
            <FaChartLineIcon className="mr-2" />
            Posting Limits
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Daily:</span>
              <span className={`ml-2 font-medium ${
                rateLimits.daily.remaining === 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {rateLimits.daily.used}/{rateLimits.daily.limit}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Hourly:</span>
              <span className={`ml-2 font-medium ${
                rateLimits.hourly.remaining === 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {rateLimits.hourly.used}/{rateLimits.hourly.limit}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Weekly:</span>
              <span className="ml-2 font-medium text-gray-900">
                {rateLimits.weekly.used}/{rateLimits.weekly.limit}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Monthly:</span>
              <span className="ml-2 font-medium text-gray-900">
                {rateLimits.monthly.used}/{rateLimits.monthly.limit}
              </span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Post Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Post Type
          </label>
          <div className="flex space-x-4">
            {(['text', 'article', 'image'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPostType(type)}
                className={`px-4 py-2 rounded-lg capitalize ${
                  postType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Content Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Post Content
          </label>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="What would you like to share on LinkedIn?"
            required
          />
          <div className="mt-1 text-right text-sm text-gray-600">
            {postText.length}/3000 characters
          </div>
        </div>

        {/* Schedule Options */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">
              Schedule for later
            </span>
          </label>
          
          {isScheduled && (
            <div className="mt-2">
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required={isScheduled}
              />
            </div>
          )}
        </div>

        {/* Safety Checks */}
        {safetyChecks.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <FaShieldAltIcon className="mr-2" />
              Safety Checks
            </h3>
            <div className="space-y-1">
              {safetyChecks.map((check, index) => (
                <div key={index} className="flex items-center text-sm">
                  {check.passed ? (
                    <FaCheckCircleIcon className="text-green-500 mr-2" />
                  ) : (
                    <FaTimesCircleIcon className="text-red-500 mr-2" />
                  )}
                  <span className={check.passed ? 'text-gray-700' : 'text-red-700'}>
                    {check.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          {showSafetyWarning && (
            <div className="flex items-center text-amber-600 mr-auto">
              <FaExclamationTriangleIcon className="mr-2" />
              <span className="text-sm">Please review safety warnings</span>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading || !isConnected || postText.length === 0}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isLoading || !isConnected || postText.length === 0
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Processing...' : 'Add to Publishing Queue'}
          </button>
        </div>
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold mb-4">Content Preview & Safety Review</h3>
            
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-semibold text-amber-800 mb-2">
                Safety Warnings Detected
              </h4>
              <ul className="space-y-1">
                {safetyChecks
                  .filter(check => !check.passed)
                  .map((check, index) => (
                    <li key={index} className="text-sm text-amber-700">
                      • {check.message}
                    </li>
                  ))}
              </ul>
            </div>
            
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Post Preview:</h4>
              <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                {postText}
              </div>
            </div>
            
            {isScheduled && (
              <div className="mb-4">
                <span className="text-sm text-gray-600">
                  Scheduled for: {formatDate(scheduledFor)}
                </span>
              </div>
            )}
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">
                Important Reminder:
              </h4>
              <p className="text-sm text-blue-800">
                This content will be added to your publishing queue for manual review. 
                You must approve it before it can be published to LinkedIn. 
                We never post automatically without your explicit approval.
              </p>
            </div>
            
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={addToQueue}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirm & Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg ${
          toast.type === 'success' ? 'bg-green-100 text-green-800' :
          toast.type === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          <div className="flex items-center justify-between">
            <span>{toast.message}</span>
            <button
              onClick={() => setToast({ ...toast, show: false })}
              className="ml-4 text-gray-600 hover:text-gray-800"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkedInPublisher;