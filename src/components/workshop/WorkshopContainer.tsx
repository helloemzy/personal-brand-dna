import React, { useEffect, useCallback, useMemo, useState, useRef, Suspense } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import WorkshopErrorBoundary from './WorkshopErrorBoundary';
import { useAnnounce, useKeyboardNavigation } from '../../hooks/useAccessibility';
import { useIntelligentPreloading } from '../../hooks/useIntelligentPreloading';
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
import { lazyWithPreload, preloadOnIdle } from '../../utils/lazyWithPreload';
import { WorkshopLoadingFallback } from '../LazyLoadingFallback';
import { useWorkshopAutoSave } from '../../hooks/useWorkshopAutoSave';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { WorkshopSessionRecovery } from './WorkshopSessionRecovery';

// Lazy load workshop steps with preloading capability
// Use accessible version where available
const ValuesAudit = lazyWithPreload(() => import('./steps/ValuesAuditAccessible'));
const TonePreferences = lazyWithPreload(() => import('./steps/TonePreferencesAccessible'));
const AudienceBuilder = lazyWithPreload(() => import('./steps/AudienceBuilderAccessible'));
const WritingSample = lazyWithPreload(() => import('./steps/WritingSample'));
const PersonalityQuiz = lazyWithPreload(() => import('./steps/PersonalityQuiz'));

// Map of step components for preloading
const stepComponents = {
  1: ValuesAudit,
  2: TonePreferences,
  3: AudienceBuilder,
  4: WritingSample,
  5: PersonalityQuiz
};

// Save Status Indicator Component
const SaveStatusIndicator: React.FC<{
  isSaving: boolean;
  lastSaved: Date | null;
  saveError: Error | null;
  hasPendingChanges: boolean;
  onSaveNow?: () => void;
}> = ({ isSaving, lastSaved, saveError, hasPendingChanges, onSaveNow }) => {
  const getStatusMessage = () => {
    if (isSaving) {
      return { text: 'Saving...', icon: Save, color: 'text-blue-600' };
    }
    if (saveError) {
      return { text: 'Save failed', icon: AlertCircle, color: 'text-red-600' };
    }
    if (lastSaved && !hasPendingChanges) {
      const timeAgo = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      const text = timeAgo < 60 ? 'Saved just now' : `Saved ${Math.floor(timeAgo / 60)}m ago`;
      return { text, icon: CheckCircle, color: 'text-green-600' };
    }
    if (hasPendingChanges) {
      return { text: 'Unsaved changes', icon: Save, color: 'text-yellow-600' };
    }
    return { text: 'All changes saved', icon: CheckCircle, color: 'text-gray-500' };
  };

  const status = getStatusMessage();
  const Icon = status.icon;

  return (
    <div className="flex items-center space-x-2 text-sm">
      <Icon className={`w-4 h-4 ${status.color}`} />
      <span className={status.color}>{status.text}</span>
      {saveError && onSaveNow && (
        <button
          onClick={onSaveNow}
          className="ml-2 text-blue-600 hover:text-blue-700 underline text-xs"
        >
          Retry
        </button>
      )}
    </div>
  );
};

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
  
  // Auto-save hook with status tracking
  const {
    isSaving: autoSaveInProgress,
    lastSaved,
    saveError,
    hasPendingChanges,
    saveNow: triggerAutoSave,
  } = useWorkshopAutoSave({
    enabled: true,
    onlySignificantChanges: false,
    onSaveStart: () => {
      dispatch(setSaving(true));
    },
    onSaveComplete: (success) => {
      dispatch(setSaving(false));
      if (success) {
        dispatch(setError(null));
      }
    },
    onSaveError: (error) => {
      dispatch(setError(`Auto-save failed: ${error.message}`));
      dispatch(setSaving(false));
    },
  });

  // Intelligent preloading based on user behavior
  const { trackNavigation, isPreloaded, behaviorMetrics } = useIntelligentPreloading(currentStep);

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

    // Preload first few steps
    preloadOnIdle(ValuesAudit);
    preloadOnIdle(TonePreferences);
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

  // Manual save is now handled by the auto-save hook
  // The saveWorkshopProgress function has been replaced by useWorkshopAutoSave
  // which provides automatic saving with debouncing and error handling

  const handleNext = useCallback(() => {
    // Track step completion
    trackStepComplete(`Step ${currentStep}`);
    
    // Mark current step as completed
    dispatch(completeStep(currentStep));
    
    // Move to next step or complete workshop
    if (currentStep < 5) {
      // Track navigation for intelligent preloading
      trackNavigation(currentStep, currentStep + 1);
      dispatch(goToStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5));
    } else {
      // Workshop completed
      trackWorkshopComplete();
      announce('Congratulations! Workshop completed. Navigating to results.');
      navigate('/workshop/results');
    }
  }, [currentStep, dispatch, navigate, trackStepComplete, trackWorkshopComplete, announce, trackNavigation]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      // Track navigation for intelligent preloading
      trackNavigation(currentStep, currentStep - 1);
      dispatch(goToStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5));
    }
  }, [currentStep, dispatch, trackNavigation]);

  // Render current step component with lazy loading
  const renderStep = useMemo(() => {
    const StepComponent = stepComponents[currentStep as keyof typeof stepComponents];
    
    if (!StepComponent) return null;
    
    return (
      <Suspense fallback={<WorkshopLoadingFallback />}>
        <StepComponent />
      </Suspense>
    );
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
        
        {/* Session Recovery Modal */}
        <WorkshopSessionRecovery
          autoShow={!workshopState.startedAt}
          onRecover={(session) => {
            announce('Workshop session recovered successfully');
          }}
          onStartNew={() => {
            dispatch(resetWorkshop());
            dispatch(startWorkshop());
            trackWorkshopStart();
          }}
        />
        
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

          <div className="order-first sm:order-none">
            <SaveStatusIndicator
              isSaving={autoSaveInProgress || workshopState.isSaving}
              lastSaved={lastSaved}
              saveError={saveError}
              hasPendingChanges={hasPendingChanges}
              onSaveNow={triggerAutoSave}
            />
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
          <p>
            Your progress is automatically saved every few seconds
            {lastSaved && !saveError && (
              <span className="ml-1">
                • Last saved {new Date(lastSaved).toLocaleTimeString()}
              </span>
            )}
          </p>
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