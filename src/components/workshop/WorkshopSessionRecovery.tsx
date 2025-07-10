import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FiClock, FiRefreshCw, FiTrash2, FiPlay, FiAlertCircle } from 'react-icons/fi';
import { workshopPersistence } from '../../services/workshopPersistenceService';
import { workshopAPI } from '../../services/workshopAPI';
import { loadWorkshopState } from '../../store/slices/workshopSlice';
import type { WorkshopState } from '../../store/slices/workshopSlice';

interface SavedSession {
  id: string;
  lastSavedAt: string;
  currentStep: number;
  completedSteps: number[];
  progress: number;
  data: WorkshopState;
  source: 'local' | 'remote';
}

interface WorkshopSessionRecoveryProps {
  onRecover?: (session: SavedSession) => void;
  onStartNew?: () => void;
  autoShow?: boolean;
}

export const WorkshopSessionRecovery: React.FC<WorkshopSessionRecoveryProps> = ({
  onRecover,
  onStartNew,
  autoShow = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Load saved sessions on mount
  useEffect(() => {
    loadSavedSessions();
  }, []);

  // Auto-show modal if there are saved sessions
  useEffect(() => {
    if (autoShow && sessions.length > 0 && !isLoading) {
      setIsOpen(true);
    }
  }, [autoShow, sessions, isLoading]);

  const loadSavedSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const foundSessions: SavedSession[] = [];

      // Load from localStorage
      const localData = await workshopPersistence.load();
      if (localData && localData.sessionId) {
        foundSessions.push({
          id: localData.sessionId,
          lastSavedAt: localData.lastSavedAt || new Date().toISOString(),
          currentStep: localData.currentStep,
          completedSteps: localData.completedSteps || [],
          progress: calculateProgress(localData),
          data: localData,
          source: 'local',
        });
      }

      // Load from database (remote sessions)
      try {
        const response = await workshopAPI.getSessions();
        const remoteSessions = response.data.sessions || [];
        
        // Filter incomplete sessions
        const incompleteSessions = remoteSessions.filter((s: any) => !s.completed);
        
        for (const session of incompleteSessions) {
          // Skip if we already have this session from local storage
          if (foundSessions.some(s => s.id === session.id)) {
            continue;
          }

          // Load full session data
          const sessionResponse = await workshopAPI.getSession(session.id);
          const fullSession = sessionResponse.data.session;
          
          foundSessions.push({
            id: session.id,
            lastSavedAt: session.updatedAt,
            currentStep: session.step || 1,
            completedSteps: fullSession.data?.completedSteps || [],
            progress: calculateProgressFromSession(fullSession),
            data: convertSessionToWorkshopState(fullSession),
            source: 'remote',
          });
        }
      } catch (error) {
        console.error('Failed to load remote sessions:', error);
      }

      // Sort by last saved time (most recent first)
      foundSessions.sort((a, b) => 
        new Date(b.lastSavedAt).getTime() - new Date(a.lastSavedAt).getTime()
      );

      setSessions(foundSessions);
    } catch (error) {
      console.error('Failed to load saved sessions:', error);
      setError('Failed to load saved sessions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProgress = (state: WorkshopState): number => {
    const totalSteps = 5;
    const completedSteps = state.completedSteps?.length || 0;
    return Math.round((completedSteps / totalSteps) * 100);
  };

  const calculateProgressFromSession = (session: any): number => {
    const totalSteps = 5;
    const completedSteps = session.data?.completedSteps?.length || 0;
    return Math.round((completedSteps / totalSteps) * 100);
  };

  const convertSessionToWorkshopState = (session: any): WorkshopState => {
    const stepData = session.data || {};
    
    return {
      // Navigation
      currentStep: session.step as 1 | 2 | 3 | 4 | 5,
      completedSteps: stepData.completedSteps || [],
      isCompleted: session.completed || false,
      
      // Assessment
      assessmentScore: stepData.assessmentScore || null,
      workshopPath: stepData.workshopPath || null,
      
      // Timing
      startedAt: session.createdAt,
      lastSavedAt: session.updatedAt,
      completedAt: session.completed ? session.updatedAt : null,
      
      // Step data
      values: stepData.values || {
        selected: [],
        custom: [],
        rankings: {},
        primary: [],
        aspirational: [],
        stories: {}
      },
      tonePreferences: stepData.toneSettings || {
        formal_casual: 0,
        concise_detailed: 0,
        analytical_creative: 0,
        serious_playful: 0
      },
      audiencePersonas: stepData.audiences || [],
      writingSample: stepData.writingSample ? {
        text: stepData.writingSample,
        wordCount: stepData.writingSample.split(/\s+/).length,
        uploadedAt: session.updatedAt,
      } : null,
      personalityQuiz: {
        responses: stepData.quizResponses || [],
        currentQuestionIndex: stepData.quizResponses?.length || 0,
      },
      
      // Meta
      sessionId: session.id,
      isSaving: false,
      lastError: null,
    };
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getStepName = (step: number): string => {
    const stepNames = ['Values', 'Tone', 'Audience', 'Writing', 'Personality'];
    return stepNames[step - 1] || 'Unknown';
  };

  const handleRecover = async (session: SavedSession) => {
    try {
      setIsRecovering(true);
      setError(null);

      // Dispatch to Redux store
      dispatch(loadWorkshopState(session.data));

      // Save to persistence service to sync all layers
      await workshopPersistence.save(session.data);

      // Call callback if provided
      if (onRecover) {
        onRecover(session);
      }

      // Navigate to the current step
      navigate(`/workshop/step/${session.currentStep}`);
      
      // Close modal
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to recover session:', error);
      setError('Failed to recover session. Please try again.');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    try {
      // Remove from sessions list
      setSessions(prev => prev.filter(s => s.id !== sessionId));

      // If this was the selected session, clear selection
      if (selectedSession === sessionId) {
        setSelectedSession(null);
      }

      // If it's a local session, clear localStorage
      const session = sessions.find(s => s.id === sessionId);
      if (session?.source === 'local') {
        await workshopPersistence.clear();
      }

      // Delete remote session if it's not a local session
      if (session?.source === 'remote') {
        await workshopAPI.deleteSession(sessionId);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      setError('Failed to delete session. Please try again.');
    }
  };

  const handleStartNew = () => {
    if (onStartNew) {
      onStartNew();
    }
    setIsOpen(false);
    navigate('/workshop');
  };

  if (isLoading) {
    return null;
  }

  if (sessions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Recovery button for manual access */}
      {!isOpen && sessions.length > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-50"
        >
          <FiRefreshCw className="w-4 h-4" />
          Recover Session
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Resume Your Workshop</h2>
              <p className="mt-2 text-gray-600">
                We found {sessions.length} saved workshop{sessions.length > 1 ? 's' : ''}. 
                Would you like to continue where you left off?
              </p>
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>

            {/* Sessions list */}
            <div className="p-6 max-h-[400px] overflow-y-auto">
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedSession === session.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FiClock className="w-4 h-4" />
                            <span>Saved {formatRelativeTime(session.lastSavedAt)}</span>
                          </div>
                          {session.source === 'remote' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              Cloud Backup
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <p className="font-medium text-gray-900">
                            Step {session.currentStep}: {getStepName(session.currentStep)}
                          </p>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                              <span>Progress</span>
                              <span>{session.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${session.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.id);
                        }}
                        className="ml-4 p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
              <button
                onClick={handleStartNew}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                Start New Workshop
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedSession && handleRecover(sessions.find(s => s.id === selectedSession)!)}
                  disabled={!selectedSession || isRecovering}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isRecovering ? (
                    <>
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      <span>Recovering...</span>
                    </>
                  ) : (
                    <>
                      <FiPlay className="w-4 h-4" />
                      <span>Resume Workshop</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};