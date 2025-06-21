import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MessageCircle, CheckCircle, AlertCircle, Clock, User, Bot } from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';
import { 
  startVoiceDiscovery, 
  nextQuestion, 
  addResponse, 
  startVoiceAnalysis,
  updateAnalysisProgress,
  completeVoiceAnalysis,
  setVoiceAnalysisError,
  clearVoiceError,
  selectDiscoverySession,
  selectIsAnalyzing,
  selectAnalysisProgress,
  selectVoiceError,
  selectVoiceProfile
} from '../store/slices/voiceSlice';
import { voiceAPI, ConversationQuestion, createAudioBlob } from '../services/voiceAPI';
import { handleAPIError } from '../services/authAPI';

interface ConversationFlowProps {
  onComplete?: (voiceProfileId: string) => void;
  className?: string;
}

interface ConversationResponse {
  questionId: string;
  question: string;
  response: string;
  responseType: 'audio' | 'text';
  audioBlob?: Blob;
  timestamp: string;
}

const ConversationFlow: React.FC<ConversationFlowProps> = ({
  onComplete,
  className = ''
}) => {
  const dispatch = useDispatch();
  const discoverySession = useSelector(selectDiscoverySession);
  const isAnalyzing = useSelector(selectIsAnalyzing);
  const analysisProgress = useSelector(selectAnalysisProgress);
  const voiceError = useSelector(selectVoiceError);
  const voiceProfile = useSelector(selectVoiceProfile);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<ConversationQuestion | null>(null);
  const [responses, setResponses] = useState<ConversationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState('');
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState('');

  // Start conversation when component mounts
  useEffect(() => {
    if (!conversationId && !discoverySession.isActive) {
      startConversation();
    }
  }, []);

  // Start the conversation
  const startConversation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      dispatch(clearVoiceError());
      
      const response = await voiceAPI.startConversation();
      const { 
        conversationId: newConversationId, 
        currentQuestion: firstQuestion, 
        totalQuestions: total,
        estimatedTimeRemaining: timeRemaining
      } = response.data;
      
      setConversationId(newConversationId);
      setCurrentQuestion(firstQuestion);
      setTotalQuestions(total);
      setEstimatedTimeRemaining(timeRemaining);
      
      dispatch(startVoiceDiscovery());
      
    } catch (error) {
      const errorMessage = handleAPIError(error);
      setError(errorMessage);
      dispatch(setVoiceAnalysisError(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle audio response
  const handleAudioResponse = async (audioBlob: Blob, duration: number) => {
    if (!conversationId || !currentQuestion) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await voiceAPI.uploadAudioResponse(
        conversationId,
        audioBlob,
        currentQuestion.id
      );
      
      const { transcription, nextQuestion: next, conversationComplete: complete } = response.data;
      
      // Add response to conversation history
      const newResponse: ConversationResponse = {
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        response: transcription,
        responseType: 'audio',
        audioBlob,
        timestamp: new Date().toISOString()
      };
      
      setResponses(prev => [...prev, newResponse]);
      
      dispatch(addResponse({
        questionId: currentQuestion.id,
        response: transcription,
        audioUrl: URL.createObjectURL(audioBlob)
      }));
      
      if (complete || !next) {
        setConversationComplete(true);
        await completeConversationAnalysis();
      } else {
        setCurrentQuestion(next);
        dispatch(nextQuestion());
      }
      
    } catch (error) {
      const errorMessage = handleAPIError(error);
      setError(errorMessage);
      setShowTextFallback(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle text response fallback
  const handleTextResponse = async () => {
    if (!conversationId || !currentQuestion || !textResponse.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await voiceAPI.submitTextResponse(
        conversationId,
        currentQuestion.id,
        textResponse.trim(),
        false
      );
      
      const { nextQuestion: next, conversationComplete: complete } = response.data;
      
      // Add response to conversation history
      const newResponse: ConversationResponse = {
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        response: textResponse.trim(),
        responseType: 'text',
        timestamp: new Date().toISOString()
      };
      
      setResponses(prev => [...prev, newResponse]);
      
      dispatch(addResponse({
        questionId: currentQuestion.id,
        response: textResponse.trim()
      }));
      
      setTextResponse('');
      setShowTextFallback(false);
      
      if (complete || !next) {
        setConversationComplete(true);
        await completeConversationAnalysis();
      } else {
        setCurrentQuestion(next);
        dispatch(nextQuestion());
      }
      
    } catch (error) {
      const errorMessage = handleAPIError(error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Complete conversation and trigger analysis
  const completeConversationAnalysis = async () => {
    if (!conversationId) return;

    try {
      dispatch(startVoiceAnalysis());
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        dispatch(updateAnalysisProgress(Math.min(90, analysisProgress + Math.random() * 15 + 5)));
      }, 1000);
      
      const response = await voiceAPI.completeConversation(conversationId);
      const { voiceProfileId, voiceSignature, confidenceScore, metadata } = response.data;
      
      clearInterval(progressInterval);
      
      dispatch(completeVoiceAnalysis({
        id: voiceProfileId,
        userId: '', // Will be set by the backend
        dimensions: voiceSignature,
        accuracy: confidenceScore,
        sampleCount: metadata.totalQuestions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      onComplete?.(voiceProfileId);
      
    } catch (error) {
      const errorMessage = handleAPIError(error);
      dispatch(setVoiceAnalysisError(errorMessage));
    }
  };

  // Skip current question (for testing purposes)
  const skipQuestion = () => {
    if (currentQuestion) {
      handleTextResponse();
    }
  };

  if (isLoading && !conversationId) {
    return (
      <div className={`conversation-flow ${className}`}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparing your voice discovery session...</p>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className={`conversation-flow ${className}`}>
        <div className="text-center py-12">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Analyzing Your Voice
            </h3>
            <p className="text-gray-600">
              Our AI is processing your responses to create your unique voice signature...
            </p>
          </div>
          
          {/* Progress bar */}
          <div className="max-w-md mx-auto mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {Math.round(analysisProgress)}% complete
            </p>
          </div>
          
          <div className="text-sm text-gray-500">
            This usually takes 30-60 seconds...
          </div>
        </div>
      </div>
    );
  }

  if (voiceProfile) {
    return (
      <div className={`conversation-flow ${className}`}>
        <div className="text-center py-12">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Voice Discovery Complete!
            </h3>
            <p className="text-gray-600 mb-4">
              Your unique voice profile has been created with {Math.round(voiceProfile.accuracy * 100)}% confidence.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-green-800">
                You can now generate content that matches your authentic professional voice.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`conversation-flow ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Voice Discovery Assistant</h3>
              <p className="text-sm text-gray-600">
                Question {discoverySession.currentQuestion + 1} of {totalQuestions}
              </p>
            </div>
          </div>
          
          {estimatedTimeRemaining && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{estimatedTimeRemaining} remaining</span>
            </div>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ 
              width: `${((discoverySession.currentQuestion + 1) / totalQuestions) * 100}%` 
            }}
          />
        </div>
      </div>

      {/* Error display */}
      {(error || voiceError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 font-medium">Error</span>
          </div>
          <p className="text-red-600 text-sm mt-1">
            {error || voiceError}
          </p>
          {showTextFallback && (
            <p className="text-red-600 text-sm mt-2">
              You can continue using text responses below.
            </p>
          )}
        </div>
      )}

      {/* Current question */}
      {currentQuestion && !conversationComplete && (
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-3">
                  {currentQuestion.question}
                </h4>
                
                {currentQuestion.followUpPrompts && currentQuestion.followUpPrompts.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Consider:</p>
                    <ul className="text-sm text-gray-500 space-y-1">
                      {currentQuestion.followUpPrompts.map((prompt, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-gray-400">•</span>
                          <span>{prompt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {currentQuestion.expectedDuration && (
                  <p className="text-xs text-gray-400">
                    Expected response: ~{currentQuestion.expectedDuration} seconds
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice recorder */}
      {!conversationComplete && !showTextFallback && (
        <div className="mb-6">
          <VoiceRecorder
            onAudioRecorded={handleAudioResponse}
            maxDuration={120}
            isDisabled={isLoading}
            className="w-full"
          />
        </div>
      )}

      {/* Text fallback */}
      {(showTextFallback || conversationComplete) && !conversationComplete && (
        <div className="mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              Having trouble with audio? You can type your response instead.
            </p>
          </div>
          
          <div className="space-y-4">
            <textarea
              value={textResponse}
              onChange={(e) => setTextResponse(e.target.value)}
              placeholder="Type your response here..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isLoading}
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleTextResponse}
                disabled={isLoading || !textResponse.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {isLoading ? 'Submitting...' : 'Submit Response'}
              </button>
              
              <button
                onClick={() => setShowTextFallback(false)}
                disabled={isLoading}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Try Audio Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation history */}
      {responses.length > 0 && (
        <div className="mt-8">
          <h4 className="font-medium text-gray-900 mb-4">Conversation History</h4>
          <div className="space-y-4">
            {responses.map((response, index) => (
              <div key={index} className="border-l-4 border-gray-200 pl-4">
                <div className="flex items-start space-x-3">
                  <User className="w-5 h-5 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">
                      {response.question}
                    </p>
                    <p className="text-gray-900">{response.response}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        response.responseType === 'audio' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {response.responseType === 'audio' ? 'Audio' : 'Text'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(response.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationFlow;