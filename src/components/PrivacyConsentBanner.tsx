import React, { useState, useEffect } from 'react';
import { X, Shield, Cookie, BarChart3, Megaphone, Settings } from 'lucide-react';
import { trackingService, PrivacySettings } from '../services/trackingService';

interface PrivacyConsentBannerProps {
  onClose?: () => void;
}

const PrivacyConsentBanner: React.FC<PrivacyConsentBannerProps> = ({ onClose }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>(
    trackingService.getPrivacySettings()
  );

  useEffect(() => {
    // Check if consent has been given
    const privacySettings = trackingService.getPrivacySettings();
    if (!privacySettings.consentGiven) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const newSettings: PrivacySettings = {
      consentGiven: true,
      consentTimestamp: new Date(),
      analyticsEnabled: true,
      performanceEnabled: true,
      marketingEnabled: true,
      anonymousMode: false,
      doNotTrack: false,
    };
    
    trackingService.updatePrivacySettings(newSettings);
    setShowBanner(false);
    onClose?.();
  };

  const handleAcceptEssential = () => {
    const newSettings: PrivacySettings = {
      consentGiven: true,
      consentTimestamp: new Date(),
      analyticsEnabled: false,
      performanceEnabled: true,
      marketingEnabled: false,
      anonymousMode: true,
      doNotTrack: true,
    };
    
    trackingService.updatePrivacySettings(newSettings);
    setShowBanner(false);
    onClose?.();
  };

  const handleSaveSettings = () => {
    trackingService.updatePrivacySettings({
      ...settings,
      consentGiven: true,
    });
    setShowBanner(false);
    setShowSettings(false);
    onClose?.();
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />

      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-2xl z-50 transform transition-transform duration-300">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Cookie className="h-8 w-8 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-900">Privacy & Cookies</h2>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {!showSettings ? (
            // Main consent view
            <div>
              <p className="text-gray-600 mb-6">
                We use cookies and similar technologies to enhance your experience, analyze site usage, 
                and assist in our marketing efforts. By clicking "Accept All", you consent to the use 
                of ALL cookies. You can manage your preferences by clicking "Customize".
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium">Essential</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Required for the website to function properly. Cannot be disabled.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium">Analytics</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Help us understand how visitors interact with our website.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="h-5 w-5 text-purple-600" />
                    <h3 className="font-medium">Marketing</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Used to deliver personalized advertisements and measure campaigns.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                >
                  <Settings className="h-4 w-4" />
                  Customize Settings
                </button>

                <div className="flex gap-4">
                  <button
                    onClick={handleAcceptEssential}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Essential Only
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Accept All
                  </button>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                By using our site, you agree to our{' '}
                <a href="/privacy-policy" className="text-indigo-600 hover:underline">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a href="/cookie-policy" className="text-indigo-600 hover:underline">
                  Cookie Policy
                </a>
                . Your data is processed in accordance with GDPR and CCPA regulations.
              </div>
            </div>
          ) : (
            // Settings view
            <div>
              <h3 className="text-lg font-medium mb-4">Customize Privacy Settings</h3>

              <div className="space-y-4 mb-6">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-5 w-5 text-green-600" />
                        <h4 className="font-medium">Essential Cookies</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        These cookies are necessary for the website to function and cannot be switched off.
                      </p>
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

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium">Analytics Cookies</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        These cookies help us understand how you interact with our website by collecting 
                        and reporting information anonymously.
                      </p>
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

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-5 w-5 text-orange-600" />
                        <h4 className="font-medium">Performance Cookies</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        These cookies help us understand how our website performs and identify areas 
                        for improvement.
                      </p>
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

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Megaphone className="h-5 w-5 text-purple-600" />
                        <h4 className="font-medium">Marketing Cookies</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        These cookies are used to deliver advertisements more relevant to you and 
                        your interests.
                      </p>
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

                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium mb-1">Anonymous Mode</h4>
                      <p className="text-sm text-gray-600">
                        When enabled, your data will be anonymized and not linked to your account.
                      </p>
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
                </div>
              </div>

              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PrivacyConsentBanner;