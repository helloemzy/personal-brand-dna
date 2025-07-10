import { BaseAgent } from '../base/base-agent';
import { AgentMessage } from '@brandpillar/shared';
import { Logger } from 'pino';
export declare class QualityControlAgent extends BaseAgent {
    private openai;
    private readonly QUALITY_THRESHOLD;
    private readonly RISK_THRESHOLD;
    private readonly BRAND_THRESHOLD;
    constructor(logger: Logger);
    protected processTask(message: AgentMessage): Promise<void>;
    private handleQualityCheck;
    private validateContent;
    private assessQuality;
    private assessRisks;
    private validateBrandAlignment;
    private verifyFacts;
    private collectIssues;
    private generateSuggestions;
    private calculateQualityScore;
    private calculateRiskScore;
    private calculateBrandScore;
    private calculateFactCheckScore;
    private calculateOverallScore;
    private determineApproval;
    private canBeRevised;
    private requestRevision;
    private handleBatchValidation;
    private handleStandardsUpdate;
}
