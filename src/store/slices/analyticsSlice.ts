import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AnalyticsMetric {
  name: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  period: string;
}

export interface ContentPerformance {
  contentId: string;
  title: string;
  type: string;
  publishedAt: string;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
    clickThroughRate?: number;
  };
  voiceAccuracy: number;
}

export interface EngagementTrend {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
}

export interface AudienceInsight {
  metric: string;
  value: string | number;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

export interface AnalyticsState {
  overview: {
    totalContent: number;
    totalViews: number;
    totalEngagements: number;
    avgEngagementRate: number;
    careerOpportunities: number;
  };
  metrics: AnalyticsMetric[];
  contentPerformance: ContentPerformance[];
  engagementTrends: EngagementTrend[];
  audienceInsights: AudienceInsight[];
  recommendations: string[];
  dateRange: {
    start: string;
    end: string;
  };
  isLoading: boolean;
  error: string | null;
}

const initialState: AnalyticsState = {
  overview: {
    totalContent: 0,
    totalViews: 0,
    totalEngagements: 0,
    avgEngagementRate: 0,
    careerOpportunities: 0,
  },
  metrics: [],
  contentPerformance: [],
  engagementTrends: [],
  audienceInsights: [],
  recommendations: [],
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    end: new Date().toISOString(),
  },
  isLoading: false,
  error: null,
};

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setAnalyticsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setAnalyticsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    updateOverview: (state, action: PayloadAction<Partial<AnalyticsState['overview']>>) => {
      state.overview = { ...state.overview, ...action.payload };
    },
    
    setMetrics: (state, action: PayloadAction<AnalyticsMetric[]>) => {
      state.metrics = action.payload;
    },
    
    setContentPerformance: (state, action: PayloadAction<ContentPerformance[]>) => {
      state.contentPerformance = action.payload;
    },
    
    setEngagementTrends: (state, action: PayloadAction<EngagementTrend[]>) => {
      state.engagementTrends = action.payload;
    },
    
    setAudienceInsights: (state, action: PayloadAction<AudienceInsight[]>) => {
      state.audienceInsights = action.payload;
    },
    
    setRecommendations: (state, action: PayloadAction<string[]>) => {
      state.recommendations = action.payload;
    },
    
    setDateRange: (state, action: PayloadAction<{ start: string; end: string }>) => {
      state.dateRange = action.payload;
    },
    
    updateContentMetrics: (state, action: PayloadAction<{
      contentId: string;
      metrics: Partial<ContentPerformance['metrics']>;
    }>) => {
      const content = state.contentPerformance.find(c => c.contentId === action.payload.contentId);
      if (content) {
        content.metrics = { ...content.metrics, ...action.payload.metrics };
      }
    },
    
    addEngagementDataPoint: (state, action: PayloadAction<EngagementTrend>) => {
      const existingIndex = state.engagementTrends.findIndex(
        trend => trend.date === action.payload.date
      );
      
      if (existingIndex !== -1) {
        state.engagementTrends[existingIndex] = action.payload;
      } else {
        state.engagementTrends.push(action.payload);
        // Keep only last 90 days
        state.engagementTrends = state.engagementTrends
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 90);
      }
    },
    
    clearAnalytics: () => {
      return initialState;
    },
  },
});

export const {
  setAnalyticsLoading,
  setAnalyticsError,
  updateOverview,
  setMetrics,
  setContentPerformance,
  setEngagementTrends,
  setAudienceInsights,
  setRecommendations,
  setDateRange,
  updateContentMetrics,
  addEngagementDataPoint,
  clearAnalytics,
} = analyticsSlice.actions;

// Selectors
export const selectAnalyticsOverview = (state: { analytics: AnalyticsState }) => state.analytics.overview;
export const selectAnalyticsMetrics = (state: { analytics: AnalyticsState }) => state.analytics.metrics;
export const selectContentPerformance = (state: { analytics: AnalyticsState }) => state.analytics.contentPerformance;
export const selectEngagementTrends = (state: { analytics: AnalyticsState }) => state.analytics.engagementTrends;
export const selectAudienceInsights = (state: { analytics: AnalyticsState }) => state.analytics.audienceInsights;
export const selectAnalyticsRecommendations = (state: { analytics: AnalyticsState }) => state.analytics.recommendations;
export const selectAnalyticsDateRange = (state: { analytics: AnalyticsState }) => state.analytics.dateRange;
export const selectAnalyticsLoading = (state: { analytics: AnalyticsState }) => state.analytics.isLoading;
export const selectAnalyticsError = (state: { analytics: AnalyticsState }) => state.analytics.error;

export default analyticsSlice.reducer;