import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import { NewsDatabaseService } from './news-database.service';
import axios from 'axios';
import cheerio from 'cheerio';
import { RateLimiter } from 'limiter';

interface CompetitorProfile {
  name: string;
  domains: string[];
  linkedinHandle?: string;
  keywords: string[];
  contentStyle: string;
  postingFrequency: number; // posts per week
  avgEngagement: number;
}

interface CompetitiveAdvantage {
  score: number; // 0-1, higher is better advantage
  uncoveredAngle: boolean;
  timingAdvantage: number; // hours ahead of competition
  uniquePerspective: string;
  competitorsCovered: string[];
  suggestedApproach: string;
  explanation: string;
}

interface ContentGap {
  topic: string;
  lastCovered: Date | null;
  competitorsCovering: string[];
  relevanceToUser: number;
  opportunity: string;
}

export class CompetitiveAnalysisService {
  private logger: Logger;
  private databaseService: NewsDatabaseService;
  private rateLimiter: RateLimiter;
  private competitorProfiles: Map<string, CompetitorProfile> = new Map();
  private linkedinScraper: any; // Would use linkedin-api in production

  constructor() {
    this.logger = createLogger('CompetitiveAnalysisService');
    this.databaseService = new NewsDatabaseService();
    
    // Rate limiter for external API calls
    this.rateLimiter = new RateLimiter({ tokensPerInterval: 10, interval: 'minute' });
    
    this.initializeCompetitorProfiles();
  }

  private initializeCompetitorProfiles() {
    // In production, this would load from database
    // Sample competitor profiles for different industries
    
    // Tech influencers
    this.competitorProfiles.set('tech_leader_1', {
      name: 'Tech Thought Leader A',
      domains: ['ai', 'machine learning', 'future of work'],
      linkedinHandle: 'tech-leader-a',
      keywords: ['AI', 'automation', 'innovation', 'digital transformation'],
      contentStyle: 'analytical',
      postingFrequency: 5,
      avgEngagement: 0.08
    });
    
    // Business influencers
    this.competitorProfiles.set('business_leader_1', {
      name: 'Business Strategy Expert',
      domains: ['strategy', 'leadership', 'growth'],
      linkedinHandle: 'business-expert',
      keywords: ['strategy', 'leadership', 'growth', 'transformation'],
      contentStyle: 'inspirational',
      postingFrequency: 3,
      avgEngagement: 0.06
    });
  }

  async analyzeCompetitiveAdvantage(
    userId: string,
    article: any,
    userProfile: any
  ): Promise<CompetitiveAdvantage> {
    try {
      // Get relevant competitors based on user's industry and topics
      const competitors = await this.getRelevantCompetitors(userProfile);
      
      // Check if competitors have covered this topic
      const competitorCoverage = await this.checkCompetitorCoverage(
        article,
        competitors
      );
      
      // Analyze timing advantage
      const timingAdvantage = this.calculateTimingAdvantage(
        article,
        competitorCoverage
      );
      
      // Find unique angle
      const uniqueAngle = await this.findUniqueAngle(
        article,
        competitorCoverage,
        userProfile
      );
      
      // Calculate overall competitive score
      const score = this.calculateCompetitiveScore({
        covered: competitorCoverage.length > 0,
        timingAdvantage,
        uniqueAngle: uniqueAngle !== null,
        userExpertise: userProfile.expertise
      });
      
      // Generate strategic approach
      const approach = this.generateStrategicApproach(
        article,
        competitorCoverage,
        uniqueAngle,
        userProfile
      );
      
      return {
        score,
        uncoveredAngle: competitorCoverage.length === 0,
        timingAdvantage,
        uniquePerspective: uniqueAngle || 'Standard coverage approach',
        competitorsCovered: competitorCoverage.map(c => c.name),
        suggestedApproach: approach,
        explanation: this.generateExplanation(score, competitorCoverage, timingAdvantage)
      };
    } catch (error) {
      this.logger.error('Error analyzing competitive advantage:', error);
      return this.getDefaultAdvantage();
    }
  }

  async findContentGaps(
    userId: string,
    userProfile: any,
    timeframe: number = 7 // days
  ): Promise<ContentGap[]> {
    try {
      const competitors = await this.getRelevantCompetitors(userProfile);
      const userTopics = this.extractUserTopics(userProfile);
      const gaps: ContentGap[] = [];
      
      // Analyze each topic for gaps
      for (const topic of userTopics) {
        const competitorActivity = await this.getCompetitorActivityForTopic(
          topic,
          competitors,
          timeframe
        );
        
        if (this.isContentGap(competitorActivity, timeframe)) {
          gaps.push({
            topic,
            lastCovered: competitorActivity.lastCovered,
            competitorsCovering: competitorActivity.competitors,
            relevanceToUser: this.calculateTopicRelevance(topic, userProfile),
            opportunity: this.generateGapOpportunity(topic, competitorActivity)
          });
        }
      }
      
      // Sort by relevance and opportunity
      gaps.sort((a, b) => b.relevanceToUser - a.relevanceToUser);
      
      return gaps.slice(0, 10); // Top 10 gaps
    } catch (error) {
      this.logger.error('Error finding content gaps:', error);
      return [];
    }
  }

  private async getRelevantCompetitors(userProfile: any): Promise<CompetitorProfile[]> {
    const relevantCompetitors: CompetitorProfile[] = [];
    
    // Filter competitors by matching domains and keywords
    for (const [id, competitor] of this.competitorProfiles.entries()) {
      const domainMatch = competitor.domains.some(domain => 
        userProfile.industry?.toLowerCase().includes(domain) ||
        userProfile.expertise?.some((e: string) => e.toLowerCase().includes(domain))
      );
      
      const keywordMatch = competitor.keywords.some(keyword =>
        userProfile.contentPillars?.expertise?.topics?.some((t: string) => 
          t.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      if (domainMatch || keywordMatch) {
        relevantCompetitors.push(competitor);
      }
    }
    
    // In production, would also dynamically identify competitors
    // based on user's network and engagement patterns
    
    return relevantCompetitors;
  }

  private async checkCompetitorCoverage(
    article: any,
    competitors: CompetitorProfile[]
  ): Promise<any[]> {
    const coverage = [];
    
    // Check each competitor for similar content
    for (const competitor of competitors) {
      const hasCovered = await this.competitorHasCoveredTopic(
        competitor,
        article
      );
      
      if (hasCovered) {
        coverage.push({
          name: competitor.name,
          coveredAt: hasCovered.date,
          angle: hasCovered.angle,
          engagement: hasCovered.engagement
        });
      }
    }
    
    // Save to database for future reference
    for (const cov of coverage) {
      await this.databaseService.saveCompetitiveCoverage({
        article_id: article.id,
        competitor_name: cov.name,
        coverage_type: 'similar',
        coverage_angle: cov.angle,
        published_at: cov.coveredAt,
        engagement_metrics: { engagement: cov.engagement }
      });
    }
    
    return coverage;
  }

  private async competitorHasCoveredTopic(
    competitor: CompetitorProfile,
    article: any
  ): Promise<any | null> {
    // In production, this would:
    // 1. Check LinkedIn API for competitor's recent posts
    // 2. Use NLP to find semantic similarity
    // 3. Check timing and engagement
    
    // Simulated check based on keywords
    const articleKeywords = this.extractKeywords(article);
    const hasKeywordOverlap = articleKeywords.some(keyword =>
      competitor.keywords.some(ck => 
        ck.toLowerCase() === keyword.toLowerCase()
      )
    );
    
    if (hasKeywordOverlap && Math.random() > 0.6) {
      // Simulate 40% chance competitor covered it
      return {
        date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        angle: this.generateCompetitorAngle(competitor.contentStyle),
        engagement: competitor.avgEngagement * (0.8 + Math.random() * 0.4)
      };
    }
    
    return null;
  }

  private calculateTimingAdvantage(
    article: any,
    competitorCoverage: any[]
  ): number {
    if (competitorCoverage.length === 0) {
      // No competitors covered it yet
      const articleAge = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
      return Math.max(48 - articleAge, 0); // Up to 48 hours advantage
    }
    
    // Find earliest competitor coverage
    const earliestCoverage = competitorCoverage.reduce((earliest, cov) => {
      return cov.coveredAt < earliest ? cov.coveredAt : earliest;
    }, competitorCoverage[0].coveredAt);
    
    const hoursSinceCoverage = (Date.now() - earliestCoverage.getTime()) / (1000 * 60 * 60);
    
    // Negative means we're late, positive means we're early
    return -hoursSinceCoverage;
  }

  private async findUniqueAngle(
    article: any,
    competitorCoverage: any[],
    userProfile: any
  ): Promise<string | null> {
    // Generate unique angles based on user's expertise
    const angles = [];
    
    // Expertise-based angle
    if (userProfile.expertise?.length > 0) {
      angles.push(`${userProfile.expertise[0]} perspective on ${this.getArticleTopic(article)}`);
    }
    
    // Values-based angle
    if (userProfile.values?.length > 0) {
      angles.push(`Why ${userProfile.values[0]} matters in ${this.getArticleTopic(article)}`);
    }
    
    // Contrarian angle
    if (competitorCoverage.length > 0) {
      angles.push(`The overlooked risk in ${this.getArticleTopic(article)}`);
    }
    
    // Industry-specific angle
    if (userProfile.industry) {
      angles.push(`What ${userProfile.industry} professionals need to know`);
    }
    
    // Personal experience angle
    angles.push(`My unexpected discovery about ${this.getArticleTopic(article)}`);
    
    // Filter out angles already taken by competitors
    const uniqueAngles = angles.filter(angle => {
      return !competitorCoverage.some(cov => 
        cov.angle?.toLowerCase().includes(angle.toLowerCase())
      );
    });
    
    return uniqueAngles.length > 0 ? uniqueAngles[0] : null;
  }

  private calculateCompetitiveScore(factors: {
    covered: boolean;
    timingAdvantage: number;
    uniqueAngle: boolean;
    userExpertise: string[];
  }): number {
    let score = 0.5; // Base score
    
    // Uncovered topic bonus
    if (!factors.covered) {
      score += 0.3;
    }
    
    // Timing advantage
    if (factors.timingAdvantage > 24) {
      score += 0.2; // More than 24 hours ahead
    } else if (factors.timingAdvantage > 0) {
      score += 0.1; // Some advantage
    } else if (factors.timingAdvantage < -24) {
      score -= 0.2; // Very late
    }
    
    // Unique angle bonus
    if (factors.uniqueAngle) {
      score += 0.15;
    }
    
    // Expertise match bonus
    if (factors.userExpertise?.length > 0) {
      score += 0.1;
    }
    
    return Math.max(0, Math.min(score, 1));
  }

  private generateStrategicApproach(
    article: any,
    competitorCoverage: any[],
    uniqueAngle: string | null,
    userProfile: any
  ): string {
    const approaches = [];
    
    if (competitorCoverage.length === 0) {
      approaches.push('Be first to market with this breaking insight');
      approaches.push('Establish thought leadership by providing initial analysis');
    } else if (competitorCoverage.length < 3) {
      approaches.push('Add your unique perspective to emerging conversation');
      approaches.push('Build on initial coverage with deeper analysis');
    } else {
      approaches.push('Synthesize multiple viewpoints into comprehensive take');
      approaches.push('Challenge conventional wisdom with contrarian view');
    }
    
    if (uniqueAngle) {
      approaches.push(`Focus on: ${uniqueAngle}`);
    }
    
    // Add format suggestions
    if (userProfile.archetype === 'Innovative Leader') {
      approaches.push('Use data visualization to stand out');
    } else if (userProfile.archetype === 'Empathetic Expert') {
      approaches.push('Share personal story or case study');
    }
    
    return approaches.join('. ');
  }

  private generateExplanation(
    score: number,
    competitorCoverage: any[],
    timingAdvantage: number
  ): string {
    const parts = [];
    
    if (score > 0.7) {
      parts.push('High competitive advantage opportunity');
    } else if (score > 0.4) {
      parts.push('Moderate competitive advantage');
    } else {
      parts.push('Limited competitive advantage');
    }
    
    if (competitorCoverage.length === 0) {
      parts.push('No competitors have covered this yet');
    } else {
      parts.push(`${competitorCoverage.length} competitors already covered`);
    }
    
    if (timingAdvantage > 0) {
      parts.push(`${Math.round(timingAdvantage)} hours ahead of competition`);
    } else if (timingAdvantage < -12) {
      parts.push('Late to the conversation');
    }
    
    return parts.join('. ') + '.';
  }

  private extractKeywords(article: any): string[] {
    const text = `${article.title} ${article.summary || ''}`.toLowerCase();
    const words = text.split(/\W+/);
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be']);
    
    return words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  }

  private getArticleTopic(article: any): string {
    // Simple topic extraction from title
    const title = article.title;
    const words = title.split(' ');
    
    // Look for noun phrases
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 4 && words[i + 1].length > 4) {
        return `${words[i]} ${words[i + 1]}`.toLowerCase();
      }
    }
    
    return 'this development';
  }

  private generateCompetitorAngle(contentStyle: string): string {
    const angles: Record<string, string[]> = {
      analytical: [
        'Data-driven analysis',
        'Research-backed insights',
        'Statistical breakdown'
      ],
      inspirational: [
        'Leadership lessons',
        'Success story angle',
        'Motivational perspective'
      ],
      practical: [
        'Step-by-step guide',
        'Implementation roadmap',
        'Actionable takeaways'
      ]
    };
    
    const styleAngles = angles[contentStyle] || angles.practical;
    return styleAngles[Math.floor(Math.random() * styleAngles.length)];
  }

  private extractUserTopics(userProfile: any): string[] {
    const topics = new Set<string>();
    
    // Add expertise topics
    if (userProfile.expertise) {
      userProfile.expertise.forEach((e: string) => topics.add(e));
    }
    
    // Add content pillar topics
    if (userProfile.contentPillars) {
      Object.values(userProfile.contentPillars).forEach((pillar: any) => {
        if (pillar.topics) {
          pillar.topics.forEach((t: string) => topics.add(t));
        }
      });
    }
    
    return Array.from(topics);
  }

  private async getCompetitorActivityForTopic(
    topic: string,
    competitors: CompetitorProfile[],
    timeframeDays: number
  ): Promise<any> {
    // In production, would check actual competitor posts
    // Simulated data for now
    const activeCom petitors = competitors.filter(() => Math.random() > 0.5);
    const lastCovered = activeCom petitors.length > 0
      ? new Date(Date.now() - Math.random() * timeframeDays * 24 * 60 * 60 * 1000)
      : null;
    
    return {
      competitors: activeCompetitors.map(c => c.name),
      lastCovered,
      frequency: activeCompetitors.length
    };
  }

  private isContentGap(activity: any, timeframeDays: number): boolean {
    // Gap if no one covered it, or it's been more than half the timeframe
    return activity.competitors.length === 0 || 
      (activity.lastCovered && 
       (Date.now() - activity.lastCovered.getTime()) > (timeframeDays * 0.5 * 24 * 60 * 60 * 1000));
  }

  private calculateTopicRelevance(topic: string, userProfile: any): number {
    // Higher relevance for expertise topics
    if (userProfile.expertise?.includes(topic)) return 0.9;
    
    // Medium relevance for content pillar topics
    const inPillars = Object.values(userProfile.contentPillars || {}).some((p: any) => 
      p.topics?.includes(topic)
    );
    if (inPillars) return 0.7;
    
    // Lower relevance for industry topics
    return 0.5;
  }

  private generateGapOpportunity(topic: string, activity: any): string {
    if (activity.competitors.length === 0) {
      return `Be the first to cover ${topic} in your niche`;
    } else if (activity.frequency < 2) {
      return `Limited coverage of ${topic} - opportunity to dominate`;
    } else {
      return `Refresh outdated ${topic} content with new insights`;
    }
  }

  private getDefaultAdvantage(): CompetitiveAdvantage {
    return {
      score: 0.5,
      uncoveredAngle: false,
      timingAdvantage: 0,
      uniquePerspective: 'Standard coverage approach',
      competitorsCovered: [],
      suggestedApproach: 'Cover with your unique expertise and perspective',
      explanation: 'Default competitive analysis - unable to assess competition'
    };
  }

  async updateCompetitorProfiles(profiles: CompetitorProfile[]): Promise<void> {
    // Update competitor profiles in memory and database
    for (const profile of profiles) {
      this.competitorProfiles.set(profile.name, profile);
    }
    
    // In production, save to database
    this.logger.info(`Updated ${profiles.length} competitor profiles`);
  }
}