import React, { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { 
  selectWorkshopState, 
  selectCurrentStep, 
  selectCompletedSteps,
  selectWorkshopProgress,
  goToStep,
  completeStep,
  startWorkshop
} from '../../store/slices/workshopSlice';
import { AppDispatch } from '../../store';
import { debouncedFunctions } from '../../utils/debounce';
import { useComponentPerformance } from '../../utils/performance';

// Step Components (to be implemented)
import ValuesAudit from './steps/ValuesAudit';
import TonePreferences from './steps/TonePreferences';
import AudienceBuilder from './steps/AudienceBuilder';
import WritingSample from './steps/WritingSample';
import PersonalityQuiz from './steps/PersonalityQuiz';

// Progress Indicator Component
const ProgressIndicator: React.FC = () => {
  const currentStep = useSelector(selectCurrentStep);
  const completedSteps = useSelector(selectCompletedSteps);
  const progress = useSelector(selectWorkshopProgress);

  const steps = [
    { number: 1, title: 'Values', description: 'Core professional values' },
    { number: 2, title: 'Tone', description: 'Communication style' },
    { number: 3, title: 'Audience', description: 'Target personas' },
    { number: 4, title: 'Writing', description: 'Sample analysis' },
    { number: 5, title: 'Personality', description: 'Quick assessment' }
  ];

  return (
    <div className="mb-8">
      {/* Progress Bar */}
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full" />
        <div 
          className="absolute top-5 left-0 h-1 bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
        
        {/* Step Indicators */}
        <div className="relative flex justify-between">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  transition-all duration-300 cursor-pointer
                  ${currentStep === step.number 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                    : completedSteps.includes(step.number)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                  }
                `}
              >
                {completedSteps.includes(step.number) ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.number
                )}
              </div>
              <div className="mt-2 text-center">
                <p className="text-sm font-medium text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-500 mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main Workshop Container
const WorkshopContainer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const workshopState = useSelector(selectWorkshopState);
  const currentStep = useSelector(selectCurrentStep);
  const completedSteps = useSelector(selectCompletedSteps);
  
  // Track component performance
  useComponentPerformance('WorkshopContainer');

  // Initialize workshop on mount
  useEffect(() => {
    if (!workshopState.startedAt) {
      dispatch(startWorkshop());
    }
  }, [dispatch, workshopState.startedAt]);

  // Save workshop progress function
  const saveWorkshopProgress = useCallback(async () => {
    try {
      // API call to save workshop state
      console.log('Auto-saving workshop progress...', workshopState);
      // await api.saveWorkshopProgress(workshopState);
    } catch (error) {
      console.error('Failed to save workshop progress:', error);
    }
  }, [workshopState]);

  // Create debounced auto-save function
  const debouncedAutoSave = useMemo(
    () => debouncedFunctions.workshopAutoSave(saveWorkshopProgress),
    [saveWorkshopProgress]
  );

  // Auto-save when workshop state changes
  useEffect(() => {
    if (workshopState.startedAt) {
      debouncedAutoSave();
    }
  }, [workshopState, debouncedAutoSave]);

  const handleNext = useCallback(() => {
    // Mark current step as completed
    dispatch(completeStep(currentStep));
    
    // Move to next step or complete workshop
    if (currentStep < 5) {
      dispatch(goToStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5));
    } else {
      // Workshop completed
      navigate('/workshop/results');
    }
  }, [currentStep, dispatch, navigate]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      dispatch(goToStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5));
    }
  }, [currentStep, dispatch]);

  const handleStepClick = useCallback((step: 1 | 2 | 3 | 4 | 5) => {
    // Allow navigation to completed steps or current step
    if (step <= currentStep || completedSteps.includes(step - 1)) {
      dispatch(goToStep(step));
    }
  }, [currentStep, completedSteps, dispatch]);

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
        return workshopState.values.selected.length >= 5;
      case 2:
        return true; // Tone preferences always have default values
      case 3:
        return workshopState.audiencePersonas.length >= 1;
      case 4:
        return workshopState.writingSample !== null;
      case 5:
        return workshopState.personalityQuiz.responses.length >= 10;
      default:
        return false;
    }
  }, [currentStep, workshopState]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Brand Voice Discovery Workshop
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Let's discover your unique professional voice in just 5 steps
          </p>
        </div>

        {/* Progress Indicator */}
        <ProgressIndicator />

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <div className="min-h-[400px]">
            {renderStep}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`
              flex items-center px-6 py-3 rounded-lg font-medium transition-all
              ${currentStep === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }
            `}
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Back
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={saveWorkshopProgress}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Save Progress
            </button>
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`
              flex items-center px-6 py-3 rounded-lg font-medium transition-all
              ${canProceed
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {currentStep === 5 ? 'Complete Workshop' : 'Next'}
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Your progress is automatically saved as you work</p>
          <p className="mt-1">
            Need help? <a href="#" className="text-blue-600 hover:underline">Contact support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(WorkshopContainer);