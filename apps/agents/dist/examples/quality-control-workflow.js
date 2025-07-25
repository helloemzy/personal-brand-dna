"use strict";
/**
 * Example workflow demonstrating the Quality Control Agent
 * checking and improving content quality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalQualityCheck = exports.revisedContent = exports.qualityCheckResult = exports.generatedContent = void 0;
const uuid_1 = require("uuid");
const shared_1 = require("@brandpillar/shared");
// Example: Content generated by Content Generator needs quality check
// Step 1: Content Generator creates content
const generatedContent = {
    id: (0, uuid_1.v4)(),
    userId: 'user-123',
    content: `AI is going to DESTROY all jobs!!!

Everyone says AI will replace humans but here's the SHOCKING truth they dont want you to tell...

I've been working in tech for years and I can gaurantee that AI is actually creating MORE opportunities than it destroys. Just look at the data - companies using AI are hiring 50% more people!

The real problem? People are scared to adapt. But if you embrace AI as a partner, not a threat, you'll see INSANE growth in your career.

Don't be left behind. The future belongs to those who work WITH AI, not against it.

What do you think - are you ready to level up with AI? 🚀

#AI #FutureOfWork #CareerGrowth #Innovation #TechTrends #DigitalTransformation #ArtificialIntelligence #Jobs #Future #Success`,
    contentType: 'post',
    metadata: {
        topic: 'AI transformation',
        pillar: 'Innovation & Future Trends',
        archetype: 'Innovative Leader',
        voiceMatchScore: 0.75
    },
    status: 'draft',
    createdAt: new Date()
};
exports.generatedContent = generatedContent;
// Step 2: Send to Quality Control Agent
const qualityCheckRequest = {
    id: (0, uuid_1.v4)(),
    timestamp: Date.now(),
    source: shared_1.AgentType.CONTENT_GENERATOR,
    target: shared_1.AgentType.QUALITY_CONTROL,
    type: shared_1.MessageType.TASK_REQUEST,
    priority: shared_1.Priority.MEDIUM,
    payload: {
        taskType: 'CHECK_QUALITY',
        data: {
            userId: generatedContent.userId,
            contentId: generatedContent.id,
            content: generatedContent.content,
            contentType: generatedContent.contentType,
            metadata: generatedContent.metadata
        }
    },
    requiresAck: true,
    timeout: 30000
};
// Step 3: Quality Control Agent analyzes content
const qualityCheckResult = {
    approved: false,
    overallScore: 0.58,
    qualityScore: 0.65,
    riskScore: 0.42, // Higher risk due to controversial tone
    brandScore: 0.72,
    factCheckScore: 0.60, // Unverified claim about 50%
    issues: [
        {
            type: 'quality',
            severity: 'high',
            description: 'Grammar and spelling issues detected',
            location: 'gaurantee',
            suggestion: 'Review and correct grammatical errors'
        },
        {
            type: 'risk',
            severity: 'high',
            description: 'Content contains potentially controversial statements',
            location: 'DESTROY all jobs',
            suggestion: 'Consider rephrasing controversial sections'
        },
        {
            type: 'quality',
            severity: 'medium',
            description: 'Excessive use of capital letters',
            suggestion: 'Reduce capitalization for better readability'
        },
        {
            type: 'fact',
            severity: 'medium',
            description: '1 unverified claims found',
            suggestion: 'Add sources or rephrase unverifiable claims'
        },
        {
            type: 'quality',
            severity: 'low',
            description: 'Too many hashtags',
            suggestion: 'Reduce to 3-5 most relevant hashtags'
        }
    ],
    suggestions: [
        'Replace "DESTROY" with more measured language like "transform" or "change"',
        'Fix spelling: "gaurantee" should be "guarantee"',
        'Add a source for the "50% more people" claim or rephrase as an observation',
        'Reduce CAPS usage - use emphasis more sparingly',
        'Keep only the 5 most relevant hashtags'
    ],
    requiresRevision: true
};
exports.qualityCheckResult = qualityCheckResult;
// Step 4: Quality Control requests revision from Content Generator
const revisionRequest = {
    id: (0, uuid_1.v4)(),
    timestamp: Date.now(),
    source: shared_1.AgentType.QUALITY_CONTROL,
    target: shared_1.AgentType.CONTENT_GENERATOR,
    type: shared_1.MessageType.TASK_REQUEST,
    priority: shared_1.Priority.HIGH,
    payload: {
        taskType: 'REVISE_CONTENT',
        data: {
            originalContent: generatedContent.content,
            contentId: generatedContent.id,
            userId: generatedContent.userId,
            issues: qualityCheckResult.issues,
            suggestions: qualityCheckResult.suggestions,
            scores: {
                quality: qualityCheckResult.qualityScore,
                risk: qualityCheckResult.riskScore,
                brand: qualityCheckResult.brandScore,
                factCheck: qualityCheckResult.factCheckScore
            }
        }
    },
    requiresAck: true,
    timeout: 60000
};
// Step 5: Content Generator creates revised version
const revisedContent = {
    id: (0, uuid_1.v4)(),
    userId: 'user-123',
    content: `Here's what I'm seeing in the AI transformation:

The conversation around AI replacing jobs misses the bigger picture. From my experience in tech, I'm witnessing companies that embrace AI actually expanding their teams - not shrinking them.

The key insight? AI handles repetitive tasks, freeing humans to focus on creativity, strategy, and relationship-building. This shift creates new roles we haven't even imagined yet.

Yes, adaptation is challenging. But those who view AI as a collaborative partner rather than a competitor are already seeing remarkable career growth.

The future isn't about humans versus AI - it's about humans with AI, creating value that neither could achieve alone.

What's your take on this transformation? Are you exploring ways to work alongside AI?

#AITransformation #FutureOfWork #Innovation #CareerGrowth #TechLeadership`,
    contentType: 'post',
    status: 'revised',
    metadata: {
        topic: 'AI transformation',
        pillar: 'Innovation & Future Trends',
        archetype: 'Innovative Leader',
        voiceMatchScore: 0.88,
        revisionReason: 'Grammar and spelling issues detected; Content contains potentially controversial statements; Excessive use of capital letters; 1 unverified claims found; Too many hashtags',
        originalScores: {
            quality: 0.65,
            risk: 0.42,
            brand: 0.72,
            factCheck: 0.60
        }
    },
    createdAt: new Date()
};
exports.revisedContent = revisedContent;
// Step 6: Quality Control re-checks revised content
const finalQualityCheck = {
    approved: true,
    overallScore: 0.86,
    qualityScore: 0.92,
    riskScore: 0.15, // Much lower risk
    brandScore: 0.88,
    factCheckScore: 0.85, // Better with observation framing
    issues: [], // No critical issues
    suggestions: [],
    requiresRevision: false
};
exports.finalQualityCheck = finalQualityCheck;
// Step 7: Approved content sent to Publisher Agent
const publishRequest = {
    id: (0, uuid_1.v4)(),
    timestamp: Date.now(),
    source: shared_1.AgentType.QUALITY_CONTROL,
    target: shared_1.AgentType.PUBLISHER,
    type: shared_1.MessageType.TASK_REQUEST,
    priority: shared_1.Priority.MEDIUM,
    payload: {
        taskType: 'PUBLISH_CONTENT',
        data: {
            content: revisedContent,
            platform: 'linkedin',
            scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
            qualityApproved: true,
            qualityScore: finalQualityCheck.overallScore
        }
    },
    requiresAck: true,
    timeout: 30000
};
// Example output
console.log('=== Quality Control Workflow Example ===\n');
console.log('1. Original Content Issues:');
console.log(`   Quality Score: ${(qualityCheckResult.qualityScore * 100).toFixed(0)}%`);
console.log(`   Risk Score: ${(qualityCheckResult.riskScore * 100).toFixed(0)}%`);
console.log(`   Issues Found: ${qualityCheckResult.issues.length}`);
qualityCheckResult.issues.forEach(issue => {
    console.log(`   - [${issue.severity.toUpperCase()}] ${issue.description}`);
});
console.log('\n2. Revision Process:');
console.log('   Status: Content sent back for revision');
console.log('   Suggestions provided: ' + qualityCheckResult.suggestions.length);
console.log('\n3. Revised Content Results:');
console.log(`   Quality Score: ${(finalQualityCheck.qualityScore * 100).toFixed(0)}% (+${((finalQualityCheck.qualityScore - qualityCheckResult.qualityScore) * 100).toFixed(0)}%)`);
console.log(`   Risk Score: ${(finalQualityCheck.riskScore * 100).toFixed(0)}% (-${((qualityCheckResult.riskScore - finalQualityCheck.riskScore) * 100).toFixed(0)}%)`);
console.log(`   Voice Match: ${(revisedContent.metadata.voiceMatchScore * 100).toFixed(0)}%`);
console.log(`   Status: APPROVED ✓`);
console.log('\n4. Key Improvements:');
console.log('   - Removed inflammatory language');
console.log('   - Fixed spelling and grammar');
console.log('   - Reduced excessive capitalization');
console.log('   - Reframed claims as observations');
console.log('   - Optimized hashtag count');
console.log('\n5. Final Content Preview:');
console.log(revisedContent.content.split('\n').map(line => `   ${line}`).join('\n'));
//# sourceMappingURL=quality-control-workflow.js.map