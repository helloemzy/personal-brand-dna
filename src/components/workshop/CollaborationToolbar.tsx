import React, { useState } from 'react';
import { useRealTimeWorkshop } from './RealTimeWorkshopProvider';
import ActiveUsersDisplay from '../realtime/ActiveUsersDisplay';
import ConnectionStatus from '../realtime/ConnectionStatus';
import { useWebSocket } from '../../hooks/useWebSocket';

interface CollaborationToolbarProps {
  className?: string;
  variant?: 'full' | 'compact';
  showInvite?: boolean;
}

const CollaborationToolbar: React.FC<CollaborationToolbarProps> = ({
  className = '',
  variant = 'full',
  showInvite = true
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  
  const { 
    isCollaborative, 
    collaborators, 
    shareSession, 
    inviteCollaborator 
  } = useRealTimeWorkshop();
  const { isConnected } = useWebSocket({ autoConnect: false });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      await inviteCollaborator(inviteEmail);
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (error) {
      console.error('Failed to send invitation:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleShare = () => {
    shareSession();
  };

  if (!isCollaborative && variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <ConnectionStatus variant="compact" />
        {isConnected && (
          <button
            onClick={handleShare}
            className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Enable Collaboration
          </button>
        )}
      </div>
    );
  }

  if (!isCollaborative) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ConnectionStatus variant="full" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Working solo
            </span>
          </div>
          {isConnected && (
            <button
              onClick={handleShare}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Start Collaborating
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        <ConnectionStatus variant="compact" />
        <ActiveUsersDisplay variant="avatars" maxDisplay={3} />
        {showInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Invite
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Collaboration
          </h3>
          <ConnectionStatus variant="full" />
        </div>

        <div className="space-y-4">
          {/* Active Users */}
          <div>
            <ActiveUsersDisplay variant="full" maxDisplay={5} showStatus={true} />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={handleShare}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Share Link
            </button>

            {showInvite && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Invite
              </button>
            )}
          </div>

          {/* Collaboration Info */}
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-md p-2">
            <p className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Changes sync in real-time across all collaborators
            </p>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Invite Collaborator
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="inviteEmail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleInvite();
                    }
                  }}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || isInviting}
                  className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CollaborationToolbar;