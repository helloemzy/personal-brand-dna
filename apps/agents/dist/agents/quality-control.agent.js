"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityControlAgent = void 0;
const base_agent_1 = require("../base/base-agent");
const shared_1 = require("@brandpillar/shared");
const openai_1 = __importDefault(require("openai"));
class QualityControlAgent extends base_agent_1.BaseAgent {
    openai;
    QUALITY_THRESHOLD = 0.7;
    RISK_THRESHOLD = 0.3;
    BRAND_THRESHOLD = 0.8;
    constructor(logger) {
        super(shared_1.AgentType.QUALITY_CONTROL, logger);
        this.openai = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    async processTask(message) {
        const { taskType, data } = message.payload;
        switch (taskType) {
            case 'CHECK_QUALITY':
                await this.handleQualityCheck(data);
                break;
            case 'VALIDATE_BATCH':
                await this.handleBatchValidation(data);
                break;
            case 'UPDATE_STANDARDS':
                await this.handleStandardsUpdate(data);
                break;
            default:
                this.logger.warn(`Unknown task type: ${taskType}`);
        }
    }
    async handleQualityCheck(request) {
        try {
            this.logger.info({ contentId: request.contentId }, 'Starting quality check');
            // Perform comprehensive validation
            const result = await this.validateContent(request);
            // Send result to orchestrator
            await this.sendMessage({
                id: this.generateId(),
                timestamp: Date.now(),
                source: this.agentType,
                target: shared_1.AgentType.ORCHESTRATOR,
                type: shared_1.MessageType.TASK_COMPLETE,
                priority: shared_1.Priority.MEDIUM,
                payload: {
                    taskType: 'QUALITY_CHECK_COMPLETE',
                    data: {
                        contentId: request.contentId,
                        result
                    }
                },
                requiresAck: false
            });
            // If content needs revision, send to content generator
            if (result.requiresRevision && !result.approved) {
                await this.requestRevision(request, result);
            }
        }
        catch (error) {
            this.logger.error({ error, contentId: request.contentId }, 'Quality check failed');
            throw error;
        }
    }
    async validateContent(request) {
        const [qualityMetrics, riskAssessment, brandAlignment, factCheck] = await Promise.all([
            this.assessQuality(request.content),
            this.assessRisks(request.content),
            this.validateBrandAlignment(request),
            this.verifyFacts(request.content)
        ]);
        const issues = this.collectIssues(qualityMetrics, riskAssessment, brandAlignment, factCheck);
        const suggestions = await this.generateSuggestions(request.content, issues);
        const qualityScore = this.calculateQualityScore(qualityMetrics);
        const riskScore = this.calculateRiskScore(riskAssessment);
        const brandScore = this.calculateBrandScore(brandAlignment);
        const factCheckScore = this.calculateFactCheckScore(factCheck);
        const overallScore = this.calculateOverallScore({
            quality: qualityScore,
            risk: riskScore,
            brand: brandScore,
            factCheck: factCheckScore
        });
        const approved = this.determineApproval(qualityScore, riskScore, brandScore, factCheckScore);
        const requiresRevision = !approved && this.canBeRevised(issues);
        return {
            approved,
            overallScore,
            qualityScore,
            riskScore,
            brandScore,
            factCheckScore,
            issues,
            suggestions,
            requiresRevision
        };
    }
    async assessQuality(content) {
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{
                    role: 'system',
                    content: `You are a professional content quality assessor. Analyze the following content and score each metric from 0 to 1.`
                }, {
                    role: 'user',
                    content: `Analyze this content for quality:

${content}

Score the following metrics (0-1):
1. Grammar and spelling accuracy
2. Readability and flow
3. Engagement potential
4. Clarity of message
5. Structural coherence

Return JSON with scores for: grammar, readability, engagement, clarity, structure`
                }],
            response_format: { type: "json_object" },
            temperature: 0.3
        });
        const scores = JSON.parse(response.choices[0].message.content || '{}');
        return {
            grammar: scores.grammar || 0,
            readability: scores.readability || 0,
            engagement: scores.engagement || 0,
            clarity: scores.clarity || 0,
            structure: scores.structure || 0
        };
    }
    async assessRisks(content) {
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{
                    role: 'system',
                    content: `You are a risk assessment specialist. Analyze content for potential risks.`
                }, {
                    role: 'user',
                    content: `Assess risks in this content:

${content}

Score each risk type (0-1, where 0 is no risk and 1 is high risk):
1. Controversial topics or statements
2. Potentially misleading information
3. Offensive or inappropriate language
4. Legal liability risks
5. Reputation damage potential

Return JSON with scores for: controversial, misleading, offensive, legal, reputation`
                }],
            response_format: { type: "json_object" },
            temperature: 0.3
        });
        const risks = JSON.parse(response.choices[0].message.content || '{}');
        return {
            controversial: risks.controversial || 0,
            misleading: risks.misleading || 0,
            offensive: risks.offensive || 0,
            legal: risks.legal || 0,
            reputation: risks.reputation || 0
        };
    }
    async validateBrandAlignment(request) {
        const { content, metadata } = request;
        // If we don't have archetype data, return neutral scores
        if (!metadata?.archetype) {
            return {
                valueAlignment: 0.8,
                toneConsistency: 0.8,
                messagingAlignment: 0.8,
                archetypeMatch: 0.8
            };
        }
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{
                    role: 'system',
                    content: `You are a brand alignment specialist. Analyze content for brand consistency.`
                }, {
                    role: 'user',
                    content: `Analyze brand alignment for this ${metadata.archetype} archetype content:

${content}

The content should align with:
- Archetype: ${metadata.archetype}
- Content Pillar: ${metadata.pillar || 'Not specified'}
- Topic: ${metadata.topic || 'Not specified'}

Score alignment (0-1) for:
1. Value alignment with archetype
2. Tone consistency
3. Messaging alignment
4. Archetype personality match

Return JSON with scores for: valueAlignment, toneConsistency, messagingAlignment, archetypeMatch`
                }],
            response_format: { type: "json_object" },
            temperature: 0.3
        });
        const alignment = JSON.parse(response.choices[0].message.content || '{}');
        return {
            valueAlignment: alignment.valueAlignment || 0,
            toneConsistency: alignment.toneConsistency || 0,
            messagingAlignment: alignment.messagingAlignment || 0,
            archetypeMatch: alignment.archetypeMatch || 0
        };
    }
    async verifyFacts(content) {
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{
                    role: 'system',
                    content: `You are a fact-checking specialist. Identify and verify factual claims.`
                }, {
                    role: 'user',
                    content: `Identify factual claims in this content and assess their verifiability:

${content}

For each claim:
1. Extract the specific claim
2. Assess confidence in its accuracy (0-1)
3. Determine status: verified, unverified, or disputed

Return JSON with:
- verified: boolean (overall verification status)
- claims: array of {claim, confidence, status}`
                }],
            response_format: { type: "json_object" },
            temperature: 0.3
        });
        const result = JSON.parse(response.choices[0].message.content || '{}');
        return {
            verified: result.verified || false,
            claims: result.claims || []
        };
    }
    collectIssues(quality, risks, brand, factCheck) {
        const issues = [];
        // Quality issues
        if (quality.grammar < 0.8) {
            issues.push({
                type: 'quality',
                severity: quality.grammar < 0.6 ? 'high' : 'medium',
                description: 'Grammar and spelling issues detected',
                suggestion: 'Review and correct grammatical errors'
            });
        }
        if (quality.clarity < 0.7) {
            issues.push({
                type: 'quality',
                severity: 'medium',
                description: 'Message clarity could be improved',
                suggestion: 'Simplify language and clarify main points'
            });
        }
        // Risk issues
        if (risks.controversial > 0.5) {
            issues.push({
                type: 'risk',
                severity: risks.controversial > 0.7 ? 'critical' : 'high',
                description: 'Content contains potentially controversial statements',
                suggestion: 'Consider rephrasing controversial sections'
            });
        }
        if (risks.misleading > 0.4) {
            issues.push({
                type: 'risk',
                severity: 'high',
                description: 'Content may contain misleading information',
                suggestion: 'Verify claims and add clarifications'
            });
        }
        // Brand issues
        if (brand.archetypeMatch < 0.7) {
            issues.push({
                type: 'brand',
                severity: 'medium',
                description: 'Content doesn\'t fully align with brand archetype',
                suggestion: 'Adjust tone to better match archetype personality'
            });
        }
        // Fact-checking issues
        const unverifiedClaims = factCheck.claims.filter(c => c.status === 'unverified');
        if (unverifiedClaims.length > 0) {
            issues.push({
                type: 'fact',
                severity: 'medium',
                description: `${unverifiedClaims.length} unverified claims found`,
                suggestion: 'Add sources or rephrase unverifiable claims'
            });
        }
        return issues;
    }
    async generateSuggestions(content, issues) {
        if (issues.length === 0)
            return [];
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{
                    role: 'system',
                    content: `You are a content improvement specialist. Provide actionable suggestions.`
                }, {
                    role: 'user',
                    content: `Based on these issues found in the content:

${issues.map(i => `- ${i.description}`).join('\n')}

Provide 3-5 specific, actionable suggestions to improve the content.

Content:
${content}`
                }],
            temperature: 0.4,
            max_tokens: 500
        });
        const suggestions = response.choices[0].message.content || '';
        return suggestions.split('\n').filter(s => s.trim()).slice(0, 5);
    }
    calculateQualityScore(metrics) {
        const weights = {
            grammar: 0.25,
            readability: 0.2,
            engagement: 0.25,
            clarity: 0.2,
            structure: 0.1
        };
        return Object.entries(metrics).reduce((score, [key, value]) => {
            return score + (value * weights[key]);
        }, 0);
    }
    calculateRiskScore(risks) {
        const weights = {
            controversial: 0.3,
            misleading: 0.25,
            offensive: 0.2,
            legal: 0.15,
            reputation: 0.1
        };
        return Object.entries(risks).reduce((score, [key, value]) => {
            return score + (value * weights[key]);
        }, 0);
    }
    calculateBrandScore(alignment) {
        const weights = {
            valueAlignment: 0.3,
            toneConsistency: 0.3,
            messagingAlignment: 0.2,
            archetypeMatch: 0.2
        };
        return Object.entries(alignment).reduce((score, [key, value]) => {
            return score + (value * weights[key]);
        }, 0);
    }
    calculateFactCheckScore(factCheck) {
        if (factCheck.claims.length === 0)
            return 1; // No claims to verify
        const verifiedClaims = factCheck.claims.filter(c => c.status === 'verified').length;
        const disputedClaims = factCheck.claims.filter(c => c.status === 'disputed').length;
        // Penalize disputed claims more heavily
        const score = (verifiedClaims - disputedClaims * 2) / factCheck.claims.length;
        return Math.max(0, Math.min(1, (score + 1) / 2)); // Normalize to 0-1
    }
    calculateOverallScore(scores) {
        // Risk is inverted (lower is better)
        const invertedRisk = 1 - scores.risk;
        const weights = {
            quality: 0.3,
            risk: 0.3,
            brand: 0.2,
            factCheck: 0.2
        };
        return (scores.quality * weights.quality +
            invertedRisk * weights.risk +
            scores.brand * weights.brand +
            scores.factCheck * weights.factCheck);
    }
    determineApproval(quality, risk, brand, factCheck) {
        // Must meet all thresholds
        return (quality >= this.QUALITY_THRESHOLD &&
            risk <= this.RISK_THRESHOLD &&
            brand >= this.BRAND_THRESHOLD &&
            factCheck >= 0.7);
    }
    canBeRevised(issues) {
        // Can't revise if there are critical issues
        const criticalIssues = issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0)
            return false;
        // Can revise if issues are addressable
        const highIssues = issues.filter(i => i.severity === 'high');
        return highIssues.length <= 2; // Allow up to 2 high severity issues
    }
    async requestRevision(request, result) {
        await this.sendMessage({
            id: this.generateId(),
            timestamp: Date.now(),
            source: this.agentType,
            target: shared_1.AgentType.CONTENT_GENERATOR,
            type: shared_1.MessageType.TASK_REQUEST,
            priority: shared_1.Priority.HIGH,
            payload: {
                taskType: 'REVISE_CONTENT',
                data: {
                    originalContent: request.content,
                    contentId: request.contentId,
                    userId: request.userId,
                    issues: result.issues,
                    suggestions: result.suggestions,
                    scores: {
                        quality: result.qualityScore,
                        risk: result.riskScore,
                        brand: result.brandScore,
                        factCheck: result.factCheckScore
                    }
                }
            },
            requiresAck: true,
            timeout: 60000
        });
    }
    async handleBatchValidation(batch) {
        // Process batch in parallel with concurrency limit
        const BATCH_SIZE = 5;
        const results = [];
        for (let i = 0; i < batch.length; i += BATCH_SIZE) {
            const chunk = batch.slice(i, i + BATCH_SIZE);
            const chunkResults = await Promise.all(chunk.map(request => this.validateContent(request)));
            results.push(...chunkResults);
        }
        // Send batch results
        await this.sendMessage({
            id: this.generateId(),
            timestamp: Date.now(),
            source: this.agentType,
            target: shared_1.AgentType.ORCHESTRATOR,
            type: shared_1.MessageType.TASK_COMPLETE,
            priority: shared_1.Priority.MEDIUM,
            payload: {
                taskType: 'BATCH_VALIDATION_COMPLETE',
                data: {
                    results,
                    summary: {
                        total: batch.length,
                        approved: results.filter(r => r.approved).length,
                        rejected: results.filter(r => !r.approved).length,
                        requiresRevision: results.filter(r => r.requiresRevision).length
                    }
                }
            },
            requiresAck: false
        });
    }
    async handleStandardsUpdate(standards) {
        // Update quality thresholds and standards
        this.logger.info({ standards }, 'Updating quality standards');
        // In a real implementation, this would update configuration
        // For now, we acknowledge the update
        await this.sendMessage({
            id: this.generateId(),
            timestamp: Date.now(),
            source: this.agentType,
            target: shared_1.AgentType.ORCHESTRATOR,
            type: shared_1.MessageType.TASK_COMPLETE,
            priority: shared_1.Priority.LOW,
            payload: {
                taskType: 'STANDARDS_UPDATE_COMPLETE',
                data: { success: true }
            },
            requiresAck: false
        });
    }
}
exports.QualityControlAgent = QualityControlAgent;
//# sourceMappingURL=quality-control.agent.js.map