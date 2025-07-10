import { v4 as uuidv4 } from 'uuid';
import { workshopAPI } from './workshopAPI';
import type { WorkshopState } from '../store/slices/workshopSlice';
import type { Archetype } from './archetypeService';
import type { ContentPillarAnalysis } from './contentPillarService';
import type { UVPAnalysis } from './uvpConstructorService';
import type { ActionableContentPackage } from './linkedinHeadlineService';

export interface WorkshopResults {
  id: string;
  sessionId: string;
  userId?: string;
  createdAt: string;
  expiresAt?: string;
  shareCode?: string;
  workshopData: WorkshopState;
  analysis: {
    archetype: {
      primary: {
        name: string;
        archetype: Archetype;
        score: number;
        confidence: number;
        factors: Record<string, number>;
      };
      secondary?: {
        name: string;
        archetype: Archetype;
        score: number;
        confidence: number;
        factors: Record<string, number>;
      };
      hybrid?: {
        name: string;
        description: string;
        ratio: number;
      };
    };
    mission: string;
    aiMissions: string[];
    contentPillars: ContentPillarAnalysis;
    starterContent: string[];
    uvpAnalysis: UVPAnalysis;
    actionableContent: ActionableContentPackage;
  };
  metadata?: {
    writingAnalysis?: any;
    personalityAnalysis?: any;
    completionTime?: number;
    version: string;
  };
}

interface ResultsCache {
  [key: string]: {
    data: WorkshopResults;
    timestamp: number;
    ttl: number;
  };
}

interface ResultsIndexEntry {
  id: string;
  sessionId: string;
  userId?: string;
  archetype: string;
  createdAt: string;
  expiresAt?: string;
  shareCode?: string;
}

interface ResultsIndex {
  version: string;
  entries: ResultsIndexEntry[];
  lastUpdated: string;
}

interface UserResultsIndex {
  userId: string;
  resultIds: string[];
  totalCount: number;
  lastUpdated: string;
}

const CACHE_KEY_PREFIX = 'workshop_results_';
const RESULTS_INDEX_KEY = 'workshop_results_index';
const USER_RESULTS_PREFIX = 'user_results_';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_EXPIRATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_CACHE_SIZE = 10; // Maximum number of results to cache
const MAX_RESULTS_PER_USER = 50; // Maximum results to keep per user

class ResultsService {
  private static instance: ResultsService;
  private cache: ResultsCache = {};
  private resultsIndex: ResultsIndex | null = null;

  private constructor() {
    this.loadCacheFromStorage();
    this.loadResultsIndex();
    this.scheduleExpirationCheck();
  }

  public static getInstance(): ResultsService {
    if (!ResultsService.instance) {
      ResultsService.instance = new ResultsService();
    }
    return ResultsService.instance;
  }

  /**
   * Load results index from localStorage
   */
  private loadResultsIndex(): void {
    try {
      const indexData = localStorage.getItem(RESULTS_INDEX_KEY);
      if (indexData) {
        this.resultsIndex = JSON.parse(indexData);
        // Validate version
        if (this.resultsIndex?.version !== '1.0') {
          this.resultsIndex = this.createEmptyIndex();
        }
      } else {
        this.resultsIndex = this.createEmptyIndex();
      }
    } catch (error) {
      console.error('Failed to load results index:', error);
      this.resultsIndex = this.createEmptyIndex();
    }
  }

  /**
   * Create empty results index
   */
  private createEmptyIndex(): ResultsIndex {
    return {
      version: '1.0',
      entries: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Save results index to localStorage
   */
  private saveResultsIndex(): void {
    if (!this.resultsIndex) return;
    
    try {
      this.resultsIndex.lastUpdated = new Date().toISOString();
      localStorage.setItem(RESULTS_INDEX_KEY, JSON.stringify(this.resultsIndex));
    } catch (error) {
      console.error('Failed to save results index:', error);
    }
  }

  /**
   * Add entry to results index
   */
  private addToIndex(results: WorkshopResults): void {
    if (!this.resultsIndex) {
      this.resultsIndex = this.createEmptyIndex();
    }

    const entry: ResultsIndexEntry = {
      id: results.id,
      sessionId: results.sessionId,
      userId: results.userId,
      archetype: results.analysis.archetype.primary.name,
      createdAt: results.createdAt,
      expiresAt: results.expiresAt,
      shareCode: results.shareCode
    };

    // Remove existing entry if it exists
    this.resultsIndex.entries = this.resultsIndex.entries.filter(e => e.id !== results.id);
    
    // Add new entry
    this.resultsIndex.entries.push(entry);
    
    // Sort by creation date (newest first)
    this.resultsIndex.entries.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    this.saveResultsIndex();
  }

  /**
   * Update user results index
   */
  private updateUserIndex(userId: string, resultId: string): void {
    const userIndexKey = USER_RESULTS_PREFIX + userId;
    
    try {
      let userIndex: UserResultsIndex;
      const stored = localStorage.getItem(userIndexKey);
      
      if (stored) {
        userIndex = JSON.parse(stored);
      } else {
        userIndex = {
          userId,
          resultIds: [],
          totalCount: 0,
          lastUpdated: new Date().toISOString()
        };
      }

      // Add new result ID if not already present
      if (!userIndex.resultIds.includes(resultId)) {
        userIndex.resultIds.unshift(resultId);
        userIndex.totalCount++;
        
        // Limit results per user
        if (userIndex.resultIds.length > MAX_RESULTS_PER_USER) {
          const toRemove = userIndex.resultIds.slice(MAX_RESULTS_PER_USER);
          userIndex.resultIds = userIndex.resultIds.slice(0, MAX_RESULTS_PER_USER);
          
          // Remove old results from storage
          toRemove.forEach(id => {
            localStorage.removeItem(CACHE_KEY_PREFIX + id);
            delete this.cache[id];
          });
        }
      }

      userIndex.lastUpdated = new Date().toISOString();
      localStorage.setItem(userIndexKey, JSON.stringify(userIndex));
    } catch (error) {
      console.error('Failed to update user index:', error);
    }
  }

  /**
   * Schedule periodic expiration check
   */
  private scheduleExpirationCheck(): void {
    // Check for expired results every hour
    setInterval(() => {
      this.cleanupExpiredResults();
    }, 60 * 60 * 1000);
    
    // Also run on startup
    this.cleanupExpiredResults();
  }

  /**
   * Clean up expired results
   */
  private cleanupExpiredResults(): void {
    if (!this.resultsIndex) return;

    const now = Date.now();
    const expiredIds: string[] = [];

    // Check each entry for expiration
    this.resultsIndex.entries = this.resultsIndex.entries.filter(entry => {
      if (entry.expiresAt) {
        const expiresAt = new Date(entry.expiresAt).getTime();
        if (expiresAt < now) {
          expiredIds.push(entry.id);
          return false;
        }
      }
      return true;
    });

    // Remove expired results from storage
    if (expiredIds.length > 0) {
      expiredIds.forEach(id => {
        localStorage.removeItem(CACHE_KEY_PREFIX + id);
        delete this.cache[id];
      });
      
      this.saveResultsIndex();
      console.log(`Cleaned up ${expiredIds.length} expired results`);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadCacheFromStorage(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX));
      keys.forEach(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const cached = JSON.parse(item);
            if (this.isValidCache(cached)) {
              const id = key.replace(CACHE_KEY_PREFIX, '');
              this.cache[id] = cached;
            } else {
              // Remove expired items
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          console.error('Failed to load cache item:', key, error);
          localStorage.removeItem(key);
        }
      });
      
      // Clean up excess cache items
      this.cleanupCache();
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
    }
  }

  /**
   * Check if cache item is valid and not expired
   */
  private isValidCache(cached: any): boolean {
    if (!cached.data || !cached.timestamp || !cached.ttl) {
      return false;
    }
    
    const now = Date.now();
    const age = now - cached.timestamp;
    return age < cached.ttl;
  }

  /**
   * Clean up cache to maintain size limit
   */
  private cleanupCache(): void {
    const entries = Object.entries(this.cache);
    if (entries.length <= MAX_CACHE_SIZE) {
      return;
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([id]) => {
      delete this.cache[id];
      localStorage.removeItem(CACHE_KEY_PREFIX + id);
    });
  }

  /**
   * Save results to cache and optionally to database
   */
  public async saveResults(
    workshopData: WorkshopState,
    analysis: WorkshopResults['analysis'],
    metadata?: WorkshopResults['metadata'],
    options?: {
      persist?: boolean;
      shareable?: boolean;
      ttl?: number;
      userId?: string;
    }
  ): Promise<WorkshopResults> {
    const results: WorkshopResults = {
      id: uuidv4(),
      sessionId: workshopData.sessionId || uuidv4(),
      userId: options?.userId,
      createdAt: new Date().toISOString(),
      workshopData,
      analysis,
      metadata: {
        ...metadata,
        version: '1.0',
      },
    };

    // Set expiration if TTL is provided (default 30 days)
    const expirationTime = options?.ttl || DEFAULT_EXPIRATION;
    results.expiresAt = new Date(Date.now() + expirationTime).toISOString();

    // Generate share code if requested
    if (options?.shareable) {
      results.shareCode = this.generateShareCode();
    }

    // Cache locally
    this.cacheResults(results, options?.ttl || DEFAULT_TTL);

    // Add to results index
    this.addToIndex(results);

    // Update user index if userId is present
    if (results.userId) {
      this.updateUserIndex(results.userId, results.id);
    }

    // Persist to database if requested
    if (options?.persist) {
      try {
        await this.persistResults(results);
      } catch (error) {
        console.error('Failed to persist results:', error);
        // Continue even if persistence fails
      }
    }

    return results;
  }

  /**
   * Cache results locally
   */
  private cacheResults(results: WorkshopResults, ttl: number): void {
    const cacheItem = {
      data: results,
      timestamp: Date.now(),
      ttl,
    };

    this.cache[results.id] = cacheItem;
    
    try {
      localStorage.setItem(
        CACHE_KEY_PREFIX + results.id,
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.error('Failed to cache results:', error);
    }

    this.cleanupCache();
  }

  /**
   * Get results by ID
   */
  public async getResults(id: string): Promise<WorkshopResults | null> {
    // Check local cache first
    const cached = this.cache[id];
    if (cached && this.isValidCache(cached)) {
      return cached.data;
    }

    // Try to load from database
    try {
      const results = await this.loadResultsFromDB(id);
      if (results) {
        // Cache the loaded results
        this.cacheResults(results, DEFAULT_TTL);
        return results;
      }
    } catch (error) {
      console.error('Failed to load results from database:', error);
    }

    return null;
  }

  /**
   * Get results by share code
   */
  public async getResultsByShareCode(shareCode: string): Promise<WorkshopResults | null> {
    // Check cache for share code
    const cachedEntry = Object.values(this.cache).find(
      item => item.data.shareCode === shareCode
    );
    
    if (cachedEntry && this.isValidCache(cachedEntry)) {
      return cachedEntry.data;
    }

    // Try to load from database by share code
    try {
      const response = await workshopAPI.getResultsByShareCode(shareCode);
      if (response.data) {
        // Cache the results
        this.cache.set(response.data.id, response.data);
        this.cacheByShareCode.set(shareCode, response.data.id);
        return response.data;
      }
    } catch (error) {
      console.error('Failed to load results by share code:', error);
    }
    
    return null;
  }

  /**
   * Generate a unique share code
   */
  private generateShareCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Persist results to database
   */
  private async persistResults(results: WorkshopResults): Promise<void> {
    try {
      await workshopAPI.saveResults(results);
      console.log('Results persisted successfully:', results.id);
    } catch (error) {
      console.error('Failed to persist results:', error);
      // Continue even if persistence fails - we still have localStorage
    }
  }

  /**
   * Load results from database
   */
  private async loadResultsFromDB(id: string): Promise<WorkshopResults | null> {
    try {
      const response = await workshopAPI.getResults(id);
      return response.data;
    } catch (error) {
      console.error('Failed to load results from database:', error);
      return null;
    }
  }

  /**
   * Export results to various formats
   */
  public async exportResults(
    results: WorkshopResults,
    format: 'json' | 'pdf' | 'csv'
  ): Promise<Blob> {
    switch (format) {
      case 'json':
        return new Blob(
          [JSON.stringify(results, null, 2)],
          { type: 'application/json' }
        );
      
      case 'pdf':
        // This would use the existing PDF export service
        const { generateBrandHousePDF } = await import('./pdfExportService');
        const reportData = this.convertToReportData(results);
        return await generateBrandHousePDF(reportData);
      
      case 'csv':
        const csv = this.convertToCSV(results);
        return new Blob([csv], { type: 'text/csv' });
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert results to PDF report data format
   */
  private convertToReportData(results: WorkshopResults): any {
    return {
      archetype: results.analysis.archetype.primary.archetype,
      values: results.workshopData.values,
      mission: results.analysis.mission,
      uvp: results.analysis.uvpAnalysis.variations[0],
      contentPillars: results.analysis.contentPillars.pillars,
      headlines: results.analysis.actionableContent.headlines,
      elevatorPitch: results.analysis.actionableContent.elevatorPitches['60-second'],
      contentIdeas: results.analysis.actionableContent.contentStarters.slice(0, 10),
    };
  }

  /**
   * Convert results to CSV format
   */
  private convertToCSV(results: WorkshopResults): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Field,Value');
    
    // Basic info
    lines.push(`"Results ID","${results.id}"`);
    lines.push(`"Created","${results.createdAt}"`);
    lines.push(`"Archetype","${results.analysis.archetype.primary.name}"`);
    lines.push(`"Confidence","${results.analysis.archetype.primary.confidence}%"`);
    
    // Mission
    lines.push(`"Mission","${results.analysis.mission.replace(/"/g, '""')}"`);
    
    // Values
    const values = results.workshopData.values.selected.join(', ');
    lines.push(`"Core Values","${values}"`);
    
    // Content pillars
    results.analysis.contentPillars.pillars.forEach((pillar, index) => {
      lines.push(`"Content Pillar ${index + 1}","${pillar.name} - ${pillar.description.replace(/"/g, '""')}"`);
    });
    
    // UVP
    const uvp = results.analysis.uvpAnalysis.variations[0];
    lines.push(`"Value Proposition","${uvp.statement.replace(/"/g, '""')}"`);
    
    return lines.join('\n');
  }

  /**
   * Regenerate analysis for existing workshop data
   */
  public async regenerateResults(
    workshopData: WorkshopState,
    options?: {
      includeAI?: boolean;
      persist?: boolean;
    }
  ): Promise<WorkshopResults> {
    // Import all necessary services
    const [
      { determineArchetype, generateMissionStatement },
      { analyzeWritingWithAI, analyzePersonalityWithAI, generateEnhancedMission },
      { mapContentPillars, generateStarterContent },
      { constructUVP },
      { generateActionableContent }
    ] = await Promise.all([
      import('./archetypeService'),
      import('./aiAnalysisService'),
      import('./contentPillarService'),
      import('./uvpConstructorService'),
      import('./linkedinHeadlineService')
    ]);

    // Perform archetype analysis
    const archetypeResult = await determineArchetype(workshopData);
    
    // Generate basic mission
    let mission = generateMissionStatement(archetypeResult.primary.archetype, workshopData);
    let aiMissions: string[] = [];
    
    // Generate enhanced mission with AI if requested
    if (options?.includeAI && workshopData.writingSample?.text && process.env.REACT_APP_OPENAI_API_KEY) {
      const [writingAnalysis, personalityAnalysis] = await Promise.all([
        analyzeWritingWithAI(workshopData.writingSample.text, [archetypeResult.primary.archetype]),
        analyzePersonalityWithAI(workshopData.personalityQuiz.responses, [archetypeResult.primary.archetype])
      ]);
      
      const enhancedMissions = await generateEnhancedMission(
        archetypeResult.primary.archetype,
        workshopData,
        writingAnalysis,
        personalityAnalysis
      );
      
      if (enhancedMissions.length > 0) {
        aiMissions = enhancedMissions;
        mission = enhancedMissions[0];
      }
    }
    
    // Generate all other analysis
    const [pillarAnalysis, uvpAnalysis] = await Promise.all([
      mapContentPillars(workshopData, archetypeResult.primary.archetype.name),
      constructUVP(workshopData, archetypeResult.primary.archetype.name)
    ]);
    
    const starterContent = generateStarterContent(
      pillarAnalysis,
      archetypeResult.primary.archetype.name,
      mission
    );
    
    const actionableContent = generateActionableContent(
      workshopData,
      archetypeResult.primary.archetype.name,
      uvpAnalysis,
      pillarAnalysis.pillars
    );
    
    // Save and return results
    return await this.saveResults(
      workshopData,
      {
        archetype: archetypeResult,
        mission,
        aiMissions,
        contentPillars: pillarAnalysis,
        starterContent,
        uvpAnalysis,
        actionableContent
      },
      {
        completionTime: Date.now() - new Date(workshopData.startedAt!).getTime(),
        version: '1.0'
      },
      {
        persist: options?.persist,
        shareable: true
      }
    );
  }

  /**
   * Clear all cached results
   */
  public clearCache(): void {
    Object.keys(this.cache).forEach(id => {
      localStorage.removeItem(CACHE_KEY_PREFIX + id);
    });
    this.cache = {};
  }

  /**
   * Get cache status
   */
  public getCacheStatus(): {
    count: number;
    size: number;
    oldest?: Date;
    newest?: Date;
  } {
    const entries = Object.values(this.cache);
    if (entries.length === 0) {
      return { count: 0, size: 0 };
    }

    const timestamps = entries.map(e => e.timestamp);
    const size = JSON.stringify(this.cache).length;

    return {
      count: entries.length,
      size,
      oldest: new Date(Math.min(...timestamps)),
      newest: new Date(Math.max(...timestamps))
    };
  }

  /**
   * Get all results for a user
   */
  public async getUserResults(userId: string): Promise<WorkshopResults[]> {
    const userIndexKey = USER_RESULTS_PREFIX + userId;
    const results: WorkshopResults[] = [];
    
    try {
      const stored = localStorage.getItem(userIndexKey);
      if (!stored) return results;
      
      const userIndex: UserResultsIndex = JSON.parse(stored);
      
      // Load each result
      for (const resultId of userIndex.resultIds) {
        const result = await this.getResults(resultId);
        if (result) {
          results.push(result);
        }
      }
    } catch (error) {
      console.error('Failed to get user results:', error);
    }
    
    return results;
  }

  /**
   * Get recent results (from index)
   */
  public getRecentResults(limit: number = 10): ResultsIndexEntry[] {
    if (!this.resultsIndex) return [];
    
    return this.resultsIndex.entries.slice(0, limit);
  }

  /**
   * Get results by archetype
   */
  public getResultsByArchetype(archetype: string): ResultsIndexEntry[] {
    if (!this.resultsIndex) return [];
    
    return this.resultsIndex.entries.filter(
      entry => entry.archetype.toLowerCase() === archetype.toLowerCase()
    );
  }

  /**
   * Get results within date range
   */
  public getResultsByDateRange(startDate: Date, endDate: Date): ResultsIndexEntry[] {
    if (!this.resultsIndex) return [];
    
    const start = startDate.getTime();
    const end = endDate.getTime();
    
    return this.resultsIndex.entries.filter(entry => {
      const created = new Date(entry.createdAt).getTime();
      return created >= start && created <= end;
    });
  }

  /**
   * Search results by share code
   */
  public async searchByShareCode(shareCode: string): Promise<WorkshopResults | null> {
    if (!this.resultsIndex) return null;
    
    const entry = this.resultsIndex.entries.find(e => e.shareCode === shareCode);
    if (entry) {
      return await this.getResults(entry.id);
    }
    
    return null;
  }

  /**
   * Get results statistics
   */
  public getResultsStatistics(): {
    totalResults: number;
    resultsByArchetype: Record<string, number>;
    averageCompletionTime?: number;
    expiringWithin7Days: number;
  } {
    if (!this.resultsIndex) {
      return {
        totalResults: 0,
        resultsByArchetype: {},
        expiringWithin7Days: 0
      };
    }

    const stats = {
      totalResults: this.resultsIndex.entries.length,
      resultsByArchetype: {} as Record<string, number>,
      expiringWithin7Days: 0
    };

    const sevenDaysFromNow = Date.now() + (7 * 24 * 60 * 60 * 1000);

    this.resultsIndex.entries.forEach(entry => {
      // Count by archetype
      stats.resultsByArchetype[entry.archetype] = 
        (stats.resultsByArchetype[entry.archetype] || 0) + 1;
      
      // Count expiring soon
      if (entry.expiresAt) {
        const expiresAt = new Date(entry.expiresAt).getTime();
        if (expiresAt <= sevenDaysFromNow) {
          stats.expiringWithin7Days++;
        }
      }
    });

    return stats;
  }

  /**
   * Delete specific result
   */
  public async deleteResult(resultId: string, userId?: string): Promise<boolean> {
    try {
      // Remove from cache
      delete this.cache[resultId];
      
      // Remove from localStorage
      localStorage.removeItem(CACHE_KEY_PREFIX + resultId);
      
      // Remove from index
      if (this.resultsIndex) {
        this.resultsIndex.entries = this.resultsIndex.entries.filter(
          e => e.id !== resultId
        );
        this.saveResultsIndex();
      }
      
      // Remove from user index if userId provided
      if (userId) {
        const userIndexKey = USER_RESULTS_PREFIX + userId;
        const stored = localStorage.getItem(userIndexKey);
        
        if (stored) {
          const userIndex: UserResultsIndex = JSON.parse(stored);
          userIndex.resultIds = userIndex.resultIds.filter(id => id !== resultId);
          userIndex.totalCount = userIndex.resultIds.length;
          userIndex.lastUpdated = new Date().toISOString();
          localStorage.setItem(userIndexKey, JSON.stringify(userIndex));
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete result:', error);
      return false;
    }
  }
}

// Export singleton instance
export const resultsService = ResultsService.getInstance();

// Export types
export type { WorkshopResults, ResultsIndexEntry, ResultsIndex, UserResultsIndex };