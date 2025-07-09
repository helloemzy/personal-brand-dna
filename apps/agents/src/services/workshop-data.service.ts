import { createClient } from '@supabase/supabase-js';
import pino from 'pino';

const logger = pino({ name: 'workshop-data-service' });

export interface WorkshopData {
  userId: string;
  archetype: string;
  values: string[];
  tonePreferences: {
    formal_casual: number;
    concise_detailed: number;
    analytical_creative: number;
    serious_playful: number;
  };
  audiencePersonas: Array<{
    name: string;
    role: string;
    painPoints: string[];
    goals: string[];
    transformation?: {
      outcome: string;
      beforeState: string;
      afterState: string;
    };
  }>;
  writingSample?: string;
  missionStatement?: string;
  contentPillars?: Array<{
    name: string;
    topics: string[];
    percentage: number;
  }>;
  voiceProfile?: any;
}

export class WorkshopDataService {
  private supabase;
  private cache: Map<string, { data: WorkshopData; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );
  }

  async getWorkshopData(userId: string): Promise<WorkshopData | null> {
    try {
      // Check cache first
      const cached = this.cache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Fetch from database
      const { data: workshopResult, error: workshopError } = await this.supabase
        .from('workshop_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (workshopError || !workshopResult) {
        logger.warn({ userId, error: workshopError }, 'No workshop data found');
        return null;
      }

      // Transform database data to our format
      const workshopData: WorkshopData = {
        userId,
        archetype: workshopResult.archetype || 'Strategic Visionary',
        values: workshopResult.values || [],
        tonePreferences: workshopResult.tone_preferences || {
          formal_casual: 0,
          concise_detailed: 0,
          analytical_creative: 0,
          serious_playful: 0
        },
        audiencePersonas: workshopResult.audience_personas || [],
        writingSample: workshopResult.writing_sample,
        missionStatement: workshopResult.mission_statement,
        contentPillars: workshopResult.content_pillars || this.generateDefaultPillars(workshopResult.archetype),
        voiceProfile: workshopResult.voice_profile
      };

      // Cache the data
      this.cache.set(userId, { data: workshopData, timestamp: Date.now() });

      return workshopData;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch workshop data');
      return null;
    }
  }

  async saveVoiceProfile(userId: string, voiceProfile: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('workshop_results')
        .update({ 
          voice_profile: voiceProfile,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        logger.error({ error, userId }, 'Failed to save voice profile');
        throw error;
      }

      // Update cache
      const cached = this.cache.get(userId);
      if (cached) {
        cached.data.voiceProfile = voiceProfile;
        cached.timestamp = Date.now();
      }

      logger.info({ userId }, 'Voice profile saved');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to save voice profile');
      throw error;
    }
  }

  async getUserIds(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('subscription_status', 'active');

      if (error) {
        logger.error({ error }, 'Failed to fetch user IDs');
        return [];
      }

      return data?.map(user => user.id) || [];
    } catch (error) {
      logger.error({ error }, 'Failed to fetch user IDs');
      return [];
    }
  }

  private generateDefaultPillars(archetype: string): Array<{ name: string; topics: string[]; percentage: number }> {
    const pillarTemplates: Record<string, Array<{ name: string; topics: string[]; percentage: number }>> = {
      'Innovative Leader': [
        { name: 'Innovation & Future Trends', topics: ['Emerging technologies', 'Industry disruption', 'Future of work'], percentage: 40 },
        { name: 'Leadership & Transformation', topics: ['Change management', 'Team innovation', 'Strategic vision'], percentage: 35 },
        { name: 'Personal Growth & Learning', topics: ['Continuous learning', 'Adaptability', 'Creative thinking'], percentage: 25 }
      ],
      'Empathetic Expert': [
        { name: 'Expertise & Education', topics: ['Industry insights', 'Best practices', 'How-to guides'], percentage: 40 },
        { name: 'Human Connection', topics: ['Team dynamics', 'Communication skills', 'Emotional intelligence'], percentage: 35 },
        { name: 'Success Stories', topics: ['Client transformations', 'Lessons learned', 'Case studies'], percentage: 25 }
      ],
      'Strategic Visionary': [
        { name: 'Strategic Insights', topics: ['Market analysis', 'Business strategy', 'Competitive advantage'], percentage: 40 },
        { name: 'Data & Analytics', topics: ['Performance metrics', 'ROI analysis', 'Decision frameworks'], percentage: 35 },
        { name: 'Execution Excellence', topics: ['Process optimization', 'Goal achievement', 'Results delivery'], percentage: 25 }
      ],
      'Authentic Changemaker': [
        { name: 'Industry Disruption', topics: ['Challenging norms', 'New perspectives', 'Alternative approaches'], percentage: 40 },
        { name: 'Authentic Leadership', topics: ['Transparency', 'Values-driven decisions', 'Real talk'], percentage: 35 },
        { name: 'Community Impact', topics: ['Social change', 'Collective action', 'Movement building'], percentage: 25 }
      ]
    };

    return pillarTemplates[archetype] || pillarTemplates['Strategic Visionary'];
  }

  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }
}

// Singleton instance
export const workshopDataService = new WorkshopDataService();