import { 
  createShareableLink, 
  generateSocialShareTemplates, 
  generateEmbedCode,
  trackShareEvent,
  preparePublicShareData,
  generateReferralCode,
  getShareData
} from './sharingService';
import { WorkshopState } from '../store/slices/workshopSlice';
import { ArchetypeScore } from './archetypeService';

describe('sharingService', () => {
  const mockArchetypeResult = {
    primary: {
      archetype: 'innovativeLeader',
      score: 0.85,
      confidence: 0.9,
      traits: {
        innovation: 0.9,
        leadership: 0.85,
        vision: 0.88,
        strategic: 0.82,
        empathy: 0.6
      }
    } as ArchetypeScore
  };

  const mockShareData = {
    workshopState: {
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      isCompleted: true,
      values: {
        selected: ['innovation', 'excellence'],
        primary: ['innovation'],
        custom: [],
        rankings: {},
        aspirational: [],
        stories: {}
      }
    } as WorkshopState,
    archetypeResult: mockArchetypeResult,
    mission: 'To transform industries through innovative solutions',
    contentPillars: {
      pillars: [
        { 
          name: 'Expertise', 
          percentage: 40, 
          topics: ['Innovation', 'Strategy'] 
        }
      ],
      primaryFocus: 'Expertise',
      contentStrategy: 'Lead with expertise',
      voiceAdaptations: {}
    }
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('createShareableLink', () => {
    test('should generate unique shareable link', () => {
      const link = createShareableLink(mockShareData);
      
      expect(link).toHaveProperty('id');
      expect(link).toHaveProperty('shortCode');
      expect(link.shortCode).toHaveLength(8);
      expect(link).toHaveProperty('fullUrl');
      expect(link.fullUrl).toContain('/share/');
      expect(link.clickCount).toBe(0);
    });

    test('should generate different codes for same data', () => {
      const link1 = createShareableLink(mockShareData);
      const link2 = createShareableLink(mockShareData);
      
      expect(link1.shortCode).not.toBe(link2.shortCode);
      expect(link1.id).not.toBe(link2.id);
    });

    test('should include referral source when provided', () => {
      const link = createShareableLink(mockShareData, 'linkedin-post');
      
      expect(link.referralSource).toBe('linkedin-post');
    });

    test('should store share data in localStorage', () => {
      const link = createShareableLink(mockShareData);
      const storedData = localStorage.getItem(`share_${link.shortCode}`);
      
      expect(storedData).not.toBeNull();
      const parsed = JSON.parse(storedData!);
      expect(parsed).toHaveProperty('mission');
      expect(parsed.mission).toBe(mockShareData.mission);
      expect(parsed).toHaveProperty('created');
    });
  });

  describe('generateSocialShareTemplates', () => {
    const shareUrl = 'https://brandpillar.ai/share/ABC12345';

    test('should create LinkedIn share template', () => {
      const templates = generateSocialShareTemplates(mockShareData, shareUrl);
      const linkedinTemplate = templates.find(t => t.platform === 'linkedin');
      
      expect(linkedinTemplate).toBeDefined();
      expect(linkedinTemplate?.content).toContain('Innovative Leader');
      expect(linkedinTemplate?.content).toContain(shareUrl);
      expect(linkedinTemplate?.hashtags).toContain('#PersonalBranding');
      expect(linkedinTemplate?.characterCount).toBeLessThanOrEqual(3000);
    });

    test('should create Twitter share template within character limit', () => {
      const templates = generateSocialShareTemplates(mockShareData, shareUrl);
      const twitterTemplate = templates.find(t => t.platform === 'twitter');
      
      expect(twitterTemplate).toBeDefined();
      expect(twitterTemplate?.characterCount).toBeLessThanOrEqual(280);
      expect(twitterTemplate?.content).toContain(shareUrl);
    });

    test('should create email share template', () => {
      const templates = generateSocialShareTemplates(mockShareData, shareUrl);
      const emailTemplate = templates.find(t => t.platform === 'email');
      
      expect(emailTemplate).toBeDefined();
      expect(emailTemplate?.title).toContain('Brand House');
      expect(emailTemplate?.content).toContain('Innovative Leader');
      expect(emailTemplate?.content).toContain(shareUrl);
    });

    test('should handle missing archetype data', () => {
      const incompleteData = {
        ...mockShareData,
        archetypeResult: { primary: null as any }
      };
      
      const templates = generateSocialShareTemplates(incompleteData, shareUrl);
      expect(templates).toHaveLength(4); // Should still create all templates
      
      const linkedinTemplate = templates.find(t => t.platform === 'linkedin');
      expect(linkedinTemplate?.content).not.toContain('null');
    });
  });

  describe('generateEmbedCode', () => {
    const shareUrl = 'https://brandpillar.ai/share/ABC12345';

    test('should generate valid embed code', () => {
      const embedCode = generateEmbedCode(shareUrl, mockShareData);
      
      expect(embedCode).toContain('<iframe');
      expect(embedCode).toContain(`src="${shareUrl}/embed"`);
      expect(embedCode).toContain('width="400"');
      expect(embedCode).toContain('height="500"');
    });

    test('should include custom dimensions when provided', () => {
      const options = { width: 600, height: 700 };
      const embedCode = generateEmbedCode(shareUrl, mockShareData, options);
      
      expect(embedCode).toContain('width="600"');
      expect(embedCode).toContain('height="700"');
    });

    test('should include dark mode option', () => {
      const options = { darkMode: true };
      const embedCode = generateEmbedCode(shareUrl, mockShareData, options);
      
      expect(embedCode).toContain('?theme=dark');
    });

    test('should include title attribute', () => {
      const embedCode = generateEmbedCode(shareUrl, mockShareData);
      
      expect(embedCode).toContain('title="');
      expect(embedCode).toContain('Brand House');
    });
  });

  describe('trackShareEvent', () => {
    test('should track share click and increment count', () => {
      const shareCode = 'ABC12345';
      const platform = 'linkedin';
      
      // Store initial share data
      localStorage.setItem(`share_${shareCode}`, JSON.stringify({
        shareData: mockShareData,
        clickCount: 5,
        created: new Date().toISOString()
      }));
      
      trackShareEvent(shareCode, platform);
      
      const storedData = JSON.parse(localStorage.getItem(`share_${shareCode}`)!);
      expect(storedData.clickCount).toBe(6);
      expect(storedData.clicks).toHaveLength(1);
      expect(storedData.clicks[0].platform).toBe(platform);
    });

    test('should handle missing share data gracefully', () => {
      const shareCode = 'NOTFOUND';
      
      expect(() => {
        trackShareEvent(shareCode, 'linkedin');
      }).not.toThrow();
    });

    test('should track referral code when provided', () => {
      const shareCode = 'ABC12345';
      const referralCode = 'USER123';
      
      localStorage.setItem(`share_${shareCode}`, JSON.stringify({
        shareData: mockShareData,
        clickCount: 0,
        created: new Date().toISOString()
      }));
      
      trackShareEvent(shareCode, 'email', referralCode);
      
      const storedData = JSON.parse(localStorage.getItem(`share_${shareCode}`)!);
      expect(storedData.clicks[0].referralCode).toBe(referralCode);
    });
  });

  describe('preparePublicShareData', () => {
    test('should return sanitized public data', () => {
      const shareCode = 'ABC12345';
      
      localStorage.setItem(`share_${shareCode}`, JSON.stringify({
        shareData: mockShareData,
        clickCount: 10,
        created: new Date().toISOString()
      }));
      
      const publicData = preparePublicShareData(shareCode);
      
      expect(publicData).toBeDefined();
      expect(publicData?.archetype).toBe('Innovative Leader');
      expect(publicData?.mission).toBe(mockShareData.mission);
      expect(publicData?.values).toEqual(['innovation', 'excellence']);
      expect(publicData?.primaryValues).toEqual(['innovation']);
      expect(publicData?.contentPillars).toHaveLength(1);
    });

    test('should not include sensitive workshop data', () => {
      const shareCode = 'ABC12345';
      
      localStorage.setItem(`share_${shareCode}`, JSON.stringify({
        shareData: {
          ...mockShareData,
          workshopState: {
            ...mockShareData.workshopState,
            sessionId: 'sensitive-session-id',
            personalityQuiz: { responses: [{ answer: 'personal info' }] }
          }
        },
        clickCount: 0,
        created: new Date().toISOString()
      }));
      
      const publicData = preparePublicShareData(shareCode);
      
      expect(JSON.stringify(publicData)).not.toContain('sensitive-session-id');
      expect(JSON.stringify(publicData)).not.toContain('personal info');
    });

    test('should return null for non-existent share code', () => {
      const publicData = preparePublicShareData('NOTFOUND');
      expect(publicData).toBeNull();
    });
  });

  describe('generateReferralCode', () => {
    test('should generate unique referral code for user', () => {
      const userId = 'user123';
      const code = generateReferralCode(userId);
      
      expect(code).toContain('REF');
      expect(code).toHaveLength(10); // REF + 7 chars
    });

    test('should generate consistent code for same user', () => {
      const userId = 'user123';
      const code1 = generateReferralCode(userId);
      const code2 = generateReferralCode(userId);
      
      // Should be consistent based on userId
      expect(code1).toBe(code2);
    });

    test('should generate different codes for different users', () => {
      const code1 = generateReferralCode('user123');
      const code2 = generateReferralCode('user456');
      
      expect(code1).not.toBe(code2);
    });
  });
});