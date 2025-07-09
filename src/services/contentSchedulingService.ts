import { supabase } from '../config/supabase';
import { ContentItem } from '../types/content';
import { addDays, addWeeks, startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { linkedinAPI } from './linkedinAPI';
import { contentGenerationService } from './contentGenerationService';

interface SchedulingPreferences {
  userId: string;
  postingFrequency: 'daily' | 'weekdays' | 'custom';
  postsPerDay: number;
  postsPerWeek: number;
  preferredTimes: string[]; // Array of times in HH:mm format
  excludeWeekends: boolean;
  timezone: string;
  contentDistribution: {
    expertise: number; // percentage
    experience: number;
    evolution: number;
  };
}

interface ScheduledPost {
  id: string;
  userId: string;
  contentId?: string;
  title: string;
  content: string;
  contentType: 'post' | 'article' | 'carousel' | 'video' | 'poll';
  scheduledFor: Date;
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  source: 'manual' | 'ai' | 'news' | 'template';
  linkedinQueueId?: string;
  hashtags?: string[];
  mediaUrls?: string[];
}

interface QueueItem {
  id: string;
  content: string;
  scheduledFor?: Date;
  status: string;
  metadata?: any;
}

interface OptimalTimeSlot {
  dayOfWeek: number;
  time: string;
  engagementScore: number;
  available: boolean;
}

class ContentSchedulingService {
  /**
   * Get user's scheduling preferences
   */
  async getSchedulingPreferences(userId: string): Promise<SchedulingPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('scheduling_preferences')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      return data?.scheduling_preferences || this.getDefaultPreferences(userId);
    } catch (error) {
      console.error('Error fetching scheduling preferences:', error);
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Save user's scheduling preferences
   */
  async saveSchedulingPreferences(preferences: SchedulingPreferences): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: preferences.userId,
          scheduling_preferences: preferences,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving scheduling preferences:', error);
      throw error;
    }
  }

  /**
   * Get default scheduling preferences
   */
  private getDefaultPreferences(userId: string): SchedulingPreferences {
    return {
      userId,
      postingFrequency: 'weekdays',
      postsPerDay: 1,
      postsPerWeek: 5,
      preferredTimes: ['09:00', '12:00', '17:00'],
      excludeWeekends: true,
      timezone: 'America/New_York',
      contentDistribution: {
        expertise: 40,
        experience: 35,
        evolution: 25
      }
    };
  }

  /**
   * Get optimal posting times based on analytics
   */
  async getOptimalTimes(userId: string, date: Date): Promise<OptimalTimeSlot[]> {
    try {
      // Get historical performance data
      const { data: slots, error } = await supabase
        .from('content_slots')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('avg_engagement_rate', { ascending: false });

      if (error) throw error;

      if (!slots || slots.length === 0) {
        // Return default optimal times if no data
        return this.getDefaultOptimalTimes(date);
      }

      // Check which slots are already taken
      const dayOfWeek = date.getDay();
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data: scheduled } = await supabase
        .from('calendar_events')
        .select('scheduled_for')
        .eq('user_id', userId)
        .gte('scheduled_for', `${dateStr}T00:00:00`)
        .lte('scheduled_for', `${dateStr}T23:59:59`);

      const takenTimes = new Set(
        scheduled?.map(s => format(parseISO(s.scheduled_for), 'HH:mm')) || []
      );

      return slots
        .filter(slot => slot.day_of_week === dayOfWeek)
        .map(slot => ({
          dayOfWeek: slot.day_of_week,
          time: slot.time_slot,
          engagementScore: slot.avg_engagement_rate || 0,
          available: !takenTimes.has(slot.time_slot)
        }));
    } catch (error) {
      console.error('Error fetching optimal times:', error);
      return this.getDefaultOptimalTimes(date);
    }
  }

  /**
   * Get default optimal posting times
   */
  private getDefaultOptimalTimes(date: Date): OptimalTimeSlot[] {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const weekdayTimes = [
      { time: '08:00', score: 0.7 },
      { time: '12:00', score: 0.9 },
      { time: '17:00', score: 0.8 },
      { time: '19:00', score: 0.6 }
    ];
    
    const weekendTimes = [
      { time: '10:00', score: 0.6 },
      { time: '14:00', score: 0.7 },
      { time: '18:00', score: 0.5 }
    ];

    const times = isWeekend ? weekendTimes : weekdayTimes;
    
    return times.map(t => ({
      dayOfWeek,
      time: t.time,
      engagementScore: t.score,
      available: true
    }));
  }

  /**
   * Schedule a single post
   */
  async schedulePost(post: Partial<ScheduledPost>): Promise<ScheduledPost> {
    try {
      // Create calendar event
      const { data: event, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          user_id: post.userId,
          title: post.title || 'Scheduled Post',
          content_body: post.content,
          content_type: post.contentType || 'post',
          status: 'scheduled',
          scheduled_for: post.scheduledFor,
          hashtags: post.hashtags || [],
          media_urls: post.mediaUrls || [],
          source_type: post.source || 'manual'
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // If LinkedIn integration is enabled, add to LinkedIn queue
      if (post.userId) {
        const isLinkedInConnected = await linkedinAPI.checkConnectionStatus(post.userId);
        
        if (isLinkedInConnected) {
          const queueResult = await linkedinAPI.queuePost(post.userId, {
            content: post.content!,
            scheduledFor: post.scheduledFor,
            metadata: {
              calendarEventId: event.id,
              contentType: post.contentType,
              source: post.source
            }
          });

          // Update calendar event with LinkedIn queue ID
          if (queueResult.success && queueResult.data) {
            await supabase
              .from('calendar_events')
              .update({ 
                platform_specific_data: { 
                  linkedin: { queueId: queueResult.data.id } 
                }
              })
              .eq('id', event.id);
          }
        }
      }

      return {
        id: event.id,
        userId: event.user_id,
        title: event.title,
        content: event.content_body,
        contentType: event.content_type,
        scheduledFor: new Date(event.scheduled_for),
        status: event.status,
        source: event.source_type,
        hashtags: event.hashtags,
        mediaUrls: event.media_urls
      };
    } catch (error) {
      console.error('Error scheduling post:', error);
      throw error;
    }
  }

  /**
   * Bulk schedule multiple posts with intelligent distribution
   */
  async bulkSchedulePosts(
    userId: string, 
    posts: Partial<ScheduledPost>[], 
    startDate: Date,
    preferences?: SchedulingPreferences
  ): Promise<ScheduledPost[]> {
    try {
      const prefs = preferences || await this.getSchedulingPreferences(userId);
      if (!prefs) throw new Error('Unable to fetch scheduling preferences');

      const scheduledPosts: ScheduledPost[] = [];
      let currentDate = new Date(startDate);
      let postsScheduledToday = 0;
      let postsScheduledThisWeek = 0;
      const weekStart = startOfWeek(currentDate);

      for (const post of posts) {
        // Skip weekends if preference is set
        while (prefs.excludeWeekends && (currentDate.getDay() === 0 || currentDate.getDay() === 6)) {
          currentDate = addDays(currentDate, 1);
        }

        // Check if we need to move to next day
        if (postsScheduledToday >= prefs.postsPerDay) {
          currentDate = addDays(currentDate, 1);
          postsScheduledToday = 0;
          
          // Skip weekends
          while (prefs.excludeWeekends && (currentDate.getDay() === 0 || currentDate.getDay() === 6)) {
            currentDate = addDays(currentDate, 1);
          }
        }

        // Check if we need to move to next week
        if (currentDate > endOfWeek(weekStart) || postsScheduledThisWeek >= prefs.postsPerWeek) {
          currentDate = addWeeks(startOfWeek(currentDate), 1);
          if (prefs.excludeWeekends && currentDate.getDay() === 0) {
            currentDate = addDays(currentDate, 1);
          }
          postsScheduledThisWeek = 0;
          postsScheduledToday = 0;
        }

        // Get optimal time for this date
        const optimalTimes = await this.getOptimalTimes(userId, currentDate);
        const availableTime = optimalTimes.find(t => t.available);
        
        if (!availableTime) {
          // Fallback to preferred times
          const timeIndex = postsScheduledToday % prefs.preferredTimes.length;
          const time = prefs.preferredTimes[timeIndex];
          const [hours, minutes] = time.split(':').map(Number);
          currentDate.setHours(hours, minutes, 0, 0);
        } else {
          const [hours, minutes] = availableTime.time.split(':').map(Number);
          currentDate.setHours(hours, minutes, 0, 0);
        }

        // Schedule the post
        const scheduledPost = await this.schedulePost({
          ...post,
          userId,
          scheduledFor: new Date(currentDate)
        });

        scheduledPosts.push(scheduledPost);
        postsScheduledToday++;
        postsScheduledThisWeek++;
      }

      return scheduledPosts;
    } catch (error) {
      console.error('Error bulk scheduling posts:', error);
      throw error;
    }
  }

  /**
   * Get content calendar for date range
   */
  async getContentCalendar(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<ScheduledPost[]> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select(`
          *,
          calendar_event_series (
            series_id,
            part_number,
            content_series (
              name,
              total_parts
            )
          )
        `)
        .eq('user_id', userId)
        .gte('scheduled_for', startDate.toISOString())
        .lte('scheduled_for', endDate.toISOString())
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      return data.map(event => ({
        id: event.id,
        userId: event.user_id,
        title: event.title,
        content: event.content_body,
        contentType: event.content_type,
        scheduledFor: new Date(event.scheduled_for),
        status: event.status,
        source: event.source_type,
        hashtags: event.hashtags,
        mediaUrls: event.media_urls,
        linkedinQueueId: event.platform_specific_data?.linkedin?.queueId
      }));
    } catch (error) {
      console.error('Error fetching content calendar:', error);
      throw error;
    }
  }

  /**
   * Update scheduled post
   */
  async updateScheduledPost(
    postId: string, 
    updates: Partial<ScheduledPost>
  ): Promise<ScheduledPost> {
    try {
      const { data: event, error } = await supabase
        .from('calendar_events')
        .update({
          title: updates.title,
          content_body: updates.content,
          scheduled_for: updates.scheduledFor,
          status: updates.status,
          hashtags: updates.hashtags,
          media_urls: updates.mediaUrls,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;

      // Update LinkedIn queue if needed
      if (event.platform_specific_data?.linkedin?.queueId && updates.scheduledFor) {
        await linkedinAPI.updateQueueSchedule(
          event.platform_specific_data.linkedin.queueId,
          updates.scheduledFor
        );
      }

      return {
        id: event.id,
        userId: event.user_id,
        title: event.title,
        content: event.content_body,
        contentType: event.content_type,
        scheduledFor: new Date(event.scheduled_for),
        status: event.status,
        source: event.source_type,
        hashtags: event.hashtags,
        mediaUrls: event.media_urls
      };
    } catch (error) {
      console.error('Error updating scheduled post:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled post
   */
  async cancelScheduledPost(postId: string): Promise<void> {
    try {
      // Get the post first
      const { data: event, error: fetchError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;

      // Update status to cancelled
      const { error: updateError } = await supabase
        .from('calendar_events')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (updateError) throw updateError;

      // Cancel in LinkedIn queue if exists
      if (event.platform_specific_data?.linkedin?.queueId) {
        await linkedinAPI.cancelQueuedPost(event.platform_specific_data.linkedin.queueId);
      }
    } catch (error) {
      console.error('Error cancelling scheduled post:', error);
      throw error;
    }
  }

  /**
   * Automatically distribute content based on preferences
   */
  async autoDistributeContent(
    userId: string,
    contentItems: ContentItem[],
    startDate: Date,
    endDate: Date
  ): Promise<ScheduledPost[]> {
    try {
      const preferences = await this.getSchedulingPreferences(userId);
      if (!preferences) throw new Error('Unable to fetch scheduling preferences');

      // Group content by type
      const expertiseContent = contentItems.filter(c => c.pillar === 'expertise');
      const experienceContent = contentItems.filter(c => c.pillar === 'experience');
      const evolutionContent = contentItems.filter(c => c.pillar === 'evolution');

      // Calculate distribution
      const totalSlots = this.calculateTotalSlots(startDate, endDate, preferences);
      const expertiseSlots = Math.floor(totalSlots * (preferences.contentDistribution.expertise / 100));
      const experienceSlots = Math.floor(totalSlots * (preferences.contentDistribution.experience / 100));
      const evolutionSlots = totalSlots - expertiseSlots - experienceSlots;

      // Select content for each category
      const selectedContent: ContentItem[] = [
        ...this.selectContent(expertiseContent, expertiseSlots),
        ...this.selectContent(experienceContent, experienceSlots),
        ...this.selectContent(evolutionContent, evolutionSlots)
      ];

      // Shuffle for variety
      const shuffled = this.shuffleArray(selectedContent);

      // Convert to scheduled posts
      const posts = shuffled.map(content => ({
        userId,
        title: content.title || 'Scheduled Post',
        content: content.content,
        contentType: 'post' as const,
        hashtags: content.hashtags,
        source: 'ai' as const
      }));

      // Bulk schedule
      return await this.bulkSchedulePosts(userId, posts, startDate, preferences);
    } catch (error) {
      console.error('Error auto-distributing content:', error);
      throw error;
    }
  }

  /**
   * Calculate total posting slots in date range
   */
  private calculateTotalSlots(
    startDate: Date,
    endDate: Date,
    preferences: SchedulingPreferences
  ): number {
    let slots = 0;
    let current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      
      if (!preferences.excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        slots += preferences.postsPerDay;
      }
      
      current = addDays(current, 1);
    }

    return slots;
  }

  /**
   * Select content items based on available slots
   */
  private selectContent(items: ContentItem[], slots: number): ContentItem[] {
    if (items.length <= slots) return items;
    
    // Sort by score or relevance if available
    const sorted = [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    return sorted.slice(0, slots);
  }

  /**
   * Shuffle array for content variety
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Create recurring content schedule
   */
  async createRecurringSchedule(
    userId: string,
    template: {
      name: string;
      contentType: string;
      templateData: any;
      recurrenceRule: string; // RRULE format
      startDate: Date;
      endDate?: Date;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('recurring_templates')
        .insert({
          user_id: userId,
          name: template.name,
          content_type: template.contentType,
          template_data: template.templateData,
          recurrence_rule: template.recurrenceRule,
          recurrence_start_date: template.startDate,
          recurrence_end_date: template.endDate,
          is_active: true,
          auto_schedule: true
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating recurring schedule:', error);
      throw error;
    }
  }

  /**
   * Get queue health metrics
   */
  async getQueueHealth(userId: string): Promise<{
    totalScheduled: number;
    nextWeekCount: number;
    nextMonthCount: number;
    emptyDays: Date[];
    contentBalance: {
      expertise: number;
      experience: number;
      evolution: number;
    };
  }> {
    try {
      const now = new Date();
      const nextWeek = addWeeks(now, 1);
      const nextMonth = addWeeks(now, 4);

      // Get all scheduled posts
      const { data: posts, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .gte('scheduled_for', now.toISOString())
        .lte('scheduled_for', nextMonth.toISOString());

      if (error) throw error;

      // Calculate metrics
      const totalScheduled = posts.length;
      const nextWeekCount = posts.filter(p => 
        new Date(p.scheduled_for) <= nextWeek
      ).length;
      const nextMonthCount = posts.length;

      // Find empty days
      const scheduledDates = new Set(
        posts.map(p => format(parseISO(p.scheduled_for), 'yyyy-MM-dd'))
      );
      
      const emptyDays: Date[] = [];
      let checkDate = new Date(now);
      
      while (checkDate <= nextWeek) {
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const dayOfWeek = checkDate.getDay();
        
        // Check if it's a posting day (not weekend if excluded)
        const preferences = await this.getSchedulingPreferences(userId);
        const isPostingDay = !preferences?.excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6);
        
        if (isPostingDay && !scheduledDates.has(dateStr)) {
          emptyDays.push(new Date(checkDate));
        }
        
        checkDate = addDays(checkDate, 1);
      }

      // Calculate content balance
      // This is simplified - in reality, you'd analyze the actual content
      const contentBalance = {
        expertise: Math.floor(Math.random() * 100),
        experience: Math.floor(Math.random() * 100),
        evolution: Math.floor(Math.random() * 100)
      };

      return {
        totalScheduled,
        nextWeekCount,
        nextMonthCount,
        emptyDays,
        contentBalance
      };
    } catch (error) {
      console.error('Error getting queue health:', error);
      throw error;
    }
  }
}

export const contentSchedulingService = new ContentSchedulingService();