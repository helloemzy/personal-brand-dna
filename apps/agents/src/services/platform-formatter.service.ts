import { Logger } from 'pino';

interface PlatformConfig {
  maxLength: number;
  maxHashtags: number;
  maxMentions: number;
  maxUrls: number;
  maxImages: number;
  allowedMediaTypes: string[];
}

interface FormattedContent {
  text: string;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  mediaUrls: string[];
  metadata: {
    truncated: boolean;
    originalLength: number;
    platform: string;
  };
}

export class PlatformFormatterService {
  private logger: Logger;
  
  private readonly PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
    linkedin: {
      maxLength: 3000,
      maxHashtags: 30,
      maxMentions: 20,
      maxUrls: 10,
      maxImages: 9,
      allowedMediaTypes: ['image/jpeg', 'image/png', 'image/gif']
    },
    twitter: {
      maxLength: 280,
      maxHashtags: 5,
      maxMentions: 10,
      maxUrls: 2,
      maxImages: 4,
      allowedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4']
    },
    facebook: {
      maxLength: 63206,
      maxHashtags: 30,
      maxMentions: 50,
      maxUrls: 10,
      maxImages: 10,
      allowedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4']
    }
  };

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async formatForPlatform(
    content: string,
    platform: string,
    options?: {
      hashtags?: string[];
      mentions?: string[];
      urls?: string[];
      mediaUrls?: string[];
      preservePriority?: 'content' | 'hashtags' | 'all';
    }
  ): Promise<FormattedContent> {
    const config = this.PLATFORM_CONFIGS[platform];
    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const originalLength = content.length;
    let formattedText = content;
    
    // Extract existing elements from content
    const existingHashtags = this.extractHashtags(content);
    const existingMentions = this.extractMentions(content);
    const existingUrls = this.extractUrls(content);
    
    // Merge with provided options
    const allHashtags = [...new Set([...existingHashtags, ...(options?.hashtags || [])])];
    const allMentions = [...new Set([...existingMentions, ...(options?.mentions || [])])];
    const allUrls = [...new Set([...existingUrls, ...(options?.urls || [])])];
    
    // Apply platform-specific formatting
    const result = this.applyPlatformRules(
      formattedText,
      {
        hashtags: allHashtags,
        mentions: allMentions,
        urls: allUrls,
        mediaUrls: options?.mediaUrls || []
      },
      config,
      options?.preservePriority || 'content'
    );

    return {
      ...result,
      metadata: {
        truncated: result.text.length < originalLength,
        originalLength,
        platform
      }
    };
  }

  private applyPlatformRules(
    content: string,
    elements: {
      hashtags: string[];
      mentions: string[];
      urls: string[];
      mediaUrls: string[];
    },
    config: PlatformConfig,
    preservePriority: string
  ): Omit<FormattedContent, 'metadata'> {
    // Remove elements from content to calculate space
    let cleanContent = this.removeHashtags(content);
    cleanContent = this.removeMentions(cleanContent);
    cleanContent = this.removeUrls(cleanContent);
    
    // Limit elements to platform maximums
    const limitedHashtags = elements.hashtags.slice(0, config.maxHashtags);
    const limitedMentions = elements.mentions.slice(0, config.maxMentions);
    const limitedUrls = elements.urls.slice(0, config.maxUrls);
    const limitedMedia = elements.mediaUrls.slice(0, config.maxImages);
    
    // Calculate space needed for elements
    const hashtagSpace = this.calculateHashtagSpace(limitedHashtags);
    const mentionSpace = this.calculateMentionSpace(limitedMentions);
    const urlSpace = this.calculateUrlSpace(limitedUrls);
    const totalElementSpace = hashtagSpace + mentionSpace + urlSpace + 10; // padding
    
    // Truncate content if needed
    let finalContent = cleanContent;
    if (cleanContent.length + totalElementSpace > config.maxLength) {
      const availableSpace = config.maxLength - totalElementSpace - 5; // 5 for "..."
      finalContent = this.truncateContent(cleanContent, availableSpace);
    }
    
    // Reconstruct formatted content
    let formattedText = finalContent;
    
    // Add mentions at the beginning
    if (limitedMentions.length > 0) {
      formattedText = limitedMentions.map(m => `@${m.replace('@', '')}`).join(' ') + ' ' + formattedText;
    }
    
    // Add URLs inline or at the end based on platform
    if (limitedUrls.length > 0) {
      if (config.maxLength < 500) { // Short form platforms
        formattedText += '\n' + limitedUrls.join(' ');
      } else {
        // Keep URLs inline for long form
      }
    }
    
    // Add hashtags at the end
    if (limitedHashtags.length > 0) {
      const hashtagString = limitedHashtags.map(h => `#${h.replace('#', '')}`).join(' ');
      formattedText += '\n\n' + hashtagString;
    }
    
    return {
      text: formattedText.trim(),
      hashtags: limitedHashtags,
      mentions: limitedMentions,
      urls: limitedUrls,
      mediaUrls: limitedMedia
    };
  }

  private extractHashtags(content: string): string[] {
    const matches = content.match(/#[\w]+/g) || [];
    return matches.map(h => h.substring(1));
  }

  private extractMentions(content: string): string[] {
    const matches = content.match(/@[\w]+/g) || [];
    return matches.map(m => m.substring(1));
  }

  private extractUrls(content: string): string[] {
    const matches = content.match(/https?:\/\/[^\s]+/g) || [];
    return matches;
  }

  private removeHashtags(content: string): string {
    return content.replace(/#[\w]+/g, '').trim();
  }

  private removeMentions(content: string): string {
    return content.replace(/@[\w]+/g, '').trim();
  }

  private removeUrls(content: string): string {
    return content.replace(/https?:\/\/[^\s]+/g, '').trim();
  }

  private calculateHashtagSpace(hashtags: string[]): number {
    if (hashtags.length === 0) return 0;
    return hashtags.map(h => h.length + 1).reduce((a, b) => a + b, 0) + 2; // +2 for newlines
  }

  private calculateMentionSpace(mentions: string[]): number {
    if (mentions.length === 0) return 0;
    return mentions.map(m => m.length + 1).reduce((a, b) => a + b, 0) + 1; // +1 for space
  }

  private calculateUrlSpace(urls: string[]): number {
    if (urls.length === 0) return 0;
    // URLs are often shortened by platforms
    return urls.length * 25 + 1; // Assume 23 chars per URL + spaces
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    // Try to truncate at sentence boundary
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length <= maxLength) {
        truncated += sentence;
      } else {
        break;
      }
    }
    
    // If no complete sentence fits, truncate at word boundary
    if (!truncated) {
      const words = content.split(/\s+/);
      for (const word of words) {
        if ((truncated + word).length <= maxLength - 3) {
          truncated += (truncated ? ' ' : '') + word;
        } else {
          break;
        }
      }
    }
    
    return truncated.trim() + '...';
  }

  generateOptimalHashtags(
    content: string,
    platform: string,
    existingHashtags: string[],
    maxCount?: number
  ): string[] {
    const config = this.PLATFORM_CONFIGS[platform];
    if (!config) return existingHashtags;
    
    const limit = maxCount || config.maxHashtags;
    
    // Extract key topics from content
    const topics = this.extractKeyTopics(content);
    
    // Generate hashtag variations
    const generatedHashtags = topics.map(topic => {
      // Convert to hashtag format
      return topic.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/gi, '');
    });
    
    // Combine and deduplicate
    const allHashtags = [...new Set([...existingHashtags, ...generatedHashtags])];
    
    // Prioritize by relevance (existing hashtags first)
    return allHashtags.slice(0, limit);
  }

  private extractKeyTopics(content: string): string[] {
    // Simple keyword extraction - in production would use NLP
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    const wordFreq = new Map<string, number>();
    
    for (const word of words) {
      const cleaned = word.replace(/[^a-z0-9]/gi, '');
      if (cleaned.length > 3 && !stopWords.has(cleaned)) {
        wordFreq.set(cleaned, (wordFreq.get(cleaned) || 0) + 1);
      }
    }
    
    // Sort by frequency and return top topics
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  validateMediaForPlatform(
    mediaUrls: string[],
    platform: string
  ): { valid: string[]; invalid: string[]; reasons: string[] } {
    const config = this.PLATFORM_CONFIGS[platform];
    if (!config) {
      return { valid: [], invalid: mediaUrls, reasons: ['Unsupported platform'] };
    }
    
    const valid: string[] = [];
    const invalid: string[] = [];
    const reasons: string[] = [];
    
    if (mediaUrls.length > config.maxImages) {
      reasons.push(`Maximum ${config.maxImages} images allowed`);
      valid.push(...mediaUrls.slice(0, config.maxImages));
      invalid.push(...mediaUrls.slice(config.maxImages));
    } else {
      valid.push(...mediaUrls);
    }
    
    return { valid, invalid, reasons };
  }
}