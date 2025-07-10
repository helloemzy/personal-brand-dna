// Export all API services with consolidated endpoints
export { authAPI, handleAPIError, default as apiClient } from './authAPI-consolidated';
export { contentAPI } from './contentAPI';
export { voiceAPI } from './voiceAPI';
export { workshopAPI } from './workshopAPI';
export { newsAPI } from './newsAPI';
export { calendarAPI } from './calendarAPI';
export { linkedinAPI } from './linkedinAPI';
export { monitoringAPI, captureError } from './monitoringAPI';

// Export persistence services
export { workshopPersistence } from './workshopPersistenceService';
export { workshopSessionService } from './workshopSessionService';
export type { OfflineQueueItem, ConflictResolution } from './workshopPersistenceService';
export type { WorkshopSession as WorkshopSessionData } from './workshopSessionService';

// Re-export types
export type {
  // Content types
  ContentTemplate,
  TemplatesResponse,
  GenerateContentRequest,
  GeneratedContent,
  ContentGenerationResponse,
  ContentListResponse,
  ContentDetailResponse,
  ContentStatsResponse,
  ContentFeedbackRequest,
} from './contentAPI';

export type {
  // Voice types
  ConversationQuestion,
  ConversationStartResponse,
  AudioUploadResponse,
  TextResponseData,
  VoiceSignature,
  VoiceProfile,
  VoiceAnalysisCompleteResponse,
  VoiceProfilesResponse,
} from './voiceAPI';

export type {
  // Workshop types
  WorkshopSession,
  WorkshopStartResponse,
  WorkshopSaveResponse,
  WorkshopCompleteResponse,
  WorkshopSessionsResponse,
} from './workshopAPI';

export type {
  // News types
  NewsSource,
  NewsArticle,
  NewsSourcesResponse,
  NewsArticlesResponse,
  NewsInteractionRequest,
} from './newsAPI';

export type {
  // Calendar types
  CalendarEvent,
  CalendarEventsResponse,
  CalendarStatsResponse,
  CreateEventRequest,
  UpdateEventRequest,
} from './calendarAPI';

export type {
  // LinkedIn types
  LinkedInProfile,
  LinkedInPost,
  LinkedInAuthResponse,
  LinkedInTokenResponse,
  LinkedInQueueItem,
  LinkedInAnalytics,
} from './linkedinAPI';

export type {
  // Monitoring types
  HealthCheckResponse,
  ServiceHealth,
  ErrorLog,
  ErrorLogsResponse,
  MetricsResponse,
} from './monitoringAPI';

// Export helper functions
export {
  // Content helpers
  getStatusColor,
  getContentTypeIcon,
  formatContentType,
  truncateContent,
  estimateReadingTime,
} from './contentAPI';

export {
  // Voice helpers
  createAudioBlob,
  formatVoiceDimensions,
  getConfidenceDescription,
  formatDuration,
} from './voiceAPI';

export {
  // Workshop helpers
  WORKSHOP_STEPS,
  getStepProgress,
  isStepComplete,
} from './workshopAPI';

export {
  // News helpers
  getRelevanceColor,
  getRelevanceLabel,
  formatArticleDate,
} from './newsAPI';

export {
  // Calendar helpers
  getEventStatusColor,
  formatEventDate,
  getTimeUntilPost,
} from './calendarAPI';

export {
  // LinkedIn helpers
  formatEngagementRate,
  getEngagementScore,
  getQueueStatusColor,
  truncateLinkedInContent,
} from './linkedinAPI';

export {
  // Monitoring helpers
  getHealthStatusColor,
  getHealthStatusIcon,
  formatUptime,
  getErrorLevelColor,
  formatErrorRate,
} from './monitoringAPI';