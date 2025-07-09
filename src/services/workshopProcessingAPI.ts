import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';
import { 
  processWorkshopData, 
  getProcessingStatus,
  clearSessionCache 
} from './workshopProcessingPipeline';
import { 
  WorkshopData, 
  ProcessedResults, 
  ProcessingStatus,
  ProcessingResponse 
} from '../types/workshop';
import { workshopPersistenceService } from './workshopPersistenceService';
import * as Sentry from '@sentry/react';

// Enhanced Workshop API with processing pipeline
export const workshopProcessingAPI = {
  /**
   * Process completed workshop data
   * This is the main endpoint that orchestrates all processing
   */
  processWorkshop: async (
    workshopData: WorkshopData,
    sessionId: string
  ): Promise<ProcessingResponse> => {
    try {
      // Process locally first for immediate feedback
      const localResult = await processWorkshopData(workshopData, sessionId);
      
      if (!localResult.success) {
        return {
          success: false,
          error: localResult.error
        };
      }

      // Save results to persistence layer
      await workshopPersistenceService.saveWorkshopData(workshopData);

      // Send to backend API
      try {
        const response: AxiosResponse<ProcessingResponse> = await apiClient.post(
          '/api/workshop/complete',
          {
            sessionId,
            workshopData,
            results: localResult.data
          }
        );

        return response.data;
      } catch (apiError) {
        // If API fails, we still have local results
        console.error('API save failed, using local results:', apiError);
        return {
          success: true,
          sessionId,
          results: localResult.data
        };
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'workshop_processing_api' },
        extra: { sessionId }
      });

      return {
        success: false,
        error: {
          code: 'PROCESSING_FAILED',
          message: error.message || 'Failed to process workshop data',
          details: error
        }
      };
    }
  },

  /**
   * Generate results from workshop data
   * Can be called separately to regenerate results
   */
  generateResults: async (
    workshopData: WorkshopData,
    sessionId: string,
    useCache: boolean = true
  ): Promise<ProcessingResponse> => {
    try {
      const result = await processWorkshopData(
        workshopData,
        sessionId,
        { enableCache: useCache }
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      // Try to save to backend
      try {
        const response: AxiosResponse<ProcessingResponse> = await apiClient.post(
          '/api/workshop/generate-results',
          {
            sessionId,
            results: result.data
          }
        );

        return response.data;
      } catch (apiError) {
        // Return local results if API fails
        return {
          success: true,
          sessionId,
          results: result.data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: error.message || 'Failed to generate results',
          details: error
        }
      };
    }
  },

  /**
   * Get workshop results by session ID
   */
  getResults: async (sessionId: string): Promise<ProcessingResponse> => {
    try {
      // Check cache first
      const status = getProcessingStatus(sessionId);
      if (status?.status === 'processing') {
        return {
          success: false,
          error: {
            code: 'PROCESSING_IN_PROGRESS',
            message: 'Results are still being processed',
            details: { progress: status.progress }
          }
        };
      }

      // Try to get from backend
      try {
        const response: AxiosResponse<ProcessingResponse> = await apiClient.get(
          `/api/workshop/results/${sessionId}`
        );

        return response.data;
      } catch (apiError) {
        // Try to get from local storage
        const localData = await workshopPersistenceService.loadWorkshopData();
        if (localData && localData.sessionId === sessionId) {
          // Regenerate results from local data
          const result = await processWorkshopData(localData, sessionId);
          
          if (result.success) {
            return {
              success: true,
              sessionId,
              results: result.data
            };
          }
        }

        throw apiError;
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RESULTS_NOT_FOUND',
          message: 'Could not retrieve workshop results',
          details: error
        }
      };
    }
  },

  /**
   * Save workshop progress (auto-save)
   */
  saveProgress: async (
    workshopData: WorkshopData,
    sessionId: string
  ): Promise<{ success: boolean; error?: any }> => {
    try {
      // Save locally first
      await workshopPersistenceService.saveWorkshopData(workshopData);

      // Try to save to backend
      try {
        await apiClient.post('/api/workshop/save-progress', {
          sessionId,
          currentStep: workshopData.currentStep,
          data: workshopData
        });
      } catch (apiError) {
        // Log but don't fail - local save is enough
        console.warn('Failed to save to backend:', apiError);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SAVE_FAILED',
          message: error.message || 'Failed to save progress'
        }
      };
    }
  },

  /**
   * Get processing status for a session
   */
  getStatus: async (sessionId: string): Promise<ProcessingStatus | null> => {
    // First check local status
    const localStatus = getProcessingStatus(sessionId);
    if (localStatus) {
      return localStatus;
    }

    // Try to get from backend
    try {
      const response = await apiClient.get(`/api/workshop/status/${sessionId}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Clear cached results for a session
   */
  clearCache: (sessionId: string): void => {
    clearSessionCache(sessionId);
  },

  /**
   * Retry failed processing
   */
  retryProcessing: async (
    sessionId: string
  ): Promise<ProcessingResponse> => {
    try {
      // Clear cache to force reprocessing
      clearSessionCache(sessionId);

      // Load workshop data
      const workshopData = await workshopPersistenceService.loadWorkshopData();
      if (!workshopData) {
        return {
          success: false,
          error: {
            code: 'NO_DATA',
            message: 'No workshop data found to reprocess'
          }
        };
      }

      // Reprocess
      return await workshopProcessingAPI.processWorkshop(workshopData, sessionId);
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RETRY_FAILED',
          message: error.message || 'Failed to retry processing'
        }
      };
    }
  },

  /**
   * Export results in various formats
   */
  exportResults: async (
    sessionId: string,
    format: 'json' | 'pdf' | 'csv' = 'json'
  ): Promise<{ success: boolean; data?: any; error?: any }> => {
    try {
      const response = await apiClient.get(
        `/api/workshop/export/${sessionId}?format=${format}`,
        {
          responseType: format === 'pdf' ? 'blob' : 'json'
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: error.message || 'Failed to export results'
        }
      };
    }
  }
};

// Export types and API
export type { ProcessingResponse, ProcessingStatus };
export default workshopProcessingAPI;