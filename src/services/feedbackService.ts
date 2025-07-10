import { supabase } from './supabaseClient';

export interface FeedbackData {
  id?: string;
  userId: string;
  type: 'nps' | 'satisfaction' | 'feature' | 'bug' | 'general';
  rating?: number; // 1-10 for NPS, 1-5 for satisfaction
  feedback: string;
  context?: {
    page?: string;
    feature?: string;
    sessionId?: string;
    workshopStep?: number;
    archetype?: string;
  };
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeedbackStats {
  npsScore: number;
  satisfactionScore: number;
  totalFeedback: number;
  feedbackByType: Record<string, number>;
  averageRatings: {
    nps: number;
    satisfaction: number;
  };
  recentTrends: {
    date: string;
    nps: number;
    satisfaction: number;
    count: number;
  }[];
}

class FeedbackService {
  private readonly FEEDBACK_TABLE = 'user_feedback';
  private readonly FEEDBACK_STATS_TABLE = 'feedback_stats';

  /**
   * Submit user feedback
   */
  async submitFeedback(feedback: FeedbackData): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate feedback
      if (!feedback.userId || !feedback.type || !feedback.feedback) {
        return { success: false, error: 'Missing required feedback fields' };
      }

      // For NPS, rating should be 0-10
      if (feedback.type === 'nps' && (feedback.rating === undefined || feedback.rating < 0 || feedback.rating > 10)) {
        return { success: false, error: 'NPS rating must be between 0 and 10' };
      }

      // For satisfaction, rating should be 1-5
      if (feedback.type === 'satisfaction' && (feedback.rating === undefined || feedback.rating < 1 || feedback.rating > 5)) {
        return { success: false, error: 'Satisfaction rating must be between 1 and 5' };
      }

      const { error } = await supabase
        .from(this.FEEDBACK_TABLE)
        .insert([{
          user_id: feedback.userId,
          type: feedback.type,
          rating: feedback.rating,
          feedback: feedback.feedback,
          context: feedback.context || {},
          metadata: feedback.metadata || {},
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error submitting feedback:', error);
        return { success: false, error: error.message };
      }

      // Track analytics event
      if (window.gtag) {
        window.gtag('event', 'feedback_submitted', {
          feedback_type: feedback.type,
          rating: feedback.rating,
          has_text: feedback.feedback.length > 0,
          page: feedback.context?.page
        });
      }

      // Update cached stats (async, don't wait)
      this.updateFeedbackStats(feedback.userId).catch(console.error);

      return { success: true };
    } catch (error) {
      console.error('Error in submitFeedback:', error);
      return { success: false, error: 'Failed to submit feedback' };
    }
  }

  /**
   * Get user's feedback history
   */
  async getUserFeedback(userId: string, limit = 50): Promise<FeedbackData[]> {
    try {
      const { data, error } = await supabase
        .from(this.FEEDBACK_TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user feedback:', error);
        return [];
      }

      return this.mapFeedbackFromDb(data || []);
    } catch (error) {
      console.error('Error in getUserFeedback:', error);
      return [];
    }
  }

  /**
   * Get feedback by type
   */
  async getFeedbackByType(type: FeedbackData['type'], limit = 100): Promise<FeedbackData[]> {
    try {
      const { data, error } = await supabase
        .from(this.FEEDBACK_TABLE)
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching feedback by type:', error);
        return [];
      }

      return this.mapFeedbackFromDb(data || []);
    } catch (error) {
      console.error('Error in getFeedbackByType:', error);
      return [];
    }
  }

  /**
   * Calculate NPS score
   */
  async calculateNPS(days = 30): Promise<number> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from(this.FEEDBACK_TABLE)
        .select('rating')
        .eq('type', 'nps')
        .gte('created_at', startDate.toISOString())
        .not('rating', 'is', null);

      if (error || !data || data.length === 0) {
        return 0;
      }

      // NPS calculation: % promoters (9-10) - % detractors (0-6)
      const promoters = data.filter(f => f.rating >= 9).length;
      const detractors = data.filter(f => f.rating <= 6).length;
      const total = data.length;

      const npsScore = ((promoters - detractors) / total) * 100;
      return Math.round(npsScore);
    } catch (error) {
      console.error('Error calculating NPS:', error);
      return 0;
    }
  }

  /**
   * Calculate satisfaction score
   */
  async calculateSatisfactionScore(days = 30): Promise<number> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from(this.FEEDBACK_TABLE)
        .select('rating')
        .eq('type', 'satisfaction')
        .gte('created_at', startDate.toISOString())
        .not('rating', 'is', null);

      if (error || !data || data.length === 0) {
        return 0;
      }

      const totalRating = data.reduce((sum, f) => sum + (f.rating || 0), 0);
      const averageRating = totalRating / data.length;
      
      // Convert to percentage (1-5 scale to 0-100)
      return Math.round((averageRating - 1) * 25);
    } catch (error) {
      console.error('Error calculating satisfaction score:', error);
      return 0;
    }
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(userId?: string): Promise<FeedbackStats> {
    try {
      // Try to get cached stats first
      const cached = await this.getCachedStats(userId);
      if (cached) {
        return cached;
      }

      // Calculate fresh stats
      const npsScore = await this.calculateNPS();
      const satisfactionScore = await this.calculateSatisfactionScore();

      // Get feedback counts by type
      const { data: typeCounts } = await supabase
        .from(this.FEEDBACK_TABLE)
        .select('type')
        .eq(userId ? 'user_id' : '', userId || '');

      const feedbackByType = (typeCounts || []).reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get recent trends (last 7 days)
      const trends = await this.getRecentTrends(7);

      const stats: FeedbackStats = {
        npsScore,
        satisfactionScore,
        totalFeedback: typeCounts?.length || 0,
        feedbackByType,
        averageRatings: {
          nps: npsScore,
          satisfaction: satisfactionScore
        },
        recentTrends: trends
      };

      // Cache the stats
      await this.cacheStats(stats, userId);

      return stats;
    } catch (error) {
      console.error('Error getting feedback stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Check if user should be prompted for feedback
   */
  async shouldPromptForFeedback(userId: string, type: FeedbackData['type']): Promise<boolean> {
    try {
      // Check last feedback submission
      const { data } = await supabase
        .from(this.FEEDBACK_TABLE)
        .select('created_at')
        .eq('user_id', userId)
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!data || data.length === 0) {
        return true; // Never given feedback of this type
      }

      const lastFeedback = new Date(data[0].created_at);
      const daysSinceLastFeedback = (Date.now() - lastFeedback.getTime()) / (1000 * 60 * 60 * 24);

      // Prompt rules by type
      switch (type) {
        case 'nps':
          return daysSinceLastFeedback > 30; // Monthly NPS
        case 'satisfaction':
          return daysSinceLastFeedback > 7; // Weekly satisfaction
        case 'feature':
          return daysSinceLastFeedback > 3; // Feature feedback every 3 days
        default:
          return true; // Always allow general/bug feedback
      }
    } catch (error) {
      console.error('Error checking feedback prompt:', error);
      return false;
    }
  }

  /**
   * Get feedback prompts for specific contexts
   */
  getFeedbackPrompts(context: string): { title: string; questions: string[] } {
    const prompts: Record<string, { title: string; questions: string[] }> = {
      workshop_complete: {
        title: 'How was your Brand House experience?',
        questions: [
          'How satisfied are you with your Brand House results?',
          'Did the workshop help clarify your personal brand?',
          'What could we improve about the workshop experience?'
        ]
      },
      content_generated: {
        title: 'How\'s your content working?',
        questions: [
          'How well does the generated content match your voice?',
          'Are you seeing engagement from your content?',
          'What types of content would you like to see more of?'
        ]
      },
      first_week: {
        title: 'How\'s your first week going?',
        questions: [
          'How likely are you to recommend BrandPillar AI to a colleague?',
          'What\'s been most valuable so far?',
          'What challenges have you encountered?'
        ]
      },
      monthly_checkin: {
        title: 'Monthly check-in',
        questions: [
          'How satisfied are you with BrandPillar AI overall?',
          'What impact has it had on your LinkedIn presence?',
          'What features would you like to see added?'
        ]
      }
    };

    return prompts[context] || {
      title: 'We\'d love your feedback',
      questions: ['How can we improve your experience?']
    };
  }

  // Private helper methods

  private mapFeedbackFromDb(dbRecords: any[]): FeedbackData[] {
    return dbRecords.map(record => ({
      id: record.id,
      userId: record.user_id,
      type: record.type,
      rating: record.rating,
      feedback: record.feedback,
      context: record.context,
      metadata: record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    }));
  }

  private async getRecentTrends(days: number): Promise<FeedbackStats['recentTrends']> {
    try {
      const trends: FeedbackStats['recentTrends'] = [];
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const { data: npsData } = await supabase
          .from(this.FEEDBACK_TABLE)
          .select('rating')
          .eq('type', 'nps')
          .gte('created_at', `${dateStr}T00:00:00`)
          .lt('created_at', `${dateStr}T23:59:59`);

        const { data: satData } = await supabase
          .from(this.FEEDBACK_TABLE)
          .select('rating')
          .eq('type', 'satisfaction')
          .gte('created_at', `${dateStr}T00:00:00`)
          .lt('created_at', `${dateStr}T23:59:59`);

        const npsAvg = npsData?.length ? 
          npsData.reduce((sum, f) => sum + (f.rating || 0), 0) / npsData.length : 0;
        
        const satAvg = satData?.length ?
          satData.reduce((sum, f) => sum + (f.rating || 0), 0) / satData.length : 0;

        trends.push({
          date: dateStr,
          nps: Math.round(npsAvg),
          satisfaction: Math.round(satAvg),
          count: (npsData?.length || 0) + (satData?.length || 0)
        });
      }

      return trends.reverse(); // Oldest to newest
    } catch (error) {
      console.error('Error getting trends:', error);
      return [];
    }
  }

  private async getCachedStats(userId?: string): Promise<FeedbackStats | null> {
    try {
      const cacheKey = userId ? `feedback_stats_${userId}` : 'feedback_stats_global';
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const parsed = JSON.parse(cached);
        const cacheAge = Date.now() - parsed.timestamp;
        
        // Cache for 1 hour
        if (cacheAge < 60 * 60 * 1000) {
          return parsed.data;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private async cacheStats(stats: FeedbackStats, userId?: string): Promise<void> {
    try {
      const cacheKey = userId ? `feedback_stats_${userId}` : 'feedback_stats_global';
      localStorage.setItem(cacheKey, JSON.stringify({
        data: stats,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error caching stats:', error);
    }
  }

  private async updateFeedbackStats(userId: string): Promise<void> {
    // This would be called to update aggregated stats
    // In a production system, this might trigger a background job
    try {
      await this.getFeedbackStats(userId);
    } catch (error) {
      console.error('Error updating feedback stats:', error);
    }
  }

  private getEmptyStats(): FeedbackStats {
    return {
      npsScore: 0,
      satisfactionScore: 0,
      totalFeedback: 0,
      feedbackByType: {},
      averageRatings: {
        nps: 0,
        satisfaction: 0
      },
      recentTrends: []
    };
  }
}

export const feedbackService = new FeedbackService();