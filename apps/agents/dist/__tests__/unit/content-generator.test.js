"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const content_generator_agent_1 = require("../../agents/content-generator.agent");
const voice_profile_generator_service_1 = require("../../services/voice-profile-generator.service");
const message_bus_mock_1 = require("../mocks/message-bus.mock");
const workshop_data_fixture_1 = require("../fixtures/workshop-data.fixture");
const openai_mock_1 = require("../mocks/openai.mock");
// Mock dependencies
jest.mock('openai', () => ({
    default: jest.fn().mockImplementation(() => (0, openai_mock_1.createMockOpenAI)())
}));
jest.mock('../../services/voice-profile-generator.service');
jest.mock('../../services/workshop-data.service', () => ({
    WorkshopDataService: jest.fn().mockImplementation(() => ({
        getWorkshopData: jest.fn().mockResolvedValue(workshop_data_fixture_1.mockWorkshopData)
    }))
}));
describe('ContentGeneratorAgent Unit Tests', () => {
    let agent;
    let messageBus;
    let mockVoiceProfileGenerator;
    beforeEach(async () => {
        messageBus = new message_bus_mock_1.MockMessageBus();
        await messageBus.connect();
        // Setup mocks
        mockVoiceProfileGenerator = {
            generateProfile: jest.fn().mockResolvedValue({
                tone: 'Professional yet approachable',
                style: 'Thought-provoking',
                vocabulary: ['innovate', 'transform', 'empower'],
                patterns: {
                    sentenceStarters: ['In my experience', 'I\'ve learned that'],
                    transitions: ['Moreover', 'Additionally'],
                    endings: ['What are your thoughts?', 'Let\'s discuss']
                }
            }),
            applyVoiceToContent: jest.fn().mockImplementation((content, profile) => ({
                text: `[Voice Applied] ${content}`,
                voiceMatchScore: 0.92
            }))
        };
        voice_profile_generator_service_1.VoiceProfileGenerator.mockImplementation(() => mockVoiceProfileGenerator);
        agent = new content_generator_agent_1.ContentGeneratorAgent(messageBus);
        await agent.start();
    });
    afterEach(async () => {
        await agent.stop();
        await messageBus.disconnect();
    });
    describe('Content Generation', () => {
        it('should generate content from news source', async () => {
            const newsContent = {
                title: 'AI Breakthrough in Healthcare',
                description: 'New AI model achieves 95% accuracy',
                link: 'https://example.com/ai-news'
            };
            const result = await agent.generateFromNews(workshop_data_fixture_1.mockWorkshopData.userId, newsContent, 'thought-leader', 'Digital Innovation');
            expect(result).toBeDefined();
            expect(result.text).toBeTruthy();
            expect(result.metadata).toMatchObject({
                sourceType: 'news',
                angle: 'thought-leader',
                pillar: 'Digital Innovation'
            });
        });
        it('should generate content from idea', async () => {
            const idea = {
                title: 'The Future of Remote Work',
                description: 'Exploring hybrid work models',
                pillar: 'Leadership Excellence'
            };
            const result = await agent.generateFromIdea(workshop_data_fixture_1.mockWorkshopData.userId, idea);
            expect(result).toBeDefined();
            expect(result.text).toBeTruthy();
            expect(result.metadata.sourceType).toBe('idea');
        });
        it('should generate content from manual prompt', async () => {
            const prompt = 'Write about the importance of continuous learning in tech';
            const result = await agent.generateFromPrompt(workshop_data_fixture_1.mockWorkshopData.userId, prompt, 'Personal Growth');
            expect(result).toBeDefined();
            expect(result.text).toBeTruthy();
            expect(result.metadata.sourceType).toBe('manual');
        });
    });
    describe('Voice Matching', () => {
        it('should apply voice profile to generated content', async () => {
            const content = 'Generic content about technology';
            const result = await agent.applyVoiceProfile(workshop_data_fixture_1.mockWorkshopData.userId, content, 'Digital Innovation');
            expect(mockVoiceProfileGenerator.generateProfile).toHaveBeenCalledWith(workshop_data_fixture_1.mockWorkshopData);
            expect(mockVoiceProfileGenerator.applyVoiceToContent).toHaveBeenCalledWith(content, expect.any(Object));
            expect(result.text).toContain('[Voice Applied]');
            expect(result.voiceMatchScore).toBe(0.92);
        });
        it('should handle voice profile generation failure', async () => {
            mockVoiceProfileGenerator.generateProfile.mockRejectedValueOnce(new Error('Profile generation failed'));
            const content = 'Test content';
            const result = await agent.applyVoiceProfile(workshop_data_fixture_1.mockWorkshopData.userId, content, 'Digital Innovation');
            // Should return original content on failure
            expect(result.text).toBe(content);
            expect(result.voiceMatchScore).toBe(0.5); // Default score
        });
    });
    describe('Content Variations', () => {
        it('should generate multiple variations when requested', async () => {
            const request = {
                userId: workshop_data_fixture_1.mockWorkshopData.userId,
                sourceType: 'manual',
                prompt: 'Leadership in the age of AI',
                variations: 3
            };
            const variations = await agent.generateVariations(request);
            expect(variations).toHaveLength(3);
            variations.forEach((variation) => {
                expect(variation.text).toBeTruthy();
                expect(variation.metadata).toBeDefined();
            });
        });
    });
    describe('Error Handling', () => {
        it('should handle OpenAI API errors gracefully', async () => {
            const mockOpenAI = (0, openai_mock_1.createMockOpenAI)();
            mockOpenAI.chat.completions.create = jest.fn().mockRejectedValueOnce(new Error('API rate limit exceeded'));
            const result = await agent.generateFromPrompt(workshop_data_fixture_1.mockWorkshopData.userId, 'Test prompt', 'Digital Innovation');
            expect(result).toBeNull();
        });
        it('should validate input parameters', async () => {
            await expect(agent.generateFromNews(null, // Invalid userId
            { title: 'Test' }, 'thought-leader', 'Digital Innovation')).rejects.toThrow('Invalid user ID');
            await expect(agent.generateFromNews(workshop_data_fixture_1.mockWorkshopData.userId, null, // Invalid news content
            'thought-leader', 'Digital Innovation')).rejects.toThrow('Invalid news content');
        });
    });
    describe('Message Handling', () => {
        it('should process content generation requests', async () => {
            const request = {
                type: 'content:requested',
                agentId: 'test',
                timestamp: new Date(),
                data: {
                    userId: workshop_data_fixture_1.mockWorkshopData.userId,
                    sourceType: 'manual',
                    prompt: 'Test content generation',
                    pillar: 'Digital Innovation'
                }
            };
            await messageBus.publish('content:generate', request);
            await new Promise(resolve => setTimeout(resolve, 500));
            const generatedMessages = messageBus.getMessages('content:generated');
            expect(generatedMessages).toHaveLength(1);
            expect(generatedMessages[0].data.content).toBeDefined();
        });
        it('should handle malformed messages', async () => {
            const invalidRequest = {
                type: 'content:requested',
                agentId: 'test',
                timestamp: new Date(),
                data: {} // Missing required fields
            };
            const errorHandler = jest.fn();
            messageBus.on('message:error', errorHandler);
            await messageBus.publish('content:generate', invalidRequest);
            await new Promise(resolve => setTimeout(resolve, 500));
            expect(errorHandler).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=content-generator.test.js.map