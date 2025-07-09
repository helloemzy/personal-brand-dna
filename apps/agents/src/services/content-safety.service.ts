import { Logger } from 'pino';

interface SafetyCheckResult {
  safe: boolean;
  issues: SafetyIssue[];
  score: number;
  categories: {
    hate: number;
    harassment: number;
    violence: number;
    selfHarm: number;
    sexual: number;
    dangerous: number;
  };
}

interface SafetyIssue {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
}

export class ContentSafetyService {
  private logger: Logger;
  
  // Comprehensive list of problematic terms and patterns
  private readonly BLOCKED_TERMS = new Set([
    // Add actual blocked terms in production
  ]);

  private readonly SENSITIVE_TOPICS = [
    'politics',
    'religion',
    'health_claims',
    'financial_advice',
    'legal_advice',
    'discrimination',
    'violence',
    'adult_content'
  ];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async checkSafety(content: string): Promise<SafetyCheckResult> {
    const issues: SafetyIssue[] = [];
    
    // Check for blocked terms
    const blockedTermsFound = this.checkBlockedTerms(content);
    issues.push(...blockedTermsFound);

    // Check for sensitive topics
    const sensitiveTopics = await this.detectSensitiveTopics(content);
    issues.push(...sensitiveTopics);

    // Check for harmful patterns
    const harmfulPatterns = this.detectHarmfulPatterns(content);
    issues.push(...harmfulPatterns);

    // Calculate category scores
    const categories = await this.categorizeContent(content);

    // Calculate overall safety score
    const score = this.calculateSafetyScore(issues, categories);
    const safe = score > 0.8 && issues.filter(i => i.severity === 'critical').length === 0;

    return {
      safe,
      issues,
      score,
      categories
    };
  }

  private checkBlockedTerms(content: string): SafetyIssue[] {
    const issues: SafetyIssue[] = [];
    const lowerContent = content.toLowerCase();

    for (const term of this.BLOCKED_TERMS) {
      if (lowerContent.includes(term)) {
        issues.push({
          category: 'blocked_term',
          severity: 'high',
          description: `Content contains blocked term`,
          location: term
        });
      }
    }

    return issues;
  }

  private async detectSensitiveTopics(content: string): Promise<SafetyIssue[]> {
    const issues: SafetyIssue[] = [];
    
    // Topic detection patterns
    const patterns = {
      politics: /\b(election|politician|democrat|republican|liberal|conservative|government|policy)\b/gi,
      religion: /\b(god|jesus|allah|buddha|religion|faith|church|mosque|temple|bible|quran)\b/gi,
      health_claims: /\b(cure|treatment|medical|disease|symptom|diagnosis|therapy|medication)\b/gi,
      financial_advice: /\b(invest|stock|crypto|trading|profit|guaranteed|return|financial advice)\b/gi,
      legal_advice: /\b(legal|lawyer|lawsuit|court|rights|attorney|prosecution|defense)\b/gi
    };

    for (const [topic, pattern] of Object.entries(patterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 2) { // More than 2 matches suggests topic focus
        issues.push({
          category: 'sensitive_topic',
          severity: 'medium',
          description: `Content heavily focuses on ${topic.replace('_', ' ')}`,
          location: matches.join(', ')
        });
      }
    }

    return issues;
  }

  private detectHarmfulPatterns(content: string): SafetyIssue[] {
    const issues: SafetyIssue[] = [];

    // Check for manipulation patterns
    if (this.detectManipulation(content)) {
      issues.push({
        category: 'manipulation',
        severity: 'high',
        description: 'Content contains manipulative language patterns'
      });
    }

    // Check for clickbait
    if (this.detectClickbait(content)) {
      issues.push({
        category: 'clickbait',
        severity: 'low',
        description: 'Content uses clickbait tactics'
      });
    }

    // Check for spam patterns
    if (this.detectSpam(content)) {
      issues.push({
        category: 'spam',
        severity: 'medium',
        description: 'Content exhibits spam-like characteristics'
      });
    }

    return issues;
  }

  private detectManipulation(content: string): boolean {
    const manipulationPatterns = [
      /you\s+must\s+act\s+now/i,
      /limited\s+time\s+only/i,
      /don't\s+miss\s+out/i,
      /guaranteed\s+success/i,
      /secret\s+they\s+don't\s+want/i,
      /doctors\s+hate\s+this/i
    ];

    return manipulationPatterns.some(pattern => pattern.test(content));
  }

  private detectClickbait(content: string): boolean {
    const clickbaitPatterns = [
      /you\s+won't\s+believe/i,
      /number\s+\d+\s+will\s+shock/i,
      /this\s+one\s+trick/i,
      /what\s+happened\s+next/i,
      /shocking\s+truth/i
    ];

    return clickbaitPatterns.some(pattern => pattern.test(content));
  }

  private detectSpam(content: string): boolean {
    // Check for excessive links
    const linkCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
    if (linkCount > 3) return true;

    // Check for excessive hashtags
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    if (hashtagCount > 10) return true;

    // Check for all caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.3) return true;

    // Check for repetitive text
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 20 && uniqueWords.size < words.length * 0.5) return true;

    return false;
  }

  private async categorizeContent(content: string): Promise<SafetyCheckResult['categories']> {
    // Simple heuristic-based categorization
    // In production, this would use a proper content moderation API
    
    return {
      hate: this.scoreHateContent(content),
      harassment: this.scoreHarassment(content),
      violence: this.scoreViolence(content),
      selfHarm: this.scoreSelfHarm(content),
      sexual: this.scoreSexualContent(content),
      dangerous: this.scoreDangerousContent(content)
    };
  }

  private scoreHateContent(content: string): number {
    const hatePatterns = [
      /\bhate\s+(you|them|those)\b/i,
      /\b(racist|sexist|bigot)\b/i,
      /\bdiscriminate\b/i
    ];
    
    const matches = hatePatterns.filter(p => p.test(content)).length;
    return Math.min(matches * 0.3, 1);
  }

  private scoreHarassment(content: string): number {
    const harassmentPatterns = [
      /\b(stupid|idiot|moron|loser)\b/i,
      /\b(threat|threaten)\b/i,
      /\byou\s+should\s+be\s+ashamed\b/i
    ];
    
    const matches = harassmentPatterns.filter(p => p.test(content)).length;
    return Math.min(matches * 0.3, 1);
  }

  private scoreViolence(content: string): number {
    const violencePatterns = [
      /\b(kill|murder|assault|attack)\b/i,
      /\b(weapon|gun|knife|bomb)\b/i,
      /\b(fight|punch|beat)\b/i
    ];
    
    const matches = violencePatterns.filter(p => p.test(content)).length;
    return Math.min(matches * 0.25, 1);
  }

  private scoreSelfHarm(content: string): number {
    const selfHarmPatterns = [
      /\b(suicide|self-harm|cut\s+myself)\b/i,
      /\b(end\s+it\s+all|kill\s+myself)\b/i
    ];
    
    const matches = selfHarmPatterns.filter(p => p.test(content)).length;
    return Math.min(matches * 0.5, 1);
  }

  private scoreSexualContent(content: string): number {
    // Very basic check - would be more sophisticated in production
    const sexualPatterns = [
      /\b(sex|nude|naked|porn)\b/i,
      /\b(explicit|adult\s+content)\b/i
    ];
    
    const matches = sexualPatterns.filter(p => p.test(content)).length;
    return Math.min(matches * 0.4, 1);
  }

  private scoreDangerousContent(content: string): number {
    const dangerousPatterns = [
      /\b(explosive|chemical\s+weapon|poison)\b/i,
      /\b(illegal\s+drugs|narcotics)\b/i,
      /\b(hack|breach|exploit)\b/i
    ];
    
    const matches = dangerousPatterns.filter(p => p.test(content)).length;
    return Math.min(matches * 0.35, 1);
  }

  private calculateSafetyScore(
    issues: SafetyIssue[],
    categories: SafetyCheckResult['categories']
  ): number {
    // Start with perfect score
    let score = 1.0;

    // Deduct for issues based on severity
    const severityPenalties = {
      low: 0.05,
      medium: 0.15,
      high: 0.3,
      critical: 0.5
    };

    for (const issue of issues) {
      score -= severityPenalties[issue.severity];
    }

    // Deduct for category scores
    const categoryScore = Object.values(categories).reduce((sum, val) => sum + val, 0) / 6;
    score -= categoryScore * 0.5;

    return Math.max(0, Math.min(1, score));
  }

  async generateSafetyReport(content: string): Promise<string> {
    const result = await this.checkSafety(content);
    
    const report = [
      `Content Safety Report`,
      `====================`,
      `Overall Score: ${(result.score * 100).toFixed(1)}%`,
      `Status: ${result.safe ? 'SAFE' : 'UNSAFE'}`,
      ``,
      `Category Scores:`,
      ...Object.entries(result.categories).map(([cat, score]) => 
        `  ${cat}: ${(score * 100).toFixed(1)}%`
      ),
      ``
    ];

    if (result.issues.length > 0) {
      report.push(
        `Issues Found:`,
        ...result.issues.map(issue => 
          `  [${issue.severity.toUpperCase()}] ${issue.description}`
        )
      );
    }

    return report.join('\n');
  }
}