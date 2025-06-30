import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';

// Content API response types
export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  contentType: string;
  useCase: string;
  industryTags: string[];
  variables: Record<string, any>;
  templateStructure: Record<string, any>;
}

export interface TemplatesResponse {
  templates: ContentTemplate[];
  templatesByUseCase: Record<string, ContentTemplate[]>;
  totalTemplates: number;
}

export interface GenerateContentRequest {
  topic: string;
  contentType?: 'post' | 'article' | 'story' | 'poll' | 'carousel';
  templateId?: string;
  voiceProfileId?: string;
  urgency?: 'low' | 'medium' | 'high';
  targetAudience?: string;
  callToAction?: string;
  includePersonalExperience?: boolean;
  tone?: 'professional' | 'casual' | 'thought-leader' | 'conversational';
}

export interface GeneratedContent {
  id: string;
  content: string;
  topic: string;
  contentType: string;
  status: 'generated' | 'edited' | 'used' | 'archived';
  generationMetadata: any;
  userEdits: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentGenerationResponse {
  contentId: string;
  content: string;
  variations: string[];
  metadata: {
    generationTime: number;
    voiceAccuracy: number;
    contentType: string;
    topic: string;
    createdAt: string;
  };
}

export interface ContentListResponse {
  content: GeneratedContent[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ContentDetailResponse {
  content: GeneratedContent & {
    templateName?: string;
    templateDescription?: string;
  };
  performance?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clickThroughRate: number;
    engagementRate: number;
  };
}

export interface ContentStatsResponse {
  overview: {
    totalContent: number;
    recentContent: number;
    usedContent: number;
    archivedContent: number;
    contentTypesUsed: number;
    editRate: number;
  };
  contentTypeBreakdown: Array<{
    contentType: string;
    count: number;
    usedCount: number;
  }>;
  timeframe: number;
}

export interface ContentFeedbackRequest {
  rating: number;
  feedbackText?: string;
  feedbackType?: 'content_quality' | 'voice_accuracy' | 'overall';
}

// Content API service
export const contentAPI = {
  // Get available content templates
  getTemplates: async (params?: {
    industry?: string;
    contentType?: string;
    useCase?: string;
  }): Promise<AxiosResponse<TemplatesResponse>> => {
    const queryParams = new URLSearchParams({ action: 'templates' });
    if (params?.industry) queryParams.append('industry', params.industry);
    if (params?.contentType) queryParams.append('contentType', params.contentType);
    if (params?.useCase) queryParams.append('useCase', params.useCase);

    return apiClient.get(`/content?${queryParams.toString()}`);
  },

  // Generate content
  generateContent: async (
    request: GenerateContentRequest
  ): Promise<AxiosResponse<ContentGenerationResponse>> => {
    return apiClient.post('/content?action=generation', request, {
      timeout: 60000, // 1 minute timeout for content generation
    });
  },

  // Get user's generated content
  getContent: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    contentType?: string;
    search?: string;
  }): Promise<AxiosResponse<ContentListResponse>> => {
    const queryParams = new URLSearchParams({ action: 'history' });
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.contentType) queryParams.append('contentType', params.contentType);
    if (params?.search) queryParams.append('search', params.search);

    return apiClient.get(`/content?${queryParams.toString()}`);
  },

  // Get specific content item
  getContentById: async (contentId: string): Promise<AxiosResponse<ContentDetailResponse>> => {
    return apiClient.get(`/content?action=detail&id=${contentId}`);
  },

  // Update content
  updateContent: async (
    contentId: string,
    updates: {
      content: string;
      status?: 'generated' | 'edited' | 'used' | 'archived';
    }
  ): Promise<AxiosResponse<{ content: GeneratedContent }>> => {
    return apiClient.put(`/content?action=update&id=${contentId}`, updates);
  },

  // Delete content
  deleteContent: async (contentId: string): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.delete(`/content?action=delete&id=${contentId}`);
  },

  // Submit feedback on generated content
  submitFeedback: async (
    contentId: string,
    feedback: ContentFeedbackRequest
  ): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.post(`/content?action=feedback&id=${contentId}`, feedback);
  },

  // Get content statistics
  getStats: async (params?: {
    timeframe?: number;
  }): Promise<AxiosResponse<ContentStatsResponse>> => {
    const queryParams = new URLSearchParams({ action: 'stats' });
    if (params?.timeframe) queryParams.append('timeframe', params.timeframe.toString());

    return apiClient.get(`/content?${queryParams.toString()}`);
  },
};

// Helper functions for content management
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'generated':
      return 'bg-blue-100 text-blue-800';
    case 'edited':
      return 'bg-yellow-100 text-yellow-800';
    case 'used':
      return 'bg-green-100 text-green-800';
    case 'archived':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getContentTypeIcon = (contentType: string): string => {
  switch (contentType) {
    case 'post':
      return '📝';
    case 'article':
      return '📰';
    case 'story':
      return '📖';
    case 'poll':
      return '📊';
    case 'carousel':
      return '🎠';
    default:
      return '📝';
  }
};

export const formatContentType = (contentType: string): string => {
  switch (contentType) {
    case 'post':
      return 'LinkedIn Post';
    case 'article':
      return 'LinkedIn Article';
    case 'story':
      return 'Story Post';
    case 'poll':
      return 'Poll Post';
    case 'carousel':
      return 'Carousel Post';
    default:
      return contentType;
  }
};

export const truncateContent = (content: string, maxLength: number = 150): string => {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
};

export const estimateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

export default contentAPI;