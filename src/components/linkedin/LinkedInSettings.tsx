import React, { useState, useEffect } from 'react';
import {
  FaLinkedin,
  FaCheckCircle,
  FaTimesCircle,
  FaShieldAlt,
  FaCog,
  FaExclamationTriangle,
  FaDownload,
  FaTrash
} from 'react-icons/fa';
import Toast, { toast } from '../Toast';

interface LinkedInStatus {
  connected: boolean;
  linkedinUserName?: string;
  expiresAt?: string;
}

interface ComplianceData {
  totalActions: number;
  postsPublished: number;
  postsRejected: number;
  privacyActions: number;
  lastActionAt: string;
}

const LinkedInSettings: React.FC = () => {
  const [status, setStatus] = useState<LinkedInStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  
  const [preferences, setPreferences] = useState({
    autoApprove: false,
    notifyOnPublish: true,
    notifyOnEngagement: true,
    defaultScheduleTime: '09:00',
    weekendPosting: false
  });
  

  useEffect(() => {
    checkLinkedInStatus();
    fetchCompliance();
  }, []);

  const checkLinkedInStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/linkedin/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setStatus({
          connected: data.connected,
          linkedinUserName: data.linkedinUserName,
          expiresAt: data.expiresAt
        });
      }
    } catch (error) {
      console.error('Failed to check LinkedIn status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompliance = async () => {
    try {
      const response = await fetch('/api/linkedin/compliance', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setCompliance(data.compliance);
      }
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
    }
  };

  const connectLinkedIn = () => {
    window.location.href = '/api/linkedin/auth';
  };

  const disconnectLinkedIn = async () => {
    try {
      const response = await fetch('/api/linkedin/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setStatus({ connected: false });
        setShowDisconnectModal(false);
        toast.success('LinkedIn account disconnected successfully');
      }
    } catch (error) {
      toast.error('Failed to disconnect LinkedIn account');
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/linkedin/data/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linkedin-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        toast.success('Data exported successfully');
      }
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const deleteData = async () => {
    try {
      const response = await fetch('/api/linkedin/data', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setShowDataModal(false);
        toast.success('LinkedIn data deleted successfully');
        // Refresh status
        checkLinkedInStatus();
      }
    } catch (error) {
      toast.error('Failed to delete data');
    }
  };

  const savePreferences = async () => {
    try {
      const response = await fetch('/api/linkedin/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(preferences)
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Preferences saved successfully');
      }
    } catch (error) {
      toast.error('Failed to save preferences');
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

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days`;
    return `${hours} hours`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <FaLinkedin className="mr-2 text-blue-600" />
          LinkedIn Settings
        </h2>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Connection Status */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Connection Status
            </h3>
            
            {status.connected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FaCheckCircle className="text-green-600 text-xl mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">Connected as {status.linkedinUserName}</p>
                      <p className="text-sm text-gray-600">
                        Token expires in {getTimeUntilExpiry(status.expiresAt!)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDisconnectModal(true)}
                    className="px-4 py-2 text-red-600 hover:text-red-800 border border-red-600 rounded-lg hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                </div>
                
                {status.expiresAt && new Date(status.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && (
                  <div className="flex items-center p-3 bg-amber-50 rounded-lg">
                    <FaExclamationTriangle className="text-amber-600 mr-2" />
                    <span className="text-sm text-amber-800">
                      Your LinkedIn connection will expire soon. You'll need to reconnect to continue publishing.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FaTimesCircle className="text-gray-400 text-4xl mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No LinkedIn account connected</p>
                <button
                  onClick={connectLinkedIn}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center"
                >
                  <FaLinkedin className="mr-2" />
                  Connect LinkedIn Account
                </button>
              </div>
            )}
          </div>

          {/* Publishing Preferences */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FaCog className="mr-2" />
              Publishing Preferences
            </h3>
            
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> Auto-approval is disabled for safety. All posts must be manually reviewed before publishing.
                </p>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.notifyOnPublish}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      notifyOnPublish: e.target.checked
                    })}
                    className="mr-3"
                  />
                  <span className="text-gray-700">
                    Email me when content is published
                  </span>
                </label>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.notifyOnEngagement}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      notifyOnEngagement: e.target.checked
                    })}
                    className="mr-3"
                  />
                  <span className="text-gray-700">
                    Email me about high engagement posts
                  </span>
                </label>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.weekendPosting}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      weekendPosting: e.target.checked
                    })}
                    className="mr-3"
                  />
                  <span className="text-gray-700">
                    Allow weekend posting
                  </span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Schedule Time
                </label>
                <input
                  type="time"
                  value={preferences.defaultScheduleTime}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    defaultScheduleTime: e.target.value
                  })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                onClick={savePreferences}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Save Preferences
              </button>
            </div>
          </div>

          {/* Privacy & Data */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FaShieldAlt className="mr-2" />
              Privacy & Data Management
            </h3>
            
            {compliance && (
              <div className="mb-4 p-4 bg-white rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-2">Activity Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Actions:</span>
                    <span className="ml-2 font-medium">{compliance.totalActions}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Posts Published:</span>
                    <span className="ml-2 font-medium">{compliance.postsPublished}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Posts Rejected:</span>
                    <span className="ml-2 font-medium">{compliance.postsRejected}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Privacy Actions:</span>
                    <span className="ml-2 font-medium">{compliance.privacyActions}</span>
                  </div>
                </div>
                {compliance.lastActionAt && (
                  <p className="text-sm text-gray-600 mt-2">
                    Last activity: {formatDate(compliance.lastActionAt)}
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-4">
              <button
                onClick={exportData}
                className="w-full flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <FaDownload className="mr-2" />
                Export My LinkedIn Data
              </button>
              
              <button
                onClick={() => setShowDataModal(true)}
                className="w-full flex items-center justify-center px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50"
              >
                <FaTrash className="mr-2" />
                Delete All LinkedIn Data
              </button>
              
              <div className="text-sm text-gray-600 space-y-1">
                <p>• Your data is encrypted and stored securely</p>
                <p>• We never post without your explicit approval</p>
                <p>• You can export or delete your data at any time</p>
                <p>• Analytics data is retained for 90 days</p>
              </div>
            </div>
          </div>

          {/* Security Information */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Security & Compliance
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>✓ OAuth 2.0 secure authentication</p>
              <p>✓ Encrypted token storage</p>
              <p>✓ Automatic token refresh</p>
              <p>✓ Rate limiting protection</p>
              <p>✓ Content safety checks</p>
              <p>✓ GDPR compliant data handling</p>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Disconnect LinkedIn Account</h3>
            
            <p className="text-gray-700 mb-4">
              Are you sure you want to disconnect your LinkedIn account? This will:
            </p>
            
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1">
              <li>Stop all pending publications</li>
              <li>Prevent new content from being published</li>
              <li>Remove your LinkedIn authentication</li>
              <li>Keep your historical data and analytics</li>
            </ul>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={disconnectLinkedIn}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Data Modal */}
      {showDataModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Delete LinkedIn Data</h3>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 font-medium mb-2">
                Warning: This action cannot be undone
              </p>
              <p className="text-red-700 text-sm">
                All your LinkedIn data will be permanently deleted, including:
              </p>
            </div>
            
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1">
              <li>Publishing history</li>
              <li>Analytics and engagement data</li>
              <li>Scheduled posts</li>
              <li>LinkedIn connection</li>
            </ul>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDataModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={deleteData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast />
    </div>
  );
};

export default LinkedInSettings;