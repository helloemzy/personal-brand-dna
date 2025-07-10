import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiClock, FiTrash2, FiPlay, FiDownload, FiUpload, FiRefreshCw } from 'react-icons/fi';
import { Layout } from '../components/Layout';
import { workshopAPI } from '../services/workshopAPI';
import { workshopPersistence } from '../services/workshopPersistenceService';
import type { WorkshopState } from '../store/slices/workshopSlice';

interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  completed: boolean;
  step: number;
  data: any;
}

export const WorkshopSessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await workshopAPI.getSessions();
      const allSessions = response.data.sessions || [];
      
      // Sort by most recent first
      allSessions.sort((a: SessionData, b: SessionData) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setError('Failed to load your workshop sessions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStepName = (step: number): string => {
    const stepNames = ['Values', 'Tone', 'Audience', 'Writing', 'Personality'];
    return stepNames[step - 1] || 'Unknown';
  };

  const calculateProgress = (session: SessionData): number => {
    if (session.completed) return 100;
    
    const totalSteps = 5;
    const completedSteps = session.data?.completedSteps?.length || 0;
    return Math.round((completedSteps / totalSteps) * 100);
  };

  const handleResume = async (sessionId: string) => {
    try {
      // Load the session data
      const response = await workshopAPI.getSession(sessionId);
      const session = response.data.session;
      
      // Convert to WorkshopState format and save to persistence
      const workshopState = convertSessionToWorkshopState(session);
      await workshopPersistence.save(workshopState);
      
      // Navigate to the workshop at the current step
      navigate(`/workshop/step/${session.step || 1}`);
    } catch (error) {
      console.error('Failed to resume session:', error);
      setError('Failed to resume session. Please try again.');
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this workshop session?')) {
      return;
    }

    try {
      setDeletingId(sessionId);
      
      // Delete session via API
      await workshopAPI.deleteSession(sessionId);
      
      // Remove from local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // Clear local storage if this is the current session
      const currentSession = await workshopPersistence.load();
      if (currentSession?.sessionId === sessionId) {
        await workshopPersistence.clear();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      setError('Failed to delete session. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async (session: SessionData) => {
    try {
      // Convert session data to JSON
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        session: session
      };
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workshop-session-${session.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export session:', error);
      setError('Failed to export session. Please try again.');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data
      if (!importData.session || !importData.version) {
        throw new Error('Invalid import file format');
      }
      
      // Import the session via API
      const response = await workshopAPI.importSession(importData.session);
      
      // Reload sessions
      await loadSessions();
      
      alert('Session imported successfully!');
    } catch (error) {
      console.error('Failed to import session:', error);
      setError('Failed to import session. Please check the file format.');
    }
    
    // Reset input
    event.target.value = '';
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

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <FiRefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading your workshop sessions...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Workshop Sessions</h1>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
                <FiUpload className="w-4 h-4" />
                <span>Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => navigate('/workshop')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiPlay className="w-4 h-4" />
                <span>New Workshop</span>
              </button>
            </div>
          </div>
          
          <p className="text-gray-600">
            Manage your Brand Voice Discovery workshop sessions. Resume incomplete workshops or export your data.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-gray-400 mb-4">
                <FiClock className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No workshop sessions yet</h3>
              <p className="text-gray-600 mb-6">
                Start your first Brand Voice Discovery workshop to uncover your unique professional voice.
              </p>
              <button
                onClick={() => navigate('/workshop')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiPlay className="w-5 h-5" />
                <span>Start Workshop</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => {
              const progress = calculateProgress(session);
              const isDeleting = deletingId === session.id;
              
              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${
                    isDeleting ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Session Info */}
                      <div className="mb-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                          {session.completed ? 'Completed Workshop' : `In Progress - Step ${session.step}: ${getStepName(session.step)}`}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Started: {formatDate(session.createdAt)}</span>
                          <span>•</span>
                          <span>Last saved: {formatDate(session.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              session.completed ? 'bg-green-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-6">
                      {!session.completed && (
                        <button
                          onClick={() => handleResume(session.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Resume workshop"
                        >
                          <FiPlay className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleExport(session)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Export session"
                      >
                        <FiDownload className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(session.id)}
                        disabled={isDeleting}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete session"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};