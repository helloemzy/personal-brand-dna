import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';

// News API response types
export interface NewsSource {
  id: string;
  name: string;
  url: string;
  feedType: 'rss' | 'json';
  category: string;
  isActive: boolean;
  lastFetched?: string;
  articleCount?: number;
}

export interface NewsArticle {
  id: string;
  sourceId: string;
  title: string;
  description: string;
  content?: string;
  url: string;
  author?: string;
  publishedAt: string;
  relevanceScore?: number;
  tags?: string[];
  imageUrl?: string;
}

export interface NewsSourcesResponse {
  sources: NewsSource[];
  totalSources: number;
}

export interface NewsArticlesResponse {
  articles: NewsArticle[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface NewsInteractionRequest {
  action: 'save' | 'dismiss' | 'generate-content';
  notes?: string;
  contentPillars?: string[];
}

// News API service
export const newsAPI = {
  // Get user's news sources
  getSources: async (): Promise<AxiosResponse<NewsSourcesResponse>> => {
    return apiClient.get('/news?action=sources');
  },

  // Add a news source
  addSource: async (source: {
    name: string;
    url: string;
    feedType: 'rss' | 'json';
    category: string;
  }): Promise<AxiosResponse<{ source: NewsSource }>> => {
    return apiClient.post('/news?action=add-source', source);
  },

  // Update a news source
  updateSource: async (
    sourceId: string,
    updates: Partial<NewsSource>
  ): Promise<AxiosResponse<{ source: NewsSource }>> => {
    return apiClient.put(`/news?action=update-source&id=${sourceId}`, updates);
  },

  // Delete a news source
  deleteSource: async (sourceId: string): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.delete(`/news?action=delete-source&id=${sourceId}`);
  },

  // Get news articles
  getArticles: async (params?: {
    page?: number;
    limit?: number;
    sourceId?: string;
    minRelevance?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<AxiosResponse<NewsArticlesResponse>> => {
    const queryParams = new URLSearchParams({ action: 'articles' });
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sourceId) queryParams.append('sourceId', params.sourceId);
    if (params?.minRelevance) queryParams.append('minRelevance', params.minRelevance.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.search) queryParams.append('search', params.search);

    return apiClient.get(`/news?${queryParams.toString()}`);
  },

  // Get specific article
  getArticle: async (articleId: string): Promise<AxiosResponse<{ article: NewsArticle }>> => {
    return apiClient.get(`/news?action=article&id=${articleId}`);
  },

  // Interact with an article
  interactWithArticle: async (
    articleId: string,
    interaction: NewsInteractionRequest
  ): Promise<AxiosResponse<{ success: boolean; contentId?: string }>> => {
    return apiClient.post(`/news?action=interact&id=${articleId}`, interaction);
  },

  // Refresh news from all sources
  refreshNews: async (): Promise<AxiosResponse<{ 
    message: string; 
    articlesAdded: number;
    sourcesFetched: number;
  }>> => {
    return apiClient.post('/news?action=refresh');
  },

  // Get relevance analysis for an article
  analyzeRelevance: async (
    articleId: string
  ): Promise<AxiosResponse<{ 
    relevanceScore: number;
    matchedPillars: string[];
    explanation: string;
  }>> => {
    return apiClient.post(`/news?action=analyze&id=${articleId}`);
  },
};

// Helper functions
export const getRelevanceColor = (score: number): string => {
  if (score >= 0.8) return 'text-green-600 bg-green-100';
  if (score >= 0.6) return 'text-yellow-600 bg-yellow-100';
  if (score >= 0.4) return 'text-orange-600 bg-orange-100';
  return 'text-gray-600 bg-gray-100';
};

export const getRelevanceLabel = (score: number): string => {
  if (score >= 0.8) return 'Highly Relevant';
  if (score >= 0.6) return 'Relevant';
  if (score >= 0.4) return 'Somewhat Relevant';
  return 'Low Relevance';
};

export const formatArticleDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

export default newsAPI;