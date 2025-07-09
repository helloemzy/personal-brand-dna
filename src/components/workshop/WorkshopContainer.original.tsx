import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import WorkshopErrorBoundary from './WorkshopErrorBoundary';
import { useAnnounce, useKeyboardNavigation } from '../../hooks/useAccessibility';
import { focusVisible, KeyCodes } from '../../utils/accessibility';
import LiveRegion from '../accessibility/LiveRegion';
import { 
  selectWorkshopState, 
  selectCurrentStep, 
  selectCompletedSteps,
  selectWorkshopProgress,
  goToStep,
  completeStep,
  startWorkshop,
  setSaving,
  setError,
  resetWorkshop
} from '../../store/slices/workshopSlice';
import { debouncedFunctions } from '../../utils/debounce';
import { useComponentPerformance } from '../../utils/performance';
import workshopAPI from '../../services/workshopAPI';
import { useWorkshopTracking } from '../../hooks/useTracking';

// Step Components (to be implemented)
import ValuesAudit from './steps/ValuesAudit';
import TonePreferences from './steps/TonePreferences';
import AudienceBuilder from './steps/AudienceBuilder';
import WritingSample from './steps/WritingSample';
import PersonalityQuiz from './steps/PersonalityQuiz';

// Progress Indicator Component
const ProgressIndicator: React.FC = () => {
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const currentStep = useAppSelector(selectCurrentStep);
  const completedSteps = useAppSelector(selectCompletedSteps);
  const progress = useAppSelector(selectWorkshopProgress);

  const steps = [
    { number: 1, title: 'Foundation', description: 'Mission & values' },
    { number: 2, title: 'Personality', description: 'Brand voice & tone' },
    { number: 3, title: 'Promise', description: 'Value proposition' },
    { number: 4, title: 'Proof', description: 'Credibility & expertise' },
    { number: 5, title: 'People', description: 'Target audience' }
  ];
  
  // Keyboard navigation for steps
  const { activeIndex } = useKeyboardNavigation(
    stepRefs.current.filter((ref): ref is HTMLDivElement => ref !== null),
    {
      orientation: 'horizontal',
      loop: false
    }
  );

  return (
    <div className="mb-6 sm:mb-8" role="region" aria-label="Workshop progress">
      {/* Mobile Progress Bar - Simplified */}
      <div className="sm:hidden mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Step {currentStep} of 5</span>
          <span className="text-sm text-gray-500">{progress}% complete</span>
        </div>
        <div className="relative h-2 bg-gray-200 rounded-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div 
            className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium text-gray-900">{steps[currentStep - 1].title}</p>
      </div>

      {/* Desktop Progress Indicator */}
      <div className="hidden sm:block" role="group" aria-label="Workshop steps">
        <div className="relative">
          <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full" />
          <div 
            className="absolute top-5 left-0 h-1 bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
          
          {/* Step Indicators */}
          <div className="relative flex justify-between" role="list">
            {steps.map((step, index) => (
              <div 
                key={step.number} 
                ref={el => stepRefs.current[index] = el}
                className="flex flex-col items-center"
                role="listitem"
                aria-current={currentStep === step.number ? 'step' : undefined}
              >
                <button
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-300 ${focusVisible}
                    ${currentStep === step.number 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                      : completedSteps.includes(step.number)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                    }
                  `}
                  aria-label={`${step.title} - ${completedSteps.includes(step.number) ? 'Completed' : currentStep === step.number ? 'Current step' : 'Not started'}`}
                  tabIndex={activeIndex === index ? 0 : -1}
                  disabled={!completedSteps.includes(step.number) && step.number !== currentStep}
                >
                  {completedSteps.includes(step.number) ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </button>
                <div className="mt-2 text-center">
                  <p className="text-sm font-medium text-gray-900">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-1 hidden lg:block">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Workshop Container
const WorkshopContainer: React.FC = () => {
  const announce = useAnnounce();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const workshopState = useAppSelector(selectWorkshopState);
  const currentStep = useAppSelector(selectCurrentStep);
  const completedSteps = useAppSelector(selectCompletedSteps);
  const [showWelcome, setShowWelcome] = useState(false);
  const [stepAnnouncement, setStepAnnouncement] = useState('');
  
  // Analytics tracking
  const { 
    trackWorkshopStart, 
    trackWorkshopComplete, 
    trackWorkshopDropOff,
    trackStepStart,
    trackStepComplete 
  } = useWorkshopTracking();
  
  // Track component performance
  useComponentPerformance('WorkshopContainer');

  // Initialize workshop state only once on mount
  useEffect(() => {
    // Check if coming from assessment
    const fromAssessment = location.state?.fromAssessment || false;
    if (fromAssessment && workshopState.assessmentScore !== null) {
      setShowWelcome(true);
      // Clear the state to prevent showing again on refresh
      window.history.replaceState({}, document.title);
    }
    
    // Only initialize if workshop hasn't started yet
    if (!workshopState.startedAt && !workshopState.sessionId) {
      console.log('Initializing new workshop session');
      dispatch(startWorkshop());
      trackWorkshopStart();
    }
  }, []); // Empty dependency array - only run once on mount
  
  // Track step changes
  useEffect(() => {
    if (workshopState.startedAt && currentStep) {
      trackStepStart(`Step ${currentStep}`);
      
      // Announce step change
      const stepNames = ['Foundation', 'Personality', 'Promise', 'Proof', 'People'];
      const stepName = stepNames[currentStep - 1];
      setStepAnnouncement(`Step ${currentStep} of 5: ${stepName}`);
      announce(`Now on step ${currentStep}: ${stepName}`);
    }
  }, [currentStep, announce]);
  
  // Track drop-offs when leaving the page without completing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (workshopState.startedAt && currentStep < 5) {
        trackWorkshopDropOff(`Step ${currentStep}`, 'page_unload');
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [workshopState.startedAt, currentStep, trackWorkshopDropOff]);

  // Save workshop progress function
  const saveWorkshopProgress = useCallback(async () => {
    if (!workshopState.sessionId) {
      console.log('No session ID, skipping save');
      return;
    }

    try {
      dispatch(setSaving(true));
      console.log('Auto-saving workshop progress...', workshopState);
      
      // Prepare step data based on current step
      // The backend expects stepData to have keys matching the step names
      let stepData: any = {};
      
      switch (currentStep) {
        case 1:
          stepData = {
            values: {
              selected: workshopState.values.selected,
              custom: workshopState.values.custom,
              rankings: workshopState.values.rankings,
              primary: workshopState.values.primary,
              aspirational: workshopState.values.aspirational,
              stories: workshopState.values.stories
            }
          };
          break;
        case 2:
          stepData = {
            tone: workshopState.tonePreferences
          };
          break;
        case 3:
          stepData = {
            audience: workshopState.audiencePersonas
          };
          break;
        case 4:
          stepData = {
            writing_sample: {
              text: workshopState.writingSample?.text || '',
              wordCount: workshopState.writingSample?.wordCount || 0,
              uploadedAt: workshopState.writingSample?.uploadedAt || new Date().toISOString()
            }
          };
          break;
        case 5:
          stepData = {
            personality: {
              responses: workshopState.personalityQuiz.responses,
              currentQuestionIndex: workshopState.personalityQuiz.currentQuestionIndex
            }
          };
          break;
      }
      
      // Call the API to save progress
      const response = await workshopAPI.saveProgress({
        sessionId: workshopState.sessionId,
        step: currentStep,
        stepData
      });
      
      console.log('Workshop progress saved successfully:', response.data);
      dispatch(setSaving(false));
      dispatch(setError(null)); // Clear any previous errors
    } catch (error: any) {
      console.error('Failed to save workshop progress:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to save progress. Your work will be saved when connection is restored.';
      
      if (error.response?.status === 503) {
        errorMessage = 'Workshop save feature is in demo mode. Database connection not configured.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Your session has expired. Please log in again.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Workshop session not found. Please refresh the page.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      dispatch(setError(errorMessage));
      dispatch(setSaving(false));
    }
  }, [workshopState, currentStep, dispatch]);

  // Create debounced auto-save function
  // TEMPORARILY DISABLED: Auto-save causing issues with unconfigured Supabase
  // const debouncedAutoSave = useMemo(
  //   () => debouncedFunctions.workshopAutoSave(saveWorkshopProgress),
  //   [saveWorkshopProgress]
  // );

  // Auto-save when workshop state changes
  // TEMPORARILY DISABLED: To prevent API errors
  // useEffect(() => {
  //   if (workshopState.startedAt) {
  //     debouncedAutoSave();
  //   }
  // }, [workshopState, debouncedAutoSave]);

  const handleNext = useCallback(() => {
    // Track step completion
    trackStepComplete(`Step ${currentStep}`);
    
    // Mark current step as completed
    dispatch(completeStep(currentStep));
    
    // Move to next step or complete workshop
    if (currentStep < 5) {
      dispatch(goToStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5));
    } else {
      // Workshop completed
      trackWorkshopComplete();
      announce('Congratulations! Workshop completed. Navigating to results.');
      navigate('/workshop/results');
    }
  }, [currentStep, dispatch, navigate, trackStepComplete, trackWorkshopComplete, announce]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      dispatch(goToStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5));
    }
  }, [currentStep, dispatch]);


  // Render current step component
  const renderStep = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <ValuesAudit />;
      case 2:
        return <TonePreferences />;
      case 3:
        return <AudienceBuilder />;
      case 4:
        return <WritingSample />;
      case 5:
        return <PersonalityQuiz />;
      default:
        return null;
    }
  }, [currentStep]);

  // Check if current step is valid for navigation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return workshopState.values.selected.length >= 5 && 
               workshopState.values.primary?.length === 2;
      case 2:
        return true; // Tone preferences always have default values
      case 3:
        return workshopState.audiencePersonas.length >= 1;
      case 4:
        return workshopState.writingSample !== null;
      case 5:
        return workshopState.personalityQuiz.responses.length >= 18; // 10 personality + 4 professional + 4 mission
      default:
        return false;
    }
  }, [currentStep, workshopState]);

  // Get personalized welcome message based on assessment
  const getWelcomeMessage = () => {
    if (!workshopState.workshopPath || !workshopState.assessmentScore) return null;
    
    const score = workshopState.assessmentScore;
    const path = workshopState.workshopPath;
    
    if (path === 'direct') {
      return {
        title: "Great! You have strong clarity on your professional brand",
        message: "Since you're already clear on your purpose and uniqueness, we'll streamline your workshop experience with more direct questions to capture your brand essence quickly.",
        emoji: "🎯"
      };
    } else if (path === 'discovery') {
      return {
        title: "Perfect! Let's explore and discover your brand together",
        message: "This workshop will help you uncover your unique professional voice through story-based questions and self-reflection. We'll build clarity step by step.",
        emoji: "🌱"
      };
    } else {
      return {
        title: "You're on the right track with room to refine",
        message: "You have some clarity about your brand, and this workshop will help sharpen your focus and fill in the gaps. We'll use a mix of direct and exploratory questions.",
        emoji: "✨"
      };
    }
  };

  const welcomeMessage = getWelcomeMessage();

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <LiveRegion message={stepAnnouncement} priority="polite" />
        {/* Welcome Message */}
        {showWelcome && welcomeMessage && (
          <div className="mb-6 sm:mb-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 sm:p-6 border border-purple-200">
            <div className="flex items-start">
              <div className="text-3xl sm:text-4xl mr-3 sm:mr-4">{welcomeMessage.emoji}</div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                  {welcomeMessage.title}
                </h2>
                <p className="text-sm sm:text-base text-gray-700">{welcomeMessage.message}</p>
                <button
                  onClick={() => setShowWelcome(false)}
                  className="mt-3 sm:mt-4 text-purple-600 hover:text-purple-700 font-medium text-sm"
                >
                  Let's get started →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Brand Voice Discovery Workshop
          </h1>
          <p className="mt-2 text-base sm:text-lg text-gray-600 px-2">
            Let's discover your unique professional voice in just 5 steps
          </p>
        </header>

        {/* Progress Indicator */}
        <ProgressIndicator />

        {/* Step Content */}
        <section 
          className="bg-white rounded-xl shadow-sm p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6"
          aria-label="Workshop step content"
        >
          <div className="min-h-[300px] sm:min-h-[400px]">
            {renderStep}
          </div>
        </section>

        {/* Navigation Controls */}
        <nav 
          className="flex flex-col sm:flex-row justify-between items-center gap-4"
          aria-label="Workshop navigation"
        >
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`
              w-full sm:w-auto flex items-center justify-center px-4 sm:px-6 py-3 rounded-lg font-medium transition-all ${focusVisible}
              ${currentStep === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }
            `}
            aria-label="Go to previous step"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Back
          </button>

          <div className="flex items-center space-x-2 order-first sm:order-none">
            {workshopState.isSaving && (
              <span className="text-sm text-gray-500 italic">
                Saving...
              </span>
            )}
            <button
              onClick={saveWorkshopProgress}
              disabled={workshopState.isSaving}
              className={`px-3 sm:px-4 py-2 text-sm transition-colors ${
                workshopState.isSaving 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Save Progress
            </button>
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`
              w-full sm:w-auto flex items-center justify-center px-4 sm:px-6 py-3 rounded-lg font-medium transition-all ${focusVisible}
              ${canProceed
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
            aria-label={currentStep === 5 ? 'Complete workshop' : 'Go to next step'}
            aria-disabled={!canProceed}
          >
            {currentStep === 5 ? 'Complete Workshop' : 'Next'}
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </nav>

        {/* Error Message */}
        {workshopState.lastError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {workshopState.lastError}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => dispatch(setError(null))}
                  className="inline-flex text-red-400 hover:text-red-500"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <footer className="mt-6 text-center text-sm text-gray-500">
          <p>Your progress is automatically saved as you work</p>
          <p className="mt-1">
            Need help? <a href="#" className={`text-blue-600 hover:underline ${focusVisible}`}>Contact support</a>
          </p>
        </footer>
      </div>
    </div>
  );
};

// Wrap with error boundary
const WorkshopContainerWithErrorBoundary: React.FC = () => (
  <WorkshopErrorBoundary>
    <WorkshopContainer />
  </WorkshopErrorBoundary>
);

export default React.memo(WorkshopContainerWithErrorBoundary);