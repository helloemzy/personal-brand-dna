/**
 * Optimized selectors using reselect for memoization
 * These selectors prevent unnecessary re-renders by memoizing computed values
 */

import { createSelector } from 'reselect';
import { RootState } from '../index';

// Base selectors
const selectAuth = (state: RootState) => state.auth;
const selectWorkshop = (state: RootState) => state.workshop;
const selectContent = (state: RootState) => state.content;
const selectNews = (state: RootState) => state.news;
const selectAnalytics = (state: RootState) => state.analytics;
const selectVoice = (state: RootState) => state.voice;

// Auth selectors
export const selectIsAuthenticated = createSelector(
  [selectAuth],
  (auth) => auth.isAuthenticated
);

export const selectUser = createSelector(
  [selectAuth],
  (auth) => auth.user
);

export const selectUserSubscriptionTier = createSelector(
  [selectUser],
  (user) => user?.subscriptionTier || 'free'
);

// Workshop selectors
export const selectWorkshopProgress = createSelector(
  [selectWorkshop],
  (workshop) => {
    const totalSteps = 5;
    const completedSteps = workshop.completedSteps.length;
    return Math.round((completedSteps / totalSteps) * 100);
  }
);

export const selectWorkshopValues = createSelector(
  [selectWorkshop],
  (workshop) => workshop.values
);

export const selectSelectedValues = createSelector(
  [selectWorkshopValues],
  (values) => values.selected
);

export const selectTopValues = createSelector(
  [selectWorkshopValues],
  (values) => {
    const { selected, rankings } = values;
    return selected
      .filter((id: string) => rankings[id] && rankings[id] <= 5)
      .sort((a: string, b: string) => (rankings[a] || 999) - (rankings[b] || 999))
      .slice(0, 5);
  }
);

// Content selectors
export const selectContentDrafts = createSelector(
  [selectContent],
  (content) => content.drafts || []
);

export const selectContentHistory = createSelector(
  [selectContent],
  (content) => content.history || []
);

export const selectContentStats = createSelector(
  [selectContentHistory],
  (history) => {
    const total = history.length;
    const published = history.filter((item: any) => item.status === 'published').length;
    const draft = history.filter((item: any) => item.status === 'draft').length;
    const scheduled = history.filter((item: any) => item.status === 'scheduled').length;

    return {
      total,
      published,
      draft,
      scheduled,
      publishRate: total > 0 ? Math.round((published / total) * 100) : 0,
    };
  }
);

// News selectors
export const selectNewsArticles = createSelector(
  [selectNews],
  (news) => news.articles || []
);

export const selectFeaturedArticles = createSelector(
  [selectNewsArticles],
  (articles) => articles.filter((article: any) => article.isFeatured)
);

export const selectSavedArticles = createSelector(
  [selectNewsArticles],
  (articles) => articles.filter((article: any) => article.userInteraction === 'save')
);

export const selectNewsStats = createSelector(
  [selectNewsArticles],
  (articles) => ({
    total: articles.length,
    featured: articles.filter((a: any) => a.isFeatured).length,
    saved: articles.filter((a: any) => a.userInteraction === 'save').length,
    dismissed: articles.filter((a: any) => a.userInteraction === 'dismiss').length,
    avgRelevance: articles.length > 0
      ? articles.reduce((sum: number, a: any) => sum + (a.relevanceScore || 0), 0) / articles.length
      : 0,
  })
);

// Analytics selectors
export const selectAnalyticsMetrics = createSelector(
  [selectAnalytics],
  (analytics) => analytics.metrics || {}
);

export const selectEngagementTrends = createSelector(
  [selectAnalyticsMetrics],
  (metrics) => {
    // Calculate engagement trends from metrics
    const trends = {
      views: metrics.totalViews || 0,
      likes: metrics.totalLikes || 0,
      comments: metrics.totalComments || 0,
      shares: metrics.totalShares || 0,
      engagementRate: 0,
    };

    if (trends.views > 0) {
      trends.engagementRate = 
        ((trends.likes + trends.comments + trends.shares) / trends.views) * 100;
    }

    return trends;
  }
);

// Voice selectors
export const selectVoiceProfile = createSelector(
  [selectVoice],
  (voice) => voice.voiceProfile
);

export const selectVoiceSignature = createSelector(
  [selectVoiceProfile],
  (profile) => profile?.signature || null
);

export const selectVoiceConfidence = createSelector(
  [selectVoiceProfile],
  (profile) => profile?.confidenceScore || 0
);

export const selectTopVoiceDimensions = createSelector(
  [selectVoiceSignature],
  (signature) => {
    if (!signature) return [];

    return Object.entries(signature)
      .map(([key, value]) => ({ dimension: key, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }
);

// Combined selectors
export const selectUserDashboardData = createSelector(
  [selectUser, selectContentStats, selectNewsStats, selectEngagementTrends, selectVoiceProfile],
  (user, contentStats, newsStats, engagement, voiceProfile) => ({
    user,
    content: contentStats,
    news: newsStats,
    engagement,
    hasVoiceProfile: !!voiceProfile,
  })
);

export const selectWorkshopReadiness = createSelector(
  [selectUser, selectVoiceProfile, selectWorkshopProgress],
  (user, voiceProfile, progress) => ({
    isAuthenticated: !!user,
    hasExistingVoiceProfile: !!voiceProfile,
    workshopProgress: progress,
    canStartWorkshop: !!user && (!voiceProfile || progress < 100),
  })
);

// Performance-optimized list selectors
export const selectPaginatedContentHistory = createSelector(
  [selectContentHistory, (_state: RootState, page: number) => page, (_state: RootState, pageSize: number) => pageSize],
  (history, page, pageSize) => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      items: history.slice(start, end),
      totalItems: history.length,
      totalPages: Math.ceil(history.length / pageSize),
      currentPage: page,
    };
  }
);

export const selectFilteredNewsArticles = createSelector(
  [selectNewsArticles, (_state: RootState, filter: string) => filter, (_state: RootState, minRelevance: number) => minRelevance],
  (articles, filter, minRelevance) => {
    let filtered = articles;

    // Apply relevance filter
    if (minRelevance > 0) {
      filtered = filtered.filter((article: any) => (article.relevanceScore || 0) >= minRelevance);
    }

    // Apply category filter
    if (filter && filter !== 'all') {
      switch (filter) {
        case 'featured':
          filtered = filtered.filter((article: any) => article.isFeatured);
          break;
        case 'saved':
          filtered = filtered.filter((article: any) => article.userInteraction === 'save');
          break;
        default:
          break;
      }
    }

    return filtered;
  }
);