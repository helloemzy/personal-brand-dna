/**
 * Example workflow demonstrating how the agents work together
 * to generate content from news opportunities
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentMessage, AgentType, MessageType, Priority, NewsOpportunity } from '@brandpillar/shared';

// Example: User has completed workshop and wants automated content

// Step 1: News Monitor Agent finds relevant opportunity
const newsOpportunity: NewsOpportunity = {
  id: uuidv4(),
  userId: 'user-123',
  sourceUrl: 'https://techcrunch.com/2024/01/08/ai-transformation',
  title: 'AI Set to Transform Professional Services in 2024',
  summary: 'New research shows AI adoption in professional services will triple this year...',
  publishedAt: new Date(),
  relevanceScore: 0.92,
  viralityScore: 0.85,
  competitiveScore: 0.78,
  contentPillars: ['Innovation & Future Trends'],
  keywords: ['AI', 'transformation', 'professional services', 'automation'],
  status: 'new',
  createdAt: new Date()
};

// Step 2: Orchestrator receives news opportunity and assigns to Content Generator
const orchestratorMessage: AgentMessage = {
  id: uuidv4(),
  timestamp: Date.now(),
  source: AgentType.NEWS_MONITOR,
  target: AgentType.ORCHESTRATOR,
  type: MessageType.TASK_REQUEST,
  priority: Priority.HIGH,
  payload: {
    userId: 'user-123',
    taskType: 'PROCESS_OPPORTUNITY',
    data: newsOpportunity
  },
  requiresAck: true,
  timeout: 30000
};

// Step 3: Orchestrator creates task for Content Generator
const contentGenerationTask: AgentMessage = {
  id: uuidv4(),
  timestamp: Date.now(),
  source: AgentType.ORCHESTRATOR,
  target: AgentType.CONTENT_GENERATOR,
  type: MessageType.TASK_REQUEST,
  priority: Priority.HIGH,
  payload: {
    userId: 'user-123',
    taskType: 'GENERATE_FROM_NEWS',
    data: {
      opportunity: newsOpportunity,
      angle: 'industry insight' // Based on user's archetype
    }
  },
  requiresAck: true,
  timeout: 60000
};

// Step 4: Content Generator creates content
const generatedContent = {
  id: uuidv4(),
  userId: 'user-123',
  opportunityId: newsOpportunity.id,
  content: `Here's what I'm seeing in the AI revolution:

The latest research shows AI adoption in professional services will triple this year. But here's the breakthrough - it's not about replacing humans, it's about amplifying our unique value.

I've been working with teams navigating this shift, and the pattern is clear: those who embrace AI as a creative partner are seeing 10x productivity gains while delivering MORE human value, not less.

The game-changer? AI handles the repetitive work, freeing us to focus on strategy, relationships, and innovation - the things that actually transform businesses.

We're not just adapting to change. We're leading it.

What's your take - is your industry ready for this acceleration?

#InnovativeLeadership #AITransformation #FutureOfWork #ProfessionalGrowth`,
  contentType: 'post',
  angle: 'industry insight',
  voiceMatchScore: 0.89,
  qualityScore: 0.86,
  riskScore: 0.12,
  status: 'draft',
  metadata: {
    topic: 'AI transformation',
    pillar: 'Innovation & Future Trends',
    hook: "Here's what I'm seeing in the AI revolution",
    cta: "What's your take - is your industry ready for this acceleration?",
    keywords: ['AI', 'transformation', 'innovation', 'leadership'],
    estimatedReadTime: 1,
    characterCount: 542,
    hashtagSuggestions: ['#InnovativeLeadership', '#AITransformation', '#FutureOfWork', '#ProfessionalGrowth']
  },
  createdAt: new Date()
};

// Step 5: Content goes to Quality Control Agent (not implemented yet)
const qualityCheckTask: AgentMessage = {
  id: uuidv4(),
  timestamp: Date.now(),
  source: AgentType.CONTENT_GENERATOR,
  target: AgentType.QUALITY_CONTROL,
  type: MessageType.TASK_REQUEST,
  priority: Priority.MEDIUM,
  payload: {
    userId: 'user-123',
    taskType: 'CHECK_QUALITY',
    data: generatedContent
  },
  requiresAck: true,
  timeout: 30000
};

// Step 6: If approved, goes to Publisher Agent (not implemented yet)
const publishTask: AgentMessage = {
  id: uuidv4(),
  timestamp: Date.now(),
  source: AgentType.QUALITY_CONTROL,
  target: AgentType.PUBLISHER,
  type: MessageType.TASK_REQUEST,
  priority: Priority.MEDIUM,
  payload: {
    userId: 'user-123',
    taskType: 'PUBLISH_CONTENT',
    data: {
      content: generatedContent,
      platform: 'linkedin',
      scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
    }
  },
  requiresAck: true,
  timeout: 30000
};

// Step 7: Learning Agent analyzes performance (not implemented yet)
const learningTask: AgentMessage = {
  id: uuidv4(),
  timestamp: Date.now(),
  source: AgentType.PUBLISHER,
  target: AgentType.LEARNING,
  type: MessageType.TASK_REQUEST,
  priority: Priority.LOW,
  payload: {
    userId: 'user-123',
    taskType: 'ANALYZE_PERFORMANCE',
    data: {
      contentId: generatedContent.id,
      metrics: {
        views: 1250,
        likes: 89,
        comments: 12,
        shares: 5,
        clickThroughRate: 0.045
      }
    }
  },
  requiresAck: false,
  timeout: 60000
};

// Example output to console
console.log('=== Content Generation Workflow Example ===\n');
console.log('1. News Opportunity Found:');
console.log(`   Title: ${newsOpportunity.title}`);
console.log(`   Relevance: ${newsOpportunity.relevanceScore}`);
console.log(`   Keywords: ${newsOpportunity.keywords.join(', ')}\n`);

console.log('2. Generated Content:');
console.log(`   Voice Match: ${generatedContent.voiceMatchScore}`);
console.log(`   Quality Score: ${generatedContent.qualityScore}`);
console.log(`   Risk Score: ${generatedContent.riskScore}`);
console.log(`   Character Count: ${generatedContent.metadata.characterCount}\n`);

console.log('3. Content Preview:');
console.log(generatedContent.content.split('\n').map(line => `   ${line}`).join('\n'));
console.log('\n4. Suggested Hashtags:');
console.log(`   ${generatedContent.metadata.hashtagSuggestions.join(' ')}\n`);

console.log('This content would then be checked for quality, published at the optimal time,');
console.log('and analyzed for performance to improve future content generation.');

export { newsOpportunity, generatedContent };