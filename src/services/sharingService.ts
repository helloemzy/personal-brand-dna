import { WorkshopState } from '../store/slices/workshopSlice';
import { ArchetypeScore } from './archetypeService';
import { ContentPillarAnalysis } from './contentPillarService';
import { UVPAnalysis } from './uvpConstructorService';
import { ActionableContentPackage } from './linkedinHeadlineService';

// Sharing Types
export interface ShareableLink {
  id: string;
  shortCode: string;
  fullUrl: string;
  created: Date;
  expiresAt?: Date;
  referralSource?: string;
  clickCount: number;
}

export interface SocialShareTemplate {
  platform: 'linkedin' | 'twitter' | 'email' | 'facebook';
  title: string;
  content: string;
  hashtags: string[];
  url: string;
  characterCount?: number;
}

export interface ShareData {
  workshopState: WorkshopState;
  archetypeResult: {
    primary: ArchetypeScore;
    secondary?: ArchetypeScore;
    hybrid?: {
      name: string;
      description: string;
      ratio: number;
    };
  };
  mission: string;
  contentPillars?: ContentPillarAnalysis;
  uvpAnalysis?: UVPAnalysis;
  actionableContent?: ActionableContentPackage;
}

export interface ShareTracking {
  shareId: string;
  platform: string;
  timestamp: Date;
  referralCode?: string;
  userId?: string;
}

// Generate unique shareable short code
export const generateShareCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Create shareable link
export const createShareableLink = (
  shareData: ShareData,
  referralSource?: string
): ShareableLink => {
  const shortCode = generateShareCode();
  const baseUrl = window.location.origin;
  
  // Store share data in localStorage (in production, this would be stored in database)
  const shareId = `share_${shortCode}`;
  localStorage.setItem(shareId, JSON.stringify({
    ...shareData,
    created: new Date().toISOString(),
    referralSource
  }));
  
  return {
    id: shareId,
    shortCode,
    fullUrl: `${baseUrl}/share/${shortCode}`,
    created: new Date(),
    referralSource,
    clickCount: 0
  };
};

// Get share data from code
export const getShareData = (shortCode: string): ShareData | null => {
  const shareId = `share_${shortCode}`;
  const data = localStorage.getItem(shareId);
  
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    // Update click count
    parsed.clickCount = (parsed.clickCount || 0) + 1;
    localStorage.setItem(shareId, JSON.stringify(parsed));
    
    return parsed;
  } catch (error) {
    console.error('Error parsing share data:', error);
    return null;
  }
};

// Generate LinkedIn share content
const generateLinkedInContent = (shareData: ShareData): SocialShareTemplate => {
  const { archetypeResult, mission, uvpAnalysis } = shareData;
  const archetype = archetypeResult.hybrid?.name || archetypeResult.primary.archetype.name;
  
  const content = `🎯 I just discovered my Brand Archetype: ${archetype}!

${archetypeResult.primary.archetype.description}

My mission: ${mission}

${uvpAnalysis ? `My unique value: ${uvpAnalysis.primaryUVP.fullStatement}` : ''}

This AI-powered Brand House workshop helped me clarify:
✅ My core values and what drives me
✅ My unique communication style
✅ Who I serve best and how
✅ My content strategy pillars

Want to discover your professional brand DNA? Take the free workshop:`;

  const hashtags = [
    'PersonalBranding',
    'BrandStrategy',
    'ProfessionalDevelopment',
    'LinkedInStrategy',
    'ThoughtLeadership',
    archetype.replace(/\s+/g, '')
  ];

  return {
    platform: 'linkedin',
    title: `Discovered my Brand Archetype: ${archetype}`,
    content,
    hashtags,
    url: '',
    characterCount: content.length
  };
};

// Generate Twitter/X thread
const generateTwitterContent = (shareData: ShareData): SocialShareTemplate => {
  const { archetypeResult, mission, contentPillars } = shareData;
  const archetype = archetypeResult.hybrid?.name || archetypeResult.primary.archetype.name;
  
  const thread = `🧵 Just discovered I'm ${archetype.startsWith('a') || archetype.startsWith('e') || archetype.startsWith('i') || archetype.startsWith('o') || archetype.startsWith('u') ? 'an' : 'a'} ${archetype}!

1/ Took an AI-powered Brand House workshop that analyzed my values, communication style, and professional identity.

2/ My mission: ${mission.substring(0, 200)}${mission.length > 200 ? '...' : ''}

3/ My content pillars:
${contentPillars ? contentPillars.pillars.map(p => `• ${p.name} (${p.percentage}%)`).join('\n') : '• Expertise\n• Experience\n• Evolution'}

4/ This clarity helps me create content that's authentically me while serving my audience better.

Try it yourself (free):`;

  const hashtags = [
    'PersonalBrand',
    'ContentStrategy',
    'AI',
    archetype.replace(/\s+/g, '')
  ];

  return {
    platform: 'twitter',
    title: `I'm ${archetype.startsWith('a') || archetype.startsWith('e') || archetype.startsWith('i') || archetype.startsWith('o') || archetype.startsWith('u') ? 'an' : 'a'} ${archetype}!`,
    content: thread,
    hashtags,
    url: '',
    characterCount: thread.length
  };
};

// Generate email template
const generateEmailContent = (shareData: ShareData): SocialShareTemplate => {
  const { archetypeResult, mission, uvpAnalysis, contentPillars } = shareData;
  const archetype = archetypeResult.hybrid?.name || archetypeResult.primary.archetype.name;
  const firstName = shareData.workshopState.personalityQuiz.responses.find(r => r.questionId === 'professional_role')?.answer.split(' ')[0] || 'there';
  
  const emailBody = `Hi ${firstName},

I wanted to share something exciting with you!

I just completed an AI-powered Brand House workshop that helped me discover my professional brand archetype: ${archetype}.

${archetypeResult.primary.archetype.description}

What I learned about myself:

🎯 My Mission: ${mission}

💡 My Unique Value: ${uvpAnalysis ? uvpAnalysis.primaryUVP.fullStatement : 'A unique perspective that sets me apart'}

📚 My Content Pillars:
${contentPillars ? contentPillars.pillars.map(p => `   • ${p.name} (${p.percentage}%) - ${p.description}`).join('\n') : '   • Expertise - What I know\n   • Experience - What I\'ve learned\n   • Evolution - Where I\'m going'}

The workshop took about 15 minutes and gave me incredible clarity on:
- My authentic communication style
- Who I serve best and why
- How to create content that resonates
- My unique positioning in the market

I thought you might find it valuable too. You can take the free workshop here: [LINK]

Would love to hear what archetype you discover!

Best,
[Your name]`;

  return {
    platform: 'email',
    title: `Discover Your Professional Brand Archetype`,
    content: emailBody,
    hashtags: [],
    url: ''
  };
};

// Generate all social share templates
export const generateSocialShareTemplates = (
  shareData: ShareData,
  shareableLink: ShareableLink
): SocialShareTemplate[] => {
  const templates = [
    generateLinkedInContent(shareData),
    generateTwitterContent(shareData),
    generateEmailContent(shareData)
  ];
  
  // Add the shareable URL to each template
  return templates.map(template => ({
    ...template,
    url: shareableLink.fullUrl
  }));
};

// Track share event
export const trackShareEvent = (
  shareId: string,
  platform: string,
  referralCode?: string
): ShareTracking => {
  const tracking: ShareTracking = {
    shareId,
    platform,
    timestamp: new Date(),
    referralCode
  };
  
  // Store tracking data (in production, this would be sent to analytics)
  const trackingKey = `tracking_${shareId}_${Date.now()}`;
  localStorage.setItem(trackingKey, JSON.stringify(tracking));
  
  return tracking;
};

// Generate social share URLs
export const generateShareUrls = (
  template: SocialShareTemplate,
  shareableLink: string
): { platform: string; url: string } => {
  const encodedUrl = encodeURIComponent(shareableLink);
  const encodedText = encodeURIComponent(template.content);
  const encodedHashtags = template.hashtags.join(',');
  
  switch (template.platform) {
    case 'linkedin':
      return {
        platform: 'linkedin',
        url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
      };
      
    case 'twitter':
      return {
        platform: 'twitter',
        url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=${encodedHashtags}`
      };
      
    case 'email':
      const subject = encodeURIComponent(template.title);
      const body = encodeURIComponent(template.content.replace('[LINK]', shareableLink));
      return {
        platform: 'email',
        url: `mailto:?subject=${subject}&body=${body}`
      };
      
    case 'facebook':
      return {
        platform: 'facebook',
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
      };
      
    default:
      return {
        platform: 'unknown',
        url: shareableLink
      };
  }
};

// Generate embed code for websites
export const generateEmbedCode = (shareableLink: ShareableLink): string => {
  const embedCode = `<!-- BrandPillar AI Brand House Badge -->
<div id="brandpillar-badge" style="width: 300px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; font-family: sans-serif;">
  <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 18px;">My Brand Archetype</h3>
  <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px;">Discover your professional brand DNA with AI-powered insights</p>
  <a href="${shareableLink.fullUrl}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">View My Results</a>
  <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 12px;">Powered by BrandPillar AI</p>
</div>
<!-- End BrandPillar AI Badge -->`;
  
  return embedCode;
};

// Validate and clean share data for public viewing
export const preparePublicShareData = (shareData: ShareData): any => {
  // Remove sensitive information before sharing
  const publicData = {
    archetype: shareData.archetypeResult.hybrid?.name || shareData.archetypeResult.primary.archetype.name,
    archetypeDescription: shareData.archetypeResult.primary.archetype.description,
    mission: shareData.mission,
    values: shareData.workshopState.values.selected.slice(0, 5),
    contentPillars: shareData.contentPillars?.pillars.map(p => ({
      name: p.name,
      percentage: p.percentage,
      description: p.description
    })),
    confidence: shareData.archetypeResult.primary.confidence
  };
  
  return publicData;
};

// Check if share link is expired
export const isShareLinkExpired = (shareableLink: ShareableLink): boolean => {
  if (!shareableLink.expiresAt) return false;
  return new Date() > shareableLink.expiresAt;
};

// Generate referral code
export const generateReferralCode = (userId?: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  const userPart = userId ? userId.substring(0, 4) : 'anon';
  return `${userPart}_${timestamp}_${random}`.toUpperCase();
};