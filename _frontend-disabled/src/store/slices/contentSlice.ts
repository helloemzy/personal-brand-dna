import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ContentItem {
  id: string;
  userId: string;
  type: 'professional_update' | 'industry_insight' | 'thought_leadership' | 'personal_story' | 'company_news' | 'networking';
  title: string;
  content: string;
  originalPrompt: string;
  voiceProfileId: string;
  status: 'draft' | 'published' | 'archived';
  platforms: {
    linkedin?: {
      postId?: string;
      published: boolean;
      publishedAt?: string;
      stats?: {
        views: number;
        likes: number;
        comments: number;
        shares: number;
      };
    };
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentGenerationRequest {
  type: ContentItem['type'];
  topic: string;
  additionalContext?: string;
  tone?: 'professional' | 'casual' | 'inspirational' | 'analytical';
  length?: 'short' | 'medium' | 'long';
}

export interface ContentState {
  items: ContentItem[];
  currentGeneration: {
    isGenerating: boolean;
    request: ContentGenerationRequest | null;
    progress: number;
    generatedContent: string;
  };
  filters: {
    type: string;
    status: string;
    dateRange: string;
    searchQuery: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  isLoading: boolean;
  error: string | null;
}

const initialState: ContentState = {
  items: [],
  currentGeneration: {
    isGenerating: false,
    request: null,
    progress: 0,
    generatedContent: '',
  },
  filters: {
    type: 'all',
    status: 'all',
    dateRange: 'all',
    searchQuery: '',
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },
  isLoading: false,
  error: null,
};

const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {
    startContentGeneration: (state, action: PayloadAction<ContentGenerationRequest>) => {
      state.currentGeneration.isGenerating = true;
      state.currentGeneration.request = action.payload;
      state.currentGeneration.progress = 0;
      state.currentGeneration.generatedContent = '';
      state.error = null;
    },
    
    updateGenerationProgress: (state, action: PayloadAction<number>) => {
      state.currentGeneration.progress = action.payload;
    },
    
    updateGeneratedContent: (state, action: PayloadAction<string>) => {
      state.currentGeneration.generatedContent = action.payload;
    },
    
    completeContentGeneration: (state, action: PayloadAction<ContentItem>) => {
      state.currentGeneration.isGenerating = false;
      state.currentGeneration.progress = 100;
      state.items.unshift(action.payload);
      state.pagination.total += 1;
      state.error = null;
    },
    
    setGenerationError: (state, action: PayloadAction<string>) => {
      state.currentGeneration.isGenerating = false;
      state.error = action.payload;
    },
    
    cancelGeneration: (state) => {
      state.currentGeneration.isGenerating = false;
      state.currentGeneration.request = null;
      state.currentGeneration.progress = 0;
      state.currentGeneration.generatedContent = '';
    },
    
    addContentItem: (state, action: PayloadAction<ContentItem>) => {
      state.items.unshift(action.payload);
      state.pagination.total += 1;
    },
    
    updateContentItem: (state, action: PayloadAction<{ id: string; updates: Partial<ContentItem> }>) => {
      const index = state.items.findIndex(item => item.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload.updates };
      }
    },
    
    deleteContentItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      state.pagination.total -= 1;
    },
    
    setContentItems: (state, action: PayloadAction<ContentItem[]>) => {
      state.items = action.payload;
    },
    
    setFilters: (state, action: PayloadAction<Partial<ContentState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1; // Reset to first page when filters change
    },
    
    setPagination: (state, action: PayloadAction<Partial<ContentState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    publishContent: (state, action: PayloadAction<{ 
      id: string; 
      platform: 'linkedin'; 
      postId: string;
    }>) => {
      const item = state.items.find(item => item.id === action.payload.id);
      if (item) {
        item.status = 'published';
        item.platforms[action.payload.platform] = {
          postId: action.payload.postId,
          published: true,
          publishedAt: new Date().toISOString(),
        };
      }
    },
    
    updateContentStats: (state, action: PayloadAction<{
      id: string;
      platform: 'linkedin';
      stats: ContentItem['platforms']['linkedin']['stats'];
    }>) => {
      const item = state.items.find(item => item.id === action.payload.id);
      if (item && item.platforms[action.payload.platform]) {
        item.platforms[action.payload.platform]!.stats = action.payload.stats;
      }
    },
  },
});

export const {
  startContentGeneration,
  updateGenerationProgress,
  updateGeneratedContent,
  completeContentGeneration,
  setGenerationError,
  cancelGeneration,
  addContentItem,
  updateContentItem,
  deleteContentItem,
  setContentItems,
  setFilters,
  setPagination,
  setLoading,
  setError,
  clearError,
  publishContent,
  updateContentStats,
} = contentSlice.actions;

// Selectors
export const selectContentItems = (state: { content: ContentState }) => state.content.items;
export const selectCurrentGeneration = (state: { content: ContentState }) => state.content.currentGeneration;
export const selectContentFilters = (state: { content: ContentState }) => state.content.filters;
export const selectContentPagination = (state: { content: ContentState }) => state.content.pagination;
export const selectContentLoading = (state: { content: ContentState }) => state.content.isLoading;
export const selectContentError = (state: { content: ContentState }) => state.content.error;

export default contentSlice.reducer;