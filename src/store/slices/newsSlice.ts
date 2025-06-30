import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../services';

// Types
export interface NewsArticle {
  id: string;
  sourceId: string;
  externalId: string;
  title: string;
  summary: string;
  content?: string;
  author?: string;
  publishedAt: string;
  articleUrl: string;
  imageUrl?: string;
  categories: string[];
  tags: string[];
  sourceName: string;
  sourceCategory?: string;
  relevanceScore?: number;
  contentPillarMatches?: string[];
  audienceMatchScore?: number;
  toneMatchScore?: number;
  topicSimilarityScore?: number;
  isFeatured?: boolean;
  userInteraction?: string;
  createdAt: string;
}

export interface NewsSource {
  id: string;
  userId: string;
  name: string;
  feedUrl: string;
  feedType: 'rss' | 'atom' | 'json';
  category?: string;
  isActive: boolean;
  lastFetchedAt?: string;
  fetchFrequencyMinutes: number;
  errorCount: number;
  lastError?: string;
  metadata: Record<string, any>;
  totalArticles?: number;
  latestArticleDate?: string;
  lastFetchStatus?: string;
  lastFetchDate?: string;
}

export interface ContentIdea {
  id: string;
  userId: string;
  articleId?: string;
  ideaType: 'response' | 'perspective' | 'analysis' | 'story' | 'tips';
  headline: string;
  hook: string;
  outline: any;
  keyPoints: string[];
  targetAudience: string;
  estimatedWordCount: number;
  contentFormat: 'post' | 'article' | 'carousel' | 'video_script';
  status: 'suggested' | 'saved' | 'drafted' | 'published' | 'dismissed';
  aiConfidenceScore: number;
  articleTitle?: string;
  articleUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPreferences {
  keywords: string[];
  excludedKeywords: string[];
  preferredSources: string[];
  minimumRelevanceScore: number;
  notificationFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'never';
  ideaGenerationEnabled: boolean;
  autoSaveHighRelevance: boolean;
  relevanceThresholdForAutoSave: number;
}

interface NewsState {
  // Articles
  articles: NewsArticle[];
  articlesLoading: boolean;
  articlesError: string | null;
  articlesPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
  // Sources
  sources: NewsSource[];
  sourcesLoading: boolean;
  sourcesError: string | null;
  
  // Ideas
  ideas: ContentIdea[];
  ideasLoading: boolean;
  ideasError: string | null;
  ideasPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
  // Preferences
  preferences: NewsPreferences | null;
  preferencesLoading: boolean;
  
  // Filters
  filters: {
    minRelevance: number;
    sourceId?: string;
    category?: string;
    featured?: boolean;
  };
}

const initialState: NewsState = {
  articles: [],
  articlesLoading: false,
  articlesError: null,
  articlesPagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  },
  sources: [],
  sourcesLoading: false,
  sourcesError: null,
  ideas: [],
  ideasLoading: false,
  ideasError: null,
  ideasPagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  },
  preferences: null,
  preferencesLoading: false,
  filters: {
    minRelevance: 0.5
  }
};

// Async thunks
export const fetchArticles = createAsyncThunk(
  'news/fetchArticles',
  async (params: { page?: number; filters?: NewsState['filters'] }) => {
    const { page = 1, filters = {} } = params;
    const response = await apiClient.get('/news/articles', {
      params: { page, limit: 20, ...filters }
    });
    return response.data;
  }
);

export const fetchSources = createAsyncThunk(
  'news/fetchSources',
  async () => {
    const response = await apiClient.get('/news/sources');
    return response.data;
  }
);

export const addSource = createAsyncThunk(
  'news/addSource',
  async (source: { name: string; feedUrl: string; feedType?: string; category?: string }) => {
    const response = await apiClient.post('/news/sources', source);
    return response.data;
  }
);

export const deleteSource = createAsyncThunk(
  'news/deleteSource',
  async (sourceId: string) => {
    await apiClient.delete(`/news/sources/${sourceId}`);
    return sourceId;
  }
);

export const saveArticleInteraction = createAsyncThunk(
  'news/saveArticleInteraction',
  async ({ articleId, interactionType, interactionData = {} }: {
    articleId: string;
    interactionType: 'view' | 'save' | 'dismiss' | 'use_idea' | 'share';
    interactionData?: any;
  }) => {
    await apiClient.post(`/news/articles/${articleId}/interact`, {
      interactionType,
      interactionData
    });
    return { articleId, interactionType };
  }
);

export const generateIdeas = createAsyncThunk(
  'news/generateIdeas',
  async (articleId: string) => {
    const response = await apiClient.post(`/news/articles/${articleId}/generate-ideas`);
    return response.data;
  }
);

export const fetchIdeas = createAsyncThunk(
  'news/fetchIdeas',
  async (params: { page?: number; status?: string }) => {
    const { page = 1, status = 'suggested' } = params;
    const response = await apiClient.get('/news/ideas', {
      params: { page, limit: 20, status }
    });
    return response.data;
  }
);

export const updateIdeaStatus = createAsyncThunk(
  'news/updateIdeaStatus',
  async ({ ideaId, status }: { ideaId: string; status: ContentIdea['status'] }) => {
    const response = await apiClient.patch(`/news/ideas/${ideaId}`, { status });
    return response.data;
  }
);

export const fetchPreferences = createAsyncThunk(
  'news/fetchPreferences',
  async () => {
    const response = await apiClient.get('/news/preferences');
    return response.data;
  }
);

export const updatePreferences = createAsyncThunk(
  'news/updatePreferences',
  async (preferences: Partial<NewsPreferences>) => {
    const response = await apiClient.put('/news/preferences', preferences);
    return response.data;
  }
);

export const discoverFeeds = createAsyncThunk(
  'news/discoverFeeds',
  async (websiteUrl: string) => {
    const response = await apiClient.post('/news/discover', { websiteUrl });
    return response.data;
  }
);

// Slice
const newsSlice = createSlice({
  name: 'news',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<NewsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearArticles: (state) => {
      state.articles = [];
      state.articlesPagination = initialState.articlesPagination;
    },
    clearIdeas: (state) => {
      state.ideas = [];
      state.ideasPagination = initialState.ideasPagination;
    }
  },
  extraReducers: (builder) => {
    // Fetch articles
    builder
      .addCase(fetchArticles.pending, (state) => {
        state.articlesLoading = true;
        state.articlesError = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        state.articlesLoading = false;
        state.articles = action.payload.articles;
        state.articlesPagination = action.payload.pagination;
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.articlesLoading = false;
        state.articlesError = action.error.message || 'Failed to fetch articles';
      });
    
    // Fetch sources
    builder
      .addCase(fetchSources.pending, (state) => {
        state.sourcesLoading = true;
        state.sourcesError = null;
      })
      .addCase(fetchSources.fulfilled, (state, action) => {
        state.sourcesLoading = false;
        state.sources = action.payload.sources;
      })
      .addCase(fetchSources.rejected, (state, action) => {
        state.sourcesLoading = false;
        state.sourcesError = action.error.message || 'Failed to fetch sources';
      });
    
    // Add source
    builder
      .addCase(addSource.fulfilled, (state, action) => {
        state.sources.push(action.payload.source);
      });
    
    // Delete source
    builder
      .addCase(deleteSource.fulfilled, (state, action) => {
        state.sources = state.sources.filter(s => s.id !== action.payload);
      });
    
    // Article interactions
    builder
      .addCase(saveArticleInteraction.fulfilled, (state, action) => {
        const { articleId, interactionType } = action.payload;
        const article = state.articles.find(a => a.id === articleId);
        if (article) {
          article.userInteraction = interactionType;
        }
      });
    
    // Generate ideas
    builder
      .addCase(generateIdeas.pending, (state) => {
        state.ideasLoading = true;
      })
      .addCase(generateIdeas.fulfilled, (state, action) => {
        state.ideasLoading = false;
        state.ideas.push(...action.payload.ideas);
      })
      .addCase(generateIdeas.rejected, (state, action) => {
        state.ideasLoading = false;
        state.ideasError = action.error.message || 'Failed to generate ideas';
      });
    
    // Fetch ideas
    builder
      .addCase(fetchIdeas.pending, (state) => {
        state.ideasLoading = true;
        state.ideasError = null;
      })
      .addCase(fetchIdeas.fulfilled, (state, action) => {
        state.ideasLoading = false;
        state.ideas = action.payload.ideas;
        state.ideasPagination = action.payload.pagination;
      })
      .addCase(fetchIdeas.rejected, (state, action) => {
        state.ideasLoading = false;
        state.ideasError = action.error.message || 'Failed to fetch ideas';
      });
    
    // Update idea status
    builder
      .addCase(updateIdeaStatus.fulfilled, (state, action) => {
        const idea = state.ideas.find(i => i.id === action.payload.idea.id);
        if (idea) {
          idea.status = action.payload.idea.status;
        }
      });
    
    // Preferences
    builder
      .addCase(fetchPreferences.pending, (state) => {
        state.preferencesLoading = true;
      })
      .addCase(fetchPreferences.fulfilled, (state, action) => {
        state.preferencesLoading = false;
        state.preferences = action.payload.preferences;
      })
      .addCase(fetchPreferences.rejected, (state) => {
        state.preferencesLoading = false;
      });
    
    builder
      .addCase(updatePreferences.fulfilled, (state, action) => {
        state.preferences = action.payload.preferences;
      });
  }
});

// Actions
export const { setFilters, clearArticles, clearIdeas } = newsSlice.actions;

// Selectors
type StateWithNews = { news: NewsState };
export const selectNewsState = (state: StateWithNews) => state.news;
export const selectArticles = (state: StateWithNews) => state.news.articles;
export const selectSources = (state: StateWithNews) => state.news.sources;
export const selectIdeas = (state: StateWithNews) => state.news.ideas;
export const selectPreferences = (state: StateWithNews) => state.news.preferences;
export const selectFilters = (state: StateWithNews) => state.news.filters;

// Reducer
export default newsSlice.reducer;