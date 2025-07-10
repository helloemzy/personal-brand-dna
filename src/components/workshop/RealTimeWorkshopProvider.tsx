import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import { RootState } from '../../store';
import {
  updateTonePreferences,
  addAudiencePersona,
  updateAudiencePersona,
  removeAudiencePersona,
  setWritingSample,
  submitQuizAnswer,
  selectValue,
  deselectValue,
  rankValue,
  addCustomValue,
  nextStep,
  previousStep,
  setCurrentStep,
  saveProgress
} from '../../store/slices/workshopSlice';
import { addNotification } from '../../store/slices/realtimeSlice';

interface RealTimeWorkshopContextType {
  isCollaborative: boolean;
  collaborators: any[];
  shareSession: () => void;
  leaveSession: () => void;
  inviteCollaborator: (email: string) => void;
}

const RealTimeWorkshopContext = createContext<RealTimeWorkshopContextType | null>(null);

interface RealTimeWorkshopProviderProps {
  children: React.ReactNode;
  workshopSessionId?: string;
  enableCollaboration?: boolean;
}

const RealTimeWorkshopProvider: React.FC<RealTimeWorkshopProviderProps> = ({
  children,
  workshopSessionId,
  enableCollaboration = false
}) => {
  const dispatch = useDispatch();
  const workshopState = useSelector((state: RootState) => state.workshop);
  const user = useSelector((state: RootState) => state.auth.user);
  const lastUpdateRef = useRef<number>(0);
  const collaboratorsRef = useRef<any[]>([]);

  const { 
    isConnected, 
    emit, 
    on, 
    off,
    joinRoom,
    leaveRoom,
    sendCollaborationEvent,
    updatePresence
  } = useWebSocket({
    autoConnect: enableCollaboration,
    room: workshopSessionId ? `workshop:${workshopSessionId}` : undefined
  });

  // Handle incoming workshop updates
  useEffect(() => {
    if (!enableCollaboration || !isConnected) return;

    const handleWorkshopUpdate = (event: any) => {
      // Prevent processing our own updates
      if (event.userId === user?.id) return;

      // Prevent infinite loops by checking timestamp
      if (event.timestamp <= lastUpdateRef.current) return;

      console.log('Received workshop update:', event);

      try {
        switch (event.action) {
          case 'value_selected':
            dispatch(selectValue(event.data.value));
            break;
          case 'value_deselected':
            dispatch(deselectValue(event.data.value));
            break;
          case 'value_ranked':
            dispatch(rankValue(event.data));
            break;
          case 'custom_value_added':
            dispatch(addCustomValue(event.data));
            break;
          case 'tone_updated':
            dispatch(updateTonePreferences(event.data));
            break;
          case 'persona_added':
            dispatch(addAudiencePersona(event.data));
            break;
          case 'persona_updated':
            dispatch(updateAudiencePersona(event.data));
            break;
          case 'persona_removed':
            dispatch(removeAudiencePersona(event.data.id));
            break;
          case 'writing_sample_updated':
            dispatch(setWritingSample(event.data));
            break;
          case 'quiz_answer_submitted':
            dispatch(submitQuizAnswer(event.data));
            break;
          case 'step_changed':
            dispatch(setCurrentStep(event.data.step));
            break;
          case 'progress_saved':
            // Just acknowledge, don't override local state
            break;
          default:
            console.warn('Unknown workshop action:', event.action);
        }

        // Show notification about the update
        dispatch(addNotification({
          type: 'collaboration',
          title: 'Workshop Updated',
          message: `${event.userName || 'A collaborator'} made changes to the workshop`,
          userId: event.userId,
          userName: event.userName
        }));
      } catch (error) {
        console.error('Error processing workshop update:', error);
      }
    };

    const handleCollaboratorJoined = (data: any) => {
      collaboratorsRef.current = [...collaboratorsRef.current, data];
      dispatch(addNotification({
        type: 'info',
        title: 'Collaborator Joined',
        message: `${data.userName} joined the workshop session`,
        userId: data.userId,
        userName: data.userName
      }));
    };

    const handleCollaboratorLeft = (data: any) => {
      collaboratorsRef.current = collaboratorsRef.current.filter(c => c.userId !== data.userId);
      dispatch(addNotification({
        type: 'info',
        title: 'Collaborator Left',
        message: `${data.userName} left the workshop session`,
        userId: data.userId,
        userName: data.userName
      }));
    };

    // Subscribe to events
    on('workshop:update', handleWorkshopUpdate);
    on('collaborator:joined', handleCollaboratorJoined);
    on('collaborator:left', handleCollaboratorLeft);

    return () => {
      off('workshop:update', handleWorkshopUpdate);
      off('collaborator:joined', handleCollaboratorJoined);
      off('collaborator:left', handleCollaboratorLeft);
    };
  }, [enableCollaboration, isConnected, user?.id, dispatch, on, off]);

  // Broadcast workshop changes to collaborators
  useEffect(() => {
    if (!enableCollaboration || !isConnected || !workshopSessionId) return;

    // Update timestamp
    lastUpdateRef.current = Date.now();

    // Update presence with current workshop step
    updatePresence({
      workshopStep: workshopState.currentStep,
      currentPage: `/workshop/session/${workshopSessionId}`
    });

    // Don't broadcast if it's a fresh session
    if (!workshopState.sessionId) return;

    // Debounce updates to prevent spam
    const debounceTimer = setTimeout(() => {
      sendCollaborationEvent({
        type: 'workshop_update',
        data: {
          action: 'state_sync',
          workshopState: {
            currentStep: workshopState.currentStep,
            completedSteps: workshopState.completedSteps,
            values: workshopState.values,
            tonePreferences: workshopState.tonePreferences,
            audiencePersonas: workshopState.audiencePersonas,
            writingSample: workshopState.writingSample,
            personalityQuiz: workshopState.personalityQuiz
          }
        }
      });
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [
    enableCollaboration,
    isConnected,
    workshopSessionId,
    workshopState.currentStep,
    workshopState.completedSteps,
    workshopState.values,
    workshopState.tonePreferences,
    workshopState.audiencePersonas,
    workshopState.writingSample,
    workshopState.personalityQuiz,
    sendCollaborationEvent,
    updatePresence
  ]);

  // Broadcast specific actions
  const broadcastAction = (action: string, data: any) => {
    if (!enableCollaboration || !isConnected) return;

    sendCollaborationEvent({
      type: 'workshop_update',
      data: { action, data }
    });
  };

  // Share session functionality
  const shareSession = () => {
    if (!workshopSessionId) return;

    const shareUrl = `${window.location.origin}/workshop/session/${workshopSessionId}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join my Brand Workshop',
        text: 'Collaborate with me on building my personal brand!',
        url: shareUrl
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      dispatch(addNotification({
        type: 'success',
        title: 'Link Copied',
        message: 'Workshop collaboration link copied to clipboard'
      }));
    }
  };

  // Leave session
  const leaveSession = () => {
    if (workshopSessionId) {
      leaveRoom(`workshop:${workshopSessionId}`);
      emit('leave_workshop', { sessionId: workshopSessionId });
    }
  };

  // Invite collaborator
  const inviteCollaborator = (email: string) => {
    if (!workshopSessionId) return;

    emit('invite_collaborator', {
      sessionId: workshopSessionId,
      email,
      inviterName: user?.name || user?.email
    });

    dispatch(addNotification({
      type: 'success',
      title: 'Invitation Sent',
      message: `Workshop invitation sent to ${email}`
    }));
  };

  // Enhanced action dispatchers that also broadcast
  const enhancedActions = {
    selectValue: (value: string) => {
      dispatch(selectValue(value));
      broadcastAction('value_selected', { value });
    },
    deselectValue: (value: string) => {
      dispatch(deselectValue(value));
      broadcastAction('value_deselected', { value });
    },
    rankValue: (data: any) => {
      dispatch(rankValue(data));
      broadcastAction('value_ranked', data);
    },
    addCustomValue: (value: any) => {
      dispatch(addCustomValue(value));
      broadcastAction('custom_value_added', value);
    },
    updateTonePreferences: (preferences: any) => {
      dispatch(updateTonePreferences(preferences));
      broadcastAction('tone_updated', preferences);
    },
    addAudiencePersona: (persona: any) => {
      dispatch(addAudiencePersona(persona));
      broadcastAction('persona_added', persona);
    },
    updateAudiencePersona: (persona: any) => {
      dispatch(updateAudiencePersona(persona));
      broadcastAction('persona_updated', persona);
    },
    removeAudiencePersona: (id: string) => {
      dispatch(removeAudiencePersona(id));
      broadcastAction('persona_removed', { id });
    },
    setWritingSample: (sample: any) => {
      dispatch(setWritingSample(sample));
      broadcastAction('writing_sample_updated', sample);
    },
    submitQuizAnswer: (answer: any) => {
      dispatch(submitQuizAnswer(answer));
      broadcastAction('quiz_answer_submitted', answer);
    },
    nextStep: () => {
      dispatch(nextStep());
      broadcastAction('step_changed', { step: workshopState.currentStep + 1 });
    },
    previousStep: () => {
      dispatch(previousStep());
      broadcastAction('step_changed', { step: workshopState.currentStep - 1 });
    },
    setCurrentStep: (step: number) => {
      dispatch(setCurrentStep(step));
      broadcastAction('step_changed', { step });
    },
    saveProgress: () => {
      dispatch(saveProgress());
      broadcastAction('progress_saved', { timestamp: Date.now() });
    }
  };

  const contextValue: RealTimeWorkshopContextType = {
    isCollaborative: enableCollaboration && isConnected,
    collaborators: collaboratorsRef.current,
    shareSession,
    leaveSession,
    inviteCollaborator
  };

  return (
    <RealTimeWorkshopContext.Provider value={contextValue}>
      {children}
    </RealTimeWorkshopContext.Provider>
  );
};

export const useRealTimeWorkshop = () => {
  const context = useContext(RealTimeWorkshopContext);
  if (!context) {
    throw new Error('useRealTimeWorkshop must be used within a RealTimeWorkshopProvider');
  }
  return context;
};

export default RealTimeWorkshopProvider;