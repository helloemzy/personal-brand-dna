import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Cookie, 
  BarChart3, 
  Megaphone, 
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  Info,
  ChevronLeft,
  Database,
  Download,
  Trash2
} from 'lucide-react';
import { trackingService, PrivacySettings } from '../services/trackingService';
import { useTracking } from '../hooks/useTracking';

const AnalyticsSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { trackEvent } = useTracking();
  const [settings, setSettings] = useState<PrivacySettings>(
    trackingService.getPrivacySettings()
  );
  const [saved, setSaved] = useState(false);
  const [showDataDeletion, setShowDataDeletion] = useState(false);

  const handleSave = () => {
    trackingService.updatePrivacySettings(settings);
    setSaved(true);
    trackEvent('Settings', 'Privacy Updated', JSON.stringify(settings));
    
    setTimeout(() => setSaved(false), 3000);
  };

  const handleExportData = async () => {
    trackEvent('Settings', 'Data Export Requested');
    
    // In production, this would call an API to generate a data export
    const data = {
      privacySettings: settings,
      analyticsData: trackingService.getSessionAnalytics(),
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brandpillar-analytics-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteData = () => {
    trackEvent('Settings', 'Data Deletion Requested');
    
    // Clear all analytics data
    localStorage.removeItem('privacy_settings');
    sessionStorage.clear();
    
    // Reset to default settings
    const defaultSettings: PrivacySettings = {
      consentGiven: false,
      analyticsEnabled: false,
      performanceEnabled: false,
      marketingEnabled: false,
      anonymousMode: true,
      doNotTrack: true,
    };
    
    setSettings(defaultSettings);
    trackingService.updatePrivacySettings(defaultSettings);
    setShowDataDeletion(false);
    
    // Redirect to home
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics & Privacy Settings</h1>
              <p className="text-gray-600 mt-1">Control how we collect and use your data</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Privacy Overview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-2">Your Privacy Matters</h3>
              <p className="text-sm text-blue-700">
                We are committed to protecting your privacy. All data collection is transparent, 
                and you have full control over what information we gather. We never sell your 
                data to third parties.
              </p>
            </div>
          </div>
        </div>

        {/* Cookie Settings */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              Cookie Preferences
            </h2>

            <div className="space-y-4">
              {/* Essential Cookies */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Essential Cookies</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Required for the website to function properly. These cookies enable core 
                        functionality such as security, network management, and accessibility.
                      </p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="h-4 w-4 text-indigo-600 rounded cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Analytics Cookies</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Help us understand how visitors interact with our website by collecting 
                        and reporting information anonymously. Used to improve user experience.
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        Includes: Google Analytics, internal analytics
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={settings.analyticsEnabled}
                      onChange={(e) => setSettings({
                        ...settings,
                        analyticsEnabled: e.target.checked,
                      })}
                      className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Performance Cookies */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Performance Cookies</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Allow us to count visits and traffic sources to measure and improve 
                        the performance of our site. Help us know which pages are most popular.
                      </p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={settings.performanceEnabled}
                      onChange={(e) => setSettings({
                        ...settings,
                        performanceEnabled: e.target.checked,
                      })}
                      className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Megaphone className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Marketing Cookies</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Used to track visitors across websites to display ads that are relevant 
                        and engaging. Usually placed by advertising networks.
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        Includes: Facebook Pixel, LinkedIn Insight Tag
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={settings.marketingEnabled}
                      onChange={(e) => setSettings({
                        ...settings,
                        marketingEnabled: e.target.checked,
                      })}
                      className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Options */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy Options
            </h2>

            <div className="space-y-4">
              {/* Anonymous Mode */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <EyeOff className="h-5 w-5 text-gray-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Anonymous Mode</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      When enabled, your data will be anonymized and not linked to your account. 
                      This may limit some personalized features.
                    </p>
                  </div>
                </div>
                <div className="ml-4">
                  <input
                    type="checkbox"
                    checked={settings.anonymousMode}
                    onChange={(e) => setSettings({
                      ...settings,
                      anonymousMode: e.target.checked,
                    })}
                    className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Do Not Track */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Eye className="h-5 w-5 text-gray-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Honor Do Not Track</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Respect your browser's Do Not Track signal and disable all non-essential 
                      tracking when detected.
                    </p>
                  </div>
                </div>
                <div className="ml-4">
                  <input
                    type="checkbox"
                    checked={settings.doNotTrack}
                    onChange={(e) => setSettings({
                      ...settings,
                      doNotTrack: e.target.checked,
                    })}
                    className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5" />
              Your Data
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Export Your Data</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Download all the data we have collected about you in JSON format.
                  </p>
                </div>
                <button
                  onClick={handleExportData}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-red-600">Delete All Data</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Permanently delete all analytics data we have collected. This cannot be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDataDeletion(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>

        {saved && (
          <div className="mt-4 text-center text-green-600">
            Settings saved successfully!
          </div>
        )}
      </div>

      {/* Data Deletion Modal */}
      {showDataDeletion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold">Delete All Analytics Data?</h3>
                <p className="text-gray-600 mt-2">
                  This will permanently delete all analytics data we have collected about you. 
                  This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDataDeletion(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsSettingsPage;