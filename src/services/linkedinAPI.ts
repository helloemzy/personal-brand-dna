import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';

// LinkedIn API response types
export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePictureUrl?: string;
  publicProfileUrl?: string;
  industry?: string;
  location?: string;
  connections?: number;
}

export interface LinkedInPost {
  id: string;
  text: string;
  publishedAt: string;
  visibility: string;
  metrics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface LinkedInAuthResponse {
  authUrl: string;
  state: string;
}

export interface LinkedInTokenResponse {
  accessToken: string;
  expiresIn: number;
  profile: LinkedInProfile;
}

export interface LinkedInQueueItem {
  id: string;
  content: string;
  scheduledFor: string;
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'failed';
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface LinkedInAnalytics {
  totalPosts: number;
  totalViews: number;
  totalEngagement: number;
  averageEngagementRate: number;
  topPosts: LinkedInPost[];
  engagementByDay: Array<{
    date: string;
    views: number;
    engagement: number;
  }>;
}

// LinkedIn API service
export const linkedinAPI = {
  // OAuth flow
  initializeAuth: async (): Promise<AxiosResponse<LinkedInAuthResponse>> => {
    return apiClient.post('/linkedin?action=auth');
  },

  // Exchange auth code for token
  exchangeToken: async (code: string, state: string): Promise<AxiosResponse<LinkedInTokenResponse>> => {
    return apiClient.post('/linkedin?action=token', { code, state });
  },

  // Get LinkedIn profile
  getProfile: async (): Promise<AxiosResponse<{ profile: LinkedInProfile }>> => {
    return apiClient.get('/linkedin?action=profile');
  },

  // Disconnect LinkedIn
  disconnect: async (): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.post('/linkedin?action=disconnect');
  },

  // Publishing queue
  getQueue: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<AxiosResponse<{
    items: LinkedInQueueItem[];
    totalItems: number;
  }>> => {
    const queryParams = new URLSearchParams({ action: 'queue' });
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return apiClient.get(`/linkedin?${queryParams.toString()}`);
  },

  // Add to queue
  addToQueue: async (data: {
    content: string;
    scheduledFor?: string;
    metadata?: Record<string, any>;
  }): Promise<AxiosResponse<{ item: LinkedInQueueItem }>> => {
    return apiClient.post('/linkedin?action=add-to-queue', data);
  },

  // Approve queue item
  approveQueueItem: async (itemId: string): Promise<AxiosResponse<{ item: LinkedInQueueItem }>> => {
    return apiClient.post(`/linkedin?action=approve&id=${itemId}`);
  },

  // Reject queue item
  rejectQueueItem: async (
    itemId: string,
    reason?: string
  ): Promise<AxiosResponse<{ item: LinkedInQueueItem }>> => {
    return apiClient.post(`/linkedin?action=reject&id=${itemId}`, { reason });
  },

  // Remove from queue
  removeFromQueue: async (itemId: string): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.delete(`/linkedin?action=remove-from-queue&id=${itemId}`);
  },

  // Get analytics
  getAnalytics: async (params?: {
    startDate?: string;
    endDate?: string;
    metric?: 'views' | 'engagement' | 'all';
  }): Promise<AxiosResponse<LinkedInAnalytics>> => {
    const queryParams = new URLSearchParams({ action: 'analytics' });
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.metric) queryParams.append('metric', params.metric);

    return apiClient.get(`/linkedin?${queryParams.toString()}`);
  },

  // Get post performance
  getPostPerformance: async (postId: string): Promise<AxiosResponse<{
    post: LinkedInPost;
    hourlyMetrics: Array<{
      hour: number;
      views: number;
      engagement: number;
    }>;
  }>> => {
    return apiClient.get(`/linkedin?action=post-performance&id=${postId}`);
  },

  // Test post (preview without publishing)
  testPost: async (content: string): Promise<AxiosResponse<{
    preview: {
      text: string;
      characterCount: number;
      hashtagCount: number;
      mentionCount: number;
      estimatedReach: number;
    };
    warnings?: string[];
  }>> => {
    return apiClient.post('/linkedin?action=test-post', { content });
  },
};

// Helper functions
export const formatEngagementRate = (rate: number): string => {
  return `${(rate * 100).toFixed(2)}%`;
};

export const getEngagementScore = (metrics: LinkedInPost['metrics']): number => {
  if (!metrics) return 0;
  const { views, likes, comments, shares } = metrics;
  if (views === 0) return 0;
  
  // Weighted engagement score
  const engagementActions = likes + (comments * 2) + (shares * 3);
  return engagementActions / views;
};

export const getQueueStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'approved':
      return 'bg-blue-100 text-blue-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'published':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const truncateLinkedInContent = (content: string, maxLength: number = 1300): string => {
  if (content.length <= maxLength) return content;
  
  // Find the last complete sentence within the limit
  const truncated = content.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > maxLength * 0.8) {
    return content.substring(0, lastSentenceEnd + 1);
  }
  
  return truncated.trim() + '...';
};

export default linkedinAPI;