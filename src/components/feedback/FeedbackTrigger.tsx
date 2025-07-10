import React, { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';
import { feedbackService } from '../../services/feedbackService';
import { FeedbackModal } from './FeedbackModal';

interface FeedbackTriggerProps {
  triggerType: 'floating' | 'inline' | 'banner';
  feedbackType?: 'nps' | 'satisfaction' | 'feature' | 'bug' | 'general';
  context?: Record<string, any>;
  promptAfterEvent?: string; // e.g., 'workshop_complete', 'content_generated'
  delayMs?: number;
  className?: string;
}

export const FeedbackTrigger: React.FC<FeedbackTriggerProps> = ({
  triggerType,
  feedbackType = 'general',
  context,
  promptAfterEvent,
  delayMs = 0,
  className = ''
}) => {
  const { user } = useSelector(selectAuth);
  const [showModal, setShowModal] = useState(false);
  const [showTrigger, setShowTrigger] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [promptData, setPromptData] = useState<{ title?: string; questions?: string[] }>({});

  useEffect(() => {
    if (!user?.id || dismissed) return;

    const checkAndShowTrigger = async () => {
      // Check if we should show the feedback prompt
      const shouldShow = await feedbackService.shouldPromptForFeedback(user.id, feedbackType);
      
      if (shouldShow) {
        if (promptAfterEvent) {
          const prompts = feedbackService.getFeedbackPrompts(promptAfterEvent);
          setPromptData(prompts);
        }
        
        // Show after delay
        const timer = setTimeout(() => {
          setShowTrigger(true);
        }, delayMs);

        return () => clearTimeout(timer);
      }
    };

    checkAndShowTrigger();
  }, [user?.id, feedbackType, promptAfterEvent, delayMs, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowTrigger(false);
    
    // Remember dismissal for this session
    sessionStorage.setItem(`feedback_dismissed_${feedbackType}`, 'true');
  };

  const handleOpenModal = () => {
    setShowModal(true);
    if (triggerType === 'banner') {
      setShowTrigger(false);
    }
  };

  if (!showTrigger || !user) return null;

  // Floating Action Button
  if (triggerType === 'floating') {
    return (
      <>
        <button
          onClick={handleOpenModal}
          className={`fixed bottom-6 right-6 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-all hover:scale-110 z-40 ${className}`}
          aria-label="Give feedback"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
        
        <FeedbackModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          type={feedbackType}
          context={context}
          promptTitle={promptData.title}
          promptQuestions={promptData.questions}
        />
      </>
    );
  }

  // Inline Trigger
  if (triggerType === 'inline') {
    return (
      <>
        <button
          onClick={handleOpenModal}
          className={`inline-flex items-center gap-2 px-4 py-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors ${className}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Give Feedback</span>
        </button>
        
        <FeedbackModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          type={feedbackType}
          context={context}
          promptTitle={promptData.title}
          promptQuestions={promptData.questions}
        />
      </>
    );
  }

  // Banner Trigger
  if (triggerType === 'banner') {
    return (
      <>
        <div className={`bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center justify-between ${className}`}>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-primary-600" />
            <div>
              <p className="font-medium text-gray-900">
                {promptData.title || 'How are we doing?'}
              </p>
              <p className="text-sm text-gray-600">
                Your feedback helps us improve
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
              Give Feedback
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <FeedbackModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          type={feedbackType}
          context={context}
          promptTitle={promptData.title}
          promptQuestions={promptData.questions}
        />
      </>
    );
  }

  return null;
};