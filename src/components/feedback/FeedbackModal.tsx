import React, { useState } from 'react';
import { X, Star, Send, MessageSquare, AlertCircle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';
import { feedbackService, FeedbackData } from '../../services/feedbackService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: FeedbackData['type'];
  context?: FeedbackData['context'];
  promptTitle?: string;
  promptQuestions?: string[];
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  type = 'general',
  context,
  promptTitle,
  promptQuestions
}) => {
  const { user } = useSelector(selectAuth);
  const [feedbackType, setFeedbackType] = useState<FeedbackData['type']>(type);
  const [rating, setRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!user?.id) {
      setErrorMessage('You must be logged in to submit feedback');
      setSubmitStatus('error');
      return;
    }

    if (!feedbackText.trim()) {
      setErrorMessage('Please provide some feedback');
      setSubmitStatus('error');
      return;
    }

    if ((feedbackType === 'nps' || feedbackType === 'satisfaction') && rating === 0) {
      setErrorMessage('Please select a rating');
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    const feedback: FeedbackData = {
      userId: user.id,
      type: feedbackType,
      rating: feedbackType === 'nps' || feedbackType === 'satisfaction' ? rating : undefined,
      feedback: feedbackText,
      context: {
        ...context,
        page: window.location.pathname
      }
    };

    const result = await feedbackService.submitFeedback(feedback);

    if (result.success) {
      setSubmitStatus('success');
      setTimeout(() => {
        onClose();
        // Reset form
        setRating(0);
        setFeedbackText('');
        setSubmitStatus('idle');
      }, 2000);
    } else {
      setErrorMessage(result.error || 'Failed to submit feedback');
      setSubmitStatus('error');
    }

    setIsSubmitting(false);
  };

  const renderRatingSelector = () => {
    if (feedbackType === 'nps') {
      return (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">
            How likely are you to recommend BrandPillar AI to a friend or colleague?
          </p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Not likely</span>
            <div className="flex gap-1">
              {[...Array(11)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setRating(i)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    rating === i
                      ? i <= 6
                        ? 'bg-red-500 text-white'
                        : i <= 8
                        ? 'bg-yellow-500 text-white'
                        : 'bg-green-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500">Very likely</span>
          </div>
        </div>
      );
    }

    if (feedbackType === 'satisfaction') {
      return (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">
            How satisfied are you with your experience?
          </p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const getModalTitle = () => {
    if (promptTitle) return promptTitle;
    
    switch (feedbackType) {
      case 'nps':
        return 'How likely are you to recommend us?';
      case 'satisfaction':
        return 'How satisfied are you?';
      case 'feature':
        return 'Feature Request';
      case 'bug':
        return 'Report a Bug';
      default:
        return 'Share Your Feedback';
    }
  };

  const getPlaceholderText = () => {
    if (promptQuestions && promptQuestions.length > 0) {
      return promptQuestions.join('\n\n');
    }

    switch (feedbackType) {
      case 'feature':
        return 'Describe the feature you\'d like to see...';
      case 'bug':
        return 'Please describe the issue you encountered...';
      default:
        return 'Share your thoughts, suggestions, or concerns...';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary-600" />
            {getModalTitle()}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Feedback Type Selector */}
          {!type && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback Type
              </label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value as FeedbackData['type'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="general">General Feedback</option>
                <option value="satisfaction">Satisfaction Rating</option>
                <option value="nps">Recommendation Score</option>
                <option value="feature">Feature Request</option>
                <option value="bug">Bug Report</option>
              </select>
            </div>
          )}

          {/* Rating Selector */}
          {renderRatingSelector()}

          {/* Feedback Text */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Feedback
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={getPlaceholderText()}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {/* Error Message */}
          {submitStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {submitStatus === 'success' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                Thank you for your feedback! We appreciate your input.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || submitStatus === 'success'}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};