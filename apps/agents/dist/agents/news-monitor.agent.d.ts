import { BaseAgent } from '../framework/base-agent';
import { Task } from '@brandpillar/shared';
export declare class NewsMonitorAgent extends BaseAgent {
    private parser;
    private feedSources;
    private checkInterval;
    private monitoringTimer?;
    constructor();
    initialize(): Promise<void>;
    processTask(task: Task): Promise<any>;
    validateTask(task: Task): Promise<boolean>;
    private loadDefaultFeeds;
    private startMonitoring;
    private addFeed;
    private removeFeed;
    private checkUserFeeds;
    private createOpportunity;
    private calculateRelevance;
    private calculateVirality;
    private calculateCompetitiveAdvantage;
    private extractKeywords;
    private getRecentOpportunities;
    private getAllUsers;
    stop(): Promise<void>;
}
