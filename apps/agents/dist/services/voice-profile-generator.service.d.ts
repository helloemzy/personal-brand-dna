import { VoiceProfile } from '@brandpillar/shared';
import { WorkshopData } from './workshop-data.service';
export declare class VoiceProfileGeneratorService {
    private openai;
    constructor();
    generateVoiceProfile(workshopData: WorkshopData): Promise<VoiceProfile>;
    private extractLinguisticPatterns;
    private analyzeRhythmPatterns;
    private derivePersonalityMarkers;
    private buildVocabulary;
    private calculateTone;
    private validateAndEnhanceProfile;
    private getDefaultVoiceProfile;
    private getDefaultLinguisticPatterns;
    private getArchetypeSentenceStarters;
    private getArchetypeTransitions;
    private getArchetypeSignatures;
}
export declare const voiceProfileGenerator: VoiceProfileGeneratorService;
