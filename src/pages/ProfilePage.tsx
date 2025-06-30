import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from '../components/Toast';
import { voiceAPI } from '../services/voiceAPI';

// Profile form interfaces
interface ProfileFormData {
  firstName: string;
  lastName: string;
  industry: string;
  role: string;
  company: string;
  linkedinUrl: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  industry: string;
  role: string;
  company: string;
  linkedinUrl: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserStats {
  voiceProfiles: number;
  totalContent: number;
  contentThisMonth: number;
  contentUsed: number;
}

const ProfilePage: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors, isDirty: profileIsDirty },
    reset: resetProfile
  } = useForm<ProfileFormData>();

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch: watchPassword
  } = useForm<PasswordFormData>();

  const newPassword = watchPassword('newPassword');

  // Load user profile on component mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setIsLoading(true);
    try {
      // Mock API call - replace with actual API call when available
      // const response = await userAPI.getProfile();
      // setUserProfile(response.data.user);
      // setUserStats(response.data.stats);
      
      // For demo purposes, using mock data
      const mockProfile: UserProfile = {
        id: '1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        industry: 'Technology',
        role: 'Software Engineer',
        company: 'Tech Corp',
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        isVerified: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      const mockStats: UserStats = {
        voiceProfiles: 1,
        totalContent: 25,
        contentThisMonth: 8,
        contentUsed: 15
      };

      setUserProfile(mockProfile);
      setUserStats(mockStats);

      // Reset form with current data
      resetProfile({
        firstName: mockProfile.firstName,
        lastName: mockProfile.lastName,
        industry: mockProfile.industry,
        role: mockProfile.role,
        company: mockProfile.company,
        linkedinUrl: mockProfile.linkedinUrl
      });

    } catch (error) {
      console.error('Failed to load user profile:', error);
      toast.error('Loading Failed', 'Failed to load your profile information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileUpdate = async (data: ProfileFormData) => {
    setIsUpdating(true);
    try {
      // Mock API call - replace with actual API call
      // await userAPI.updateProfile(data);
      
      // Update local state
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          firstName: data.firstName,
          lastName: data.lastName,
          industry: data.industry,
          role: data.role,
          company: data.company,
          linkedinUrl: data.linkedinUrl,
          updatedAt: new Date().toISOString()
        });
      }

      toast.success('Profile Updated', 'Your profile has been updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Update Failed', 'Failed to update your profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (data: PasswordFormData) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Password Mismatch', 'New password and confirmation do not match');
      return;
    }

    setIsUpdating(true);
    try {
      // Mock API call - replace with actual API call
      // await userAPI.changePassword(data.currentPassword, data.newPassword);
      
      toast.success('Password Changed', 'Your password has been updated successfully');
      resetPassword();
    } catch (error) {
      console.error('Failed to change password:', error);
      toast.error('Password Change Failed', 'Failed to update your password');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteVoiceProfile = async () => {
    if (!window.confirm('Are you sure you want to delete your voice profile? This action cannot be undone.')) {
      return;
    }

    try {
      // Get voice profiles and delete them
      const voiceProfiles = await voiceAPI.getVoiceProfiles();
      for (const profile of voiceProfiles.data.profiles) {
        await voiceAPI.deleteVoiceProfile(profile.id);
      }

      // Update stats
      if (userStats) {
        setUserStats({
          ...userStats,
          voiceProfiles: 0
        });
      }

      toast.success('Voice Profile Deleted', 'Your voice profile has been deleted successfully');
    } catch (error) {
      console.error('Failed to delete voice profile:', error);
      toast.error('Deletion Failed', 'Failed to delete your voice profile');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmText = 'DELETE MY ACCOUNT';
    const userInput = window.prompt(
      `This action is permanent and cannot be undone. All your data will be lost.\\n\\nType "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      return;
    }

    try {
      // Mock API call - replace with actual API call
      // await userAPI.deleteAccount();
      
      toast.success('Account Scheduled for Deletion', 'Your account will be deleted within 24 hours');
      // Redirect to logout or login page
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error('Deletion Failed', 'Failed to delete your account');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSubscriptionBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'executive':
        return 'bg-purple-100 text-purple-800';
      case 'enterprise':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Profile Not Found</h3>
          <p className="text-gray-600">We couldn't load your profile information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Profile Settings
        </h1>
        <p className="text-lg text-gray-600">
          Manage your account settings, professional information, and preferences.
        </p>
      </div>

      {/* Profile Summary Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold">
              {userProfile.firstName.charAt(0)}{userProfile.lastName.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {userProfile.firstName} {userProfile.lastName}
              </h2>
              <p className="text-gray-600">{userProfile.role} at {userProfile.company}</p>
              <p className="text-sm text-gray-500">{userProfile.email}</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSubscriptionBadgeColor(userProfile.subscriptionTier)}`}>
              {userProfile.subscriptionTier.charAt(0).toUpperCase() + userProfile.subscriptionTier.slice(1)}
            </span>
            <p className="text-sm text-gray-500 mt-2">
              Member since {formatDate(userProfile.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{userStats.voiceProfiles}</div>
            <div className="text-sm text-gray-600">Voice Profiles</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">{userStats.totalContent}</div>
            <div className="text-sm text-gray-600">Total Content</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-purple-600">{userStats.contentThisMonth}</div>
            <div className="text-sm text-gray-600">This Month</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-orange-600">{userStats.contentUsed}</div>
            <div className="text-sm text-gray-600">Content Used</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'profile', name: 'Profile Information', icon: '👤' },
              { id: 'security', name: 'Security', icon: '🔒' },
              { id: 'preferences', name: 'Preferences', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Profile Information Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSubmitProfile(handleProfileUpdate)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    {...registerProfile('firstName', { required: 'First name is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isUpdating}
                  />
                  {profileErrors.firstName && (
                    <p className="text-red-600 text-sm mt-1">{profileErrors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    {...registerProfile('lastName', { required: 'Last name is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isUpdating}
                  />
                  {profileErrors.lastName && (
                    <p className="text-red-600 text-sm mt-1">{profileErrors.lastName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industry
                  </label>
                  <select
                    {...registerProfile('industry')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isUpdating}
                  >
                    <option value="">Select Industry</option>
                    <option value="technology">Technology</option>
                    <option value="finance">Finance</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="education">Education</option>
                    <option value="marketing">Marketing</option>
                    <option value="consulting">Consulting</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="retail">Retail</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role/Title
                  </label>
                  <input
                    type="text"
                    {...registerProfile('role')}
                    placeholder="e.g., Software Engineer, Marketing Manager"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isUpdating}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    {...registerProfile('company')}
                    placeholder="e.g., Acme Corp"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isUpdating}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="url"
                    {...registerProfile('linkedinUrl')}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isUpdating}
                  />
                </div>
              </div>

              {profileIsDirty && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <div className="text-blue-600">ℹ️</div>
                    <p className="text-sm text-blue-800">You have unsaved changes</p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        resetProfile({
                          firstName: userProfile.firstName,
                          lastName: userProfile.lastName,
                          industry: userProfile.industry,
                          role: userProfile.role,
                          company: userProfile.company,
                          linkedinUrl: userProfile.linkedinUrl
                        });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Discard Changes
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Password */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                <form onSubmit={handleSubmitPassword(handlePasswordChange)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      {...registerPassword('currentPassword', { required: 'Current password is required' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isUpdating}
                    />
                    {passwordErrors.currentPassword && (
                      <p className="text-red-600 text-sm mt-1">{passwordErrors.currentPassword.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      {...registerPassword('newPassword', {
                        required: 'New password is required',
                        minLength: { value: 8, message: 'Password must be at least 8 characters' },
                        pattern: {
                          value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]/,
                          message: 'Password must contain uppercase, lowercase, number, and special character'
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isUpdating}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-red-600 text-sm mt-1">{passwordErrors.newPassword.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      {...registerPassword('confirmPassword', {
                        required: 'Please confirm your new password',
                        validate: value => value === newPassword || 'Passwords do not match'
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isUpdating}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-red-600 text-sm mt-1">{passwordErrors.confirmPassword.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isUpdating ? 'Changing Password...' : 'Change Password'}
                  </button>
                </form>
              </div>

              {/* Account Status */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Email Verification</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      userProfile.isVerified 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {userProfile.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Subscription Status</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      userProfile.subscriptionStatus === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {userProfile.subscriptionStatus.charAt(0).toUpperCase() + userProfile.subscriptionStatus.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Voice Profile Management */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Voice Profile</h3>
                {userStats && userStats.voiceProfiles > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-green-600">✅</div>
                      <div>
                        <h4 className="text-sm font-medium text-green-900">
                          Voice profile completed
                        </h4>
                        <p className="text-sm text-green-700">
                          You have {userStats.voiceProfiles} voice profile{userStats.voiceProfiles !== 1 ? 's' : ''} configured.
                        </p>
                      </div>
                      <div className="ml-auto">
                        <button
                          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                          onClick={() => window.location.href = '/voice-discovery'}
                        >
                          Update Profile
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-yellow-600">⚠️</div>
                      <div>
                        <h4 className="text-sm font-medium text-yellow-900">
                          Voice profile not completed
                        </h4>
                        <p className="text-sm text-yellow-700">
                          Complete your voice discovery to unlock personalized content generation.
                        </p>
                      </div>
                      <div className="ml-auto">
                        <button
                          className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors"
                          onClick={() => window.location.href = '/voice-discovery'}
                        >
                          Complete Now
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {userStats && userStats.voiceProfiles > 0 && (
                  <button
                    onClick={handleDeleteVoiceProfile}
                    className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Delete Voice Profile
                  </button>
                )}
              </div>

              {/* Data & Privacy */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Data & Privacy</h3>
                <div className="space-y-4 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Data retention period</span>
                    <span className="font-medium">30 days after deletion</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Voice data storage</span>
                    <span className="font-medium">Encrypted at rest</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Content ownership</span>
                    <span className="font-medium">You own all generated content</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow border-l-4 border-red-400">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
          <p className="text-sm text-gray-600 mb-6">
            These actions are permanent and cannot be undone. Please proceed with caution.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleDeleteAccount}
              className="bg-red-600 text-white px-6 py-3 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Delete Account Permanently
            </button>
            <p className="text-xs text-gray-500">
              This will delete all your data including voice profiles, generated content, and account information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;