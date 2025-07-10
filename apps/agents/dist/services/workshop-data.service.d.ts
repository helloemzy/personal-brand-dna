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
export declare class WorkshopDataService {
    private supabase;
    private cache;
    private cacheTimeout;
    constructor();
    getWorkshopData(userId: string): Promise<WorkshopData | null>;
    saveVoiceProfile(userId: string, voiceProfile: any): Promise<void>;
    getUserIds(): Promise<string[]>;
    private generateDefaultPillars;
    clearCache(userId?: string): void;
}
export declare const workshopDataService: WorkshopDataService;
