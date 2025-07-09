import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';

// LinkedIn API response types
export interface LinkedInAuthResponse {
  authUrl: string;
  state: string;
}

export interface LinkedInStatus {
  connected: boolean;
  linkedinId?: string;
  expiresAt?: string;
  connectedAt?: string;
}

export interface LinkedInCallbackRequest {
  code: string;
  state: string;
  userId: string;
}

export interface LinkedInCallbackResponse {
  message: string;
  linkedinId: string;
}

export interface QueuePostRequest {
  contentId: string;
  scheduledFor?: string;
  autoPublish?: boolean;
}

export interface QueuePostResponse {
  queueId: string;
  status: string;
  scheduledFor: string;
}

export interface PublishPostRequest {
  contentId: string;
}

export interface PublishPostResponse {
  message: string;
  linkedinPostId: string;
}

export interface LinkedInQueueItem {
  id: string;
  contentId: string;
  status: 'pending' | 'published' | 'failed' | 'cancelled';
  scheduledFor: string;
  publishedAt?: string;
  errorMessage?: string;
  linkedinPostId?: string;
  autoPublish: boolean;
  createdAt: string;
}

export interface LinkedInQueueResponse {
  queue: LinkedInQueueItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// LinkedIn API service
export const linkedinAPI = {
  // Start LinkedIn OAuth flow
  startAuth: async (): Promise<AxiosResponse<LinkedInAuthResponse>> => {
    return apiClient.get('/linkedin?action=auth');
  },

  // Handle OAuth callback
  handleCallback: async (
    request: LinkedInCallbackRequest
  ): Promise<AxiosResponse<LinkedInCallbackResponse>> => {
    return apiClient.post('/linkedin?action=callback', request);
  },

  // Get LinkedIn connection status
  getStatus: async (): Promise<AxiosResponse<LinkedInStatus>> => {
    return apiClient.get('/linkedin?action=status');
  },

  // Disconnect LinkedIn account
  disconnect: async (): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.post('/linkedin?action=disconnect');
  },

  // Queue a post for publishing
  queuePost: async (
    request: QueuePostRequest
  ): Promise<AxiosResponse<QueuePostResponse>> => {
    return apiClient.post('/linkedin?action=queue', request);
  },

  // Publish a post immediately
  publishNow: async (
    request: PublishPostRequest
  ): Promise<AxiosResponse<PublishPostResponse>> => {
    return apiClient.post('/linkedin?action=publish', request);
  },

  // Get queued posts
  getQueue: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<AxiosResponse<LinkedInQueueResponse>> => {
    const queryParams = new URLSearchParams();
    queryParams.append('action', 'queue-list');
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);

    return apiClient.get(`/linkedin?${queryParams.toString()}`);
  },

  // Cancel a queued post
  cancelQueuedPost: async (
    queueId: string
  ): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.delete(`/linkedin?action=cancel-queue&id=${queueId}`);
  },

  // Update queue item schedule
  updateQueueSchedule: async (
    queueId: string,
    scheduledFor: string
  ): Promise<AxiosResponse<{ message: string; updatedItem: LinkedInQueueItem }>> => {
    return apiClient.put(`/linkedin?action=update-queue&id=${queueId}`, {
      scheduledFor
    });
  },

  // Get LinkedIn post analytics
  getPostAnalytics: async (
    linkedinPostId: string
  ): Promise<AxiosResponse<{
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    engagementRate: number;
    fetchedAt: string;
  }>> => {
    return apiClient.get(`/linkedin?action=analytics&postId=${linkedinPostId}`);
  },

  // Bulk queue posts
  bulkQueuePosts: async (
    contentIds: string[],
    scheduleOptions: {
      startDate: string;
      timeSlots: string[];
      weekdaysOnly?: boolean;
    }
  ): Promise<AxiosResponse<{
    queued: number;
    failed: number;
    queueIds: string[];
    errors?: Array<{ contentId: string; error: string }>;
  }>> => {
    return apiClient.post('/linkedin?action=bulk-queue', {
      contentIds,
      scheduleOptions
    });
  },

  // Get publishing preferences
  getPreferences: async (): Promise<AxiosResponse<{
    autoApprove: boolean;
    notifyOnPublish: boolean;
    notifyOnEngagement: boolean;
    defaultScheduleTime: string;
    weekendPosting: boolean;
    maxPostsPerDay: number;
    optimalPostingTimes: string[];
  }>> => {
    return apiClient.get('/linkedin?action=preferences');
  },

  // Update publishing preferences
  updatePreferences: async (preferences: {
    autoApprove?: boolean;
    notifyOnPublish?: boolean;
    notifyOnEngagement?: boolean;
    defaultScheduleTime?: string;
    weekendPosting?: boolean;
    maxPostsPerDay?: number;
  }): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.put('/linkedin?action=preferences', preferences);
  },

  // Export LinkedIn data
  exportData: async (): Promise<AxiosResponse<Blob>> => {
    return apiClient.get('/linkedin?action=export', {
      responseType: 'blob'
    });
  },

  // Delete all LinkedIn data
  deleteAllData: async (): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.delete('/linkedin?action=delete-all');
  },

  // Get compliance data
  getCompliance: async (): Promise<AxiosResponse<{
    totalActions: number;
    postsPublished: number;
    postsRejected: number;
    privacyActions: number;
    lastActionAt: string;
  }>> => {
    return apiClient.get('/linkedin?action=compliance');
  }
};

// Helper functions
export const getLinkedInPostUrl = (linkedinPostId: string): string => {
  // LinkedIn post URLs follow this pattern
  return `https://www.linkedin.com/feed/update/${linkedinPostId}/`;
};

export const formatScheduleDate = (date: Date): string => {
  return date.toISOString();
};

export const isTokenExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt) < new Date();
};

export const getOptimalPostingTimes = (timezone: string = 'America/New_York'): string[] => {
  // Based on LinkedIn best practices
  return [
    '08:00', // Morning commute
    '12:00', // Lunch break
    '17:00', // End of workday
    '19:00'  // Evening browsing
  ];
};

export const validatePostContent = (content: string): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // LinkedIn character limit is 3000
  if (content.length > 3000) {
    errors.push(`Content is ${content.length - 3000} characters over the limit`);
  }
  
  // Check for minimum content
  if (content.trim().length < 10) {
    errors.push('Content is too short');
  }
  
  // Check for excessive hashtags (LinkedIn recommends 3-5)
  const hashtagCount = (content.match(/#\w+/g) || []).length;
  if (hashtagCount > 10) {
    errors.push('Too many hashtags (recommended: 3-5)');
  }
  
  // Check for excessive mentions
  const mentionCount = (content.match(/@\w+/g) || []).length;
  if (mentionCount > 10) {
    errors.push('Too many mentions');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

export default linkedinAPI;