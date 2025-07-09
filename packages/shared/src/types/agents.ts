// Agent Types
export enum AgentType {
  NEWS_MONITOR = 'NEWS_MONITOR',
  CONTENT_GENERATOR = 'CONTENT_GENERATOR',
  QUALITY_CONTROL = 'QUALITY_CONTROL',
  PUBLISHER = 'PUBLISHER',
  LEARNING = 'LEARNING',
  ORCHESTRATOR = 'ORCHESTRATOR'
}

// Message Types
export enum MessageType {
  TASK_REQUEST = 'TASK_REQUEST',
  TASK_RESULT = 'TASK_RESULT',
  STATUS_UPDATE = 'STATUS_UPDATE',
  ERROR_REPORT = 'ERROR_REPORT',
  COORDINATION = 'COORDINATION',
  LEARNING_UPDATE = 'LEARNING_UPDATE'
}

// Priority Levels
export enum Priority {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 10,
  CRITICAL = 20
}

// Task Status
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Retry Policy
export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

// Agent Message Interface
export interface AgentMessage {
  id: string;
  timestamp: number;
  source: AgentType;
  target: AgentType | 'broadcast';
  type: MessageType;
  priority: Priority;
  payload: any;
  requiresAck: boolean;
  timeout: number;
  retryPolicy?: RetryPolicy;
}

// Task Interface
export interface Task {
  id: string;
  userId: string;
  agentType: AgentType;
  taskType: string;
  status: TaskStatus;
  priority: Priority;
  payload: any;
  result?: any;
  error?: any;
  retryCount: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Agent Health Status
export interface HealthStatus {
  isHealthy: boolean;
  lastHealthCheck: Date;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  averageTaskDuration: number;
}

// News Opportunity Interface
export interface NewsOpportunity {
  id: string;
  userId: string;
  sourceUrl: string;
  title: string;
  summary?: string;
  publishedAt: Date;
  relevanceScore: number;
  viralityScore: number;
  competitiveScore: number;
  contentPillars: string[];
  keywords: string[];
  status: 'new' | 'processed' | 'rejected';
  createdAt: Date;
}

// Generated Content Interface
export interface GeneratedContent {
  id: string;
  userId: string;
  opportunityId?: string;
  content: string;
  contentType: 'post' | 'article' | 'comment';
  angle?: string;
  voiceMatchScore: number;
  qualityScore: number;
  riskScore: number;
  status: 'draft' | 'approved' | 'published' | 'rejected';
  variations?: ContentVariation[];
  metadata: Record<string, any>;
  createdAt: Date;
}

// Content Variation Interface
export interface ContentVariation {
  id: string;
  content: string;
  style: 'professional' | 'casual' | 'storytelling' | 'educational';
  score: number;
}

// Quality Control Result Interface
export interface QualityControlResult {
  contentId: string;
  qualityChecks: {
    grammar: boolean;
    spelling: boolean;
    readability: number;
    engagement: number;
    brandAlignment: number;
  };
  riskAssessment: {
    controversial: number;
    misleading: number;
    offensive: number;
    legal: number;
    reputation: number;
  };
  factVerification?: {
    verified: boolean;
    sources: string[];
    confidence: number;
  };
  complianceStatus: {
    platformPolicy: boolean;
    industryRegulations: boolean;
    copyright: boolean;
    pii: boolean;
  };
  overallScore: number;
  passed: boolean;
  rejectionReasons?: string[];
}

// Voice Profile Interface
export interface VoiceProfile {
  userId: string;
  linguisticPatterns: {
    sentenceStarters: string[];
    transitions: string[];
    emphasisPatterns: string[];
    signaturePhrases: string[];
    fillerWords: string[];
  };
  rhythmPatterns: {
    sentenceVariation: string;
    paragraphStructure: string;
    punctuationStyle: string;
    pacing: string;
  };
  personalityMarkers: {
    humorStyle: string;
    emotionalRange: string;
    certaintyLevel: string;
    storytelling: string;
  };
  vocabulary: {
    commonWords: string[];
    industryTerms: string[];
    avoidWords: string[];
  };
  tone: {
    formality: number; // 0-1
    analytical: number; // 0-1
    empathetic: number; // 0-1
    assertive: number; // 0-1
  };
}