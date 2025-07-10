import { useEffect, useRef, useCallback } from 'react';
import { useAppSelector } from './redux';
import { selectWorkshopState } from '../store/slices/workshopSlice';

interface UserBehaviorMetrics {
  timeSpentOnStep: Record<number, number>;
  navigationPatterns: Array<{ from: number; to: number; timestamp: number }>;
  completionRate: number;
  backtrackingFrequency: number;
  sessionDuration: number;
  lastActiveTime: number;
}

interface PreloadingStrategy {
  nextStepProbability: number;
  previousStepProbability: number;
  skipProbability: number;
  shouldPreloadAll: boolean;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Hook for intelligent workshop step preloading based on user behavior analysis
 */
export const useIntelligentPreloading = (currentStep: number) => {
  const workshopState = useAppSelector(selectWorkshopState);
  const behaviorMetrics = useRef<UserBehaviorMetrics>({
    timeSpentOnStep: {},
    navigationPatterns: [],
    completionRate: 0,
    backtrackingFrequency: 0,
    sessionDuration: 0,
    lastActiveTime: Date.now()
  });
  const stepStartTime = useRef<number>(Date.now());
  const preloadedSteps = useRef<Set<number>>(new Set());

  // Analyze user behavior patterns
  const analyzeUserBehavior = useCallback((): PreloadingStrategy => {
    const metrics = behaviorMetrics.current;
    const sessionDuration = Date.now() - (workshopState.startedAt || Date.now());
    
    // Calculate average time per step
    const totalTimeSpent = Object.values(metrics.timeSpentOnStep).reduce((sum, time) => sum + time, 0);
    const avgTimePerStep = totalTimeSpent / Math.max(Object.keys(metrics.timeSpentOnStep).length, 1);
    
    // Analyze navigation patterns
    const forwardNavigations = metrics.navigationPatterns.filter(nav => nav.to > nav.from).length;
    const backwardNavigations = metrics.navigationPatterns.filter(nav => nav.to < nav.from).length;
    const backtrackingFrequency = backwardNavigations / Math.max(metrics.navigationPatterns.length, 1);
    
    // Calculate completion confidence based on current progress
    const completionConfidence = currentStep / 5; // 5 total steps
    
    // Determine preloading strategy
    let strategy: PreloadingStrategy;
    
    if (sessionDuration < 60000) { // First minute - conservative approach
      strategy = {
        nextStepProbability: 0.7,
        previousStepProbability: 0.2,
        skipProbability: 0.1,
        shouldPreloadAll: false,
        priority: 'medium'
      };
    } else if (backtrackingFrequency > 0.3) { // High backtracking - preload previous steps
      strategy = {
        nextStepProbability: 0.4,
        previousStepProbability: 0.6,
        skipProbability: 0.0,
        shouldPreloadAll: false,
        priority: 'high'
      };
    } else if (completionConfidence > 0.6 && avgTimePerStep < 120000) { // Fast progression
      strategy = {
        nextStepProbability: 0.9,
        previousStepProbability: 0.1,
        skipProbability: 0.0,
        shouldPreloadAll: true,
        priority: 'high'
      };
    } else if (avgTimePerStep > 300000) { // Slow progression - conservative
      strategy = {
        nextStepProbability: 0.6,
        previousStepProbability: 0.3,
        skipProbability: 0.1,
        shouldPreloadAll: false,
        priority: 'low'
      };
    } else { // Default strategy
      strategy = {
        nextStepProbability: 0.8,
        previousStepProbability: 0.2,
        skipProbability: 0.0,
        shouldPreloadAll: false,
        priority: 'medium'
      };
    }
    
    return strategy;
  }, [currentStep, workshopState.startedAt]);

  // Preload component with intelligent priority
  const preloadComponent = useCallback(async (
    stepNumber: number, 
    priority: 'high' | 'medium' | 'low'
  ) => {
    if (preloadedSteps.current.has(stepNumber)) return;
    
    const delay = priority === 'high' ? 0 : priority === 'medium' ? 1000 : 3000;
    
    setTimeout(async () => {
      try {
        let componentPromise: Promise<any>;
        
        switch (stepNumber) {
          case 1:
            componentPromise = import('../components/workshop/steps/ValuesAuditAccessible');
            break;
          case 2:
            componentPromise = import('../components/workshop/steps/TonePreferencesAccessible');
            break;
          case 3:
            componentPromise = import('../components/workshop/steps/AudienceBuilderAccessible');
            break;
          case 4:
            componentPromise = import('../components/workshop/steps/WritingSampleAccessible');
            break;
          case 5:
            componentPromise = import('../components/workshop/steps/PersonalityQuizAccessible');
            break;
          default:
            return;
        }
        
        await componentPromise;
        preloadedSteps.current.add(stepNumber);
        
        // Track preloading success for analytics
        if (process.env.NODE_ENV === 'development') {
          console.log(`Preloaded step ${stepNumber} with ${priority} priority`);
        }
      } catch (error) {
        console.warn(`Failed to preload step ${stepNumber}:`, error);
      }
    }, delay);
  }, []);

  // Preload based on strategy
  const executePreloadingStrategy = useCallback((strategy: PreloadingStrategy) => {
    // Always preload next step if probability is high
    if (strategy.nextStepProbability > 0.7 && currentStep < 5) {
      preloadComponent(currentStep + 1, strategy.priority);
    }
    
    // Preload previous step if user tends to backtrack
    if (strategy.previousStepProbability > 0.4 && currentStep > 1) {
      preloadComponent(currentStep - 1, 'low');
    }
    
    // Preload all remaining steps for fast users
    if (strategy.shouldPreloadAll && currentStep >= 2) {
      for (let step = currentStep + 1; step <= 5; step++) {
        preloadComponent(step, step === currentStep + 1 ? 'high' : 'low');
      }
    }
    
    // Skip-ahead preloading for confident users
    if (strategy.skipProbability > 0.2 && currentStep < 4) {
      preloadComponent(currentStep + 2, 'low');
    }
  }, [currentStep, preloadComponent]);

  // Track step navigation
  const trackNavigation = useCallback((fromStep: number, toStep: number) => {
    behaviorMetrics.current.navigationPatterns.push({
      from: fromStep,
      to: toStep,
      timestamp: Date.now()
    });
    
    // Keep only recent navigation patterns (last 10)
    if (behaviorMetrics.current.navigationPatterns.length > 10) {
      behaviorMetrics.current.navigationPatterns.shift();
    }
  }, []);

  // Track time spent on current step
  useEffect(() => {
    stepStartTime.current = Date.now();
    
    return () => {
      const timeSpent = Date.now() - stepStartTime.current;
      behaviorMetrics.current.timeSpentOnStep[currentStep] = timeSpent;
      behaviorMetrics.current.lastActiveTime = Date.now();
    };
  }, [currentStep]);

  // Execute intelligent preloading
  useEffect(() => {
    const strategy = analyzeUserBehavior();
    executePreloadingStrategy(strategy);
  }, [currentStep, analyzeUserBehavior, executePreloadingStrategy]);

  // Network-aware preloading (disable on slow connections)
  useEffect(() => {
    const connection = (navigator as any).connection;
    if (connection) {
      const isSlowConnection = connection.effectiveType === 'slow-2g' || 
                               connection.effectiveType === '2g' ||
                               connection.saveData;
      
      if (isSlowConnection) {
        // Clear preloaded steps to save bandwidth
        preloadedSteps.current.clear();
        console.log('Slow connection detected - disabling preloading');
      }
    }
  }, []);

  // Visibility change handling (pause preloading when tab is not visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched tabs - pause preloading
        behaviorMetrics.current.lastActiveTime = Date.now();
      } else {
        // User returned - resume intelligent preloading
        const strategy = analyzeUserBehavior();
        executePreloadingStrategy(strategy);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [analyzeUserBehavior, executePreloadingStrategy]);

  return {
    trackNavigation,
    preloadedSteps: Array.from(preloadedSteps.current),
    behaviorMetrics: behaviorMetrics.current,
    isPreloaded: (stepNumber: number) => preloadedSteps.current.has(stepNumber)
  };
};