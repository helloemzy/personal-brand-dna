import React, { useState, useEffect } from 'react';
import { toast } from '../components/Toast';
import { contentAPI, GenerateContentRequest, ContentTemplate } from '../services/contentAPI';\nimport TemplateSelector from '../components/TemplateSelector';\nimport { sampleTemplates } from '../data/sampleTemplates';
import { voiceAPI, VoiceProfile } from '../services/voiceAPI';

const ContentGenerationPage: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [contentVariations, setContentVariations] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedVoiceProfile, setSelectedVoiceProfile] = useState<string>('');
  const [formData, setFormData] = useState<GenerateContentRequest>({
    topic: '',
    contentType: 'post',
    urgency: 'medium',
    includePersonalExperience: true,
    tone: 'professional'
  });

  // Load templates and voice profiles on component mount
  useEffect(() => {
    loadTemplates();
    loadVoiceProfiles();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await contentAPI.getTemplates();
      setTemplates(response.data.templates);
    } catch (error) {
      console.error('Failed to load templates from API, using sample templates:', error);
      // Use sample templates as fallback for development/demo
      setTemplates(sampleTemplates);
    }
  };

  const loadVoiceProfiles = async () => {
    try {
      const response = await voiceAPI.getVoiceProfiles();
      if (response.data.profiles.length > 0) {
        const profileDetails = await Promise.all(
          response.data.profiles.map(profile => 
            voiceAPI.getVoiceProfile(profile.id)
          )
        );
        setVoiceProfiles(profileDetails.map(p => p.data.profile));
        // Auto-select the most recent voice profile
        setSelectedVoiceProfile(profileDetails[0].data.profile.id);
      }
    } catch (error) {
      console.error('Failed to load voice profiles:', error);
    }
  };

  const handleInputChange = (field: keyof GenerateContentRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast.error('Topic Required', 'Please provide a topic for your content');
      return;
    }

    if (voiceProfiles.length === 0) {
      toast.error('Voice Discovery Required', 'Please complete voice discovery first to generate authentic content');
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);
    setContentVariations([]);

    try {
      const request: GenerateContentRequest = {
        ...formData,
        templateId: selectedTemplate || undefined,
        voiceProfileId: selectedVoiceProfile || undefined
      };

      const response = await contentAPI.generateContent(request);
      setGeneratedContent(response.data.content);
      setContentVariations(response.data.variations);
      toast.success('Content Generated', 'Your personalized content has been created successfully!');
    } catch (error: any) {
      console.error('Content generation failed:', error);
      const errorMessage = error.response?.data?.message || 'Failed to generate content. Please try again.';
      toast.error('Generation Failed', errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied', 'Content copied to clipboard!');
  };

  const handleEditContent = (content: string) => {
    setGeneratedContent(content);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Content Generation
        </h1>
        <p className="text-lg text-gray-600">
          Generate authentic LinkedIn posts that sound like you using your voice signature.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Content Generation Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Content</h2>
          
          {/* Topic Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What would you like to post about? *
            </label>
            <textarea
              value={formData.topic}
              onChange={(e) => handleInputChange('topic', e.target.value)}
              placeholder="e.g., Just completed a major project at work, thoughts on remote work trends, career advice for new graduates..."
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              disabled={isGenerating}
            />
          </div>

          {/* Content Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content Type
            </label>
            <select
              value={formData.contentType}
              onChange={(e) => handleInputChange('contentType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isGenerating}
            >
              <option value="post">LinkedIn Post</option>
              <option value="article">LinkedIn Article</option>
              <option value="story">Story Post</option>
              <option value="poll">Poll Post</option>
              <option value="carousel">Carousel Post</option>
            </select>
          </div>

          {/* Template Selection */}
          <div className="mb-6">
            <TemplateSelector
              templates={templates}
              selectedTemplateId={selectedTemplate}
              onTemplateSelect={setSelectedTemplate}
              contentType={formData.contentType}
              className="w-full"
            />
          </div>

          {/* Voice Profile Selection */}
          {voiceProfiles.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice Profile
              </label>
              <select
                value={selectedVoiceProfile}
                onChange={(e) => setSelectedVoiceProfile(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isGenerating}
              >
                {voiceProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    Voice Profile {profile.confidenceScore >= 0.8 ? '(High Confidence)' : '(Good Confidence)'} - {new Date(profile.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Advanced Options */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tone
              </label>
              <select
                value={formData.tone}
                onChange={(e) => handleInputChange('tone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isGenerating}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="thought-leader">Thought Leader</option>
                <option value="conversational">Conversational</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Urgency
              </label>
              <select
                value={formData.urgency}
                onChange={(e) => handleInputChange('urgency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isGenerating}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Optional Fields */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience (Optional)
            </label>
            <input
              type="text"
              value={formData.targetAudience || ''}
              onChange={(e) => handleInputChange('targetAudience', e.target.value)}
              placeholder="e.g., Software engineers, Marketing professionals, Recent graduates..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isGenerating}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call to Action (Optional)
            </label>
            <input
              type="text"
              value={formData.callToAction || ''}
              onChange={(e) => handleInputChange('callToAction', e.target.value)}
              placeholder="e.g., What's your experience?, Share your thoughts, Let's connect..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isGenerating}
            />
          </div>

          {/* Include Personal Experience Toggle */}
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.includePersonalExperience}
                onChange={(e) => handleInputChange('includePersonalExperience', e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isGenerating}
              />
              <span className="text-sm font-medium text-gray-700">
                Include personal experiences in the content
              </span>
            </label>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !formData.topic.trim() || voiceProfiles.length === 0}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Generating Content...
              </div>
            ) : (
              'Generate Content'
            )}
          </button>

          {/* Voice Discovery Prompt */}
          {voiceProfiles.length === 0 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-blue-600 text-lg">🎤</div>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-900">
                    Complete Voice Discovery First
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    To generate authentic content that sounds like you, we need to analyze your voice signature first.
                  </p>
                  <button
                    onClick={() => window.location.href = '/voice-discovery'}
                    className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    Start Voice Discovery →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Generated Content Display */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Generated Content</h2>
          
          {!generatedContent && !isGenerating && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">✍️</div>
              <p className="text-lg mb-2">Ready to generate content</p>
              <p className="text-sm">Fill out the form and click generate to create your personalized LinkedIn content.</p>
            </div>
          )}

          {isGenerating && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-900 mb-2">Generating your content...</p>
              <p className="text-sm text-gray-600">This may take up to 30 seconds</p>
            </div>
          )}

          {generatedContent && (
            <div className="space-y-6">
              {/* Main Generated Content */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Generated Post</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCopyContent(generatedContent)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div 
                  className="bg-gray-50 p-4 rounded-md text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
                  contentEditable
                  suppressContentEditableWarning={true}
                  onBlur={(e) => handleEditContent(e.currentTarget.textContent || '')}
                >
                  {generatedContent}
                </div>
              </div>

              {/* Content Variations */}
              {contentVariations.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Alternative Versions</h3>
                  <div className="space-y-3">
                    {contentVariations.map((variation, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Version {index + 1}</span>
                          <button
                            onClick={() => handleCopyContent(variation)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {variation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleGenerate}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Generate New Version
                </button>
                <button
                  onClick={() => {
                    setGeneratedContent(null);
                    setContentVariations([]);
                    setFormData(prev => ({ ...prev, topic: '' }));
                  }}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Start New Content
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Type Examples */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Content Ideas & Examples</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { 
              name: 'Professional Update', 
              icon: '📢', 
              description: 'Share career milestones and achievements',
              example: 'Just completed my first quarter as a team lead...'
            },
            { 
              name: 'Industry Insight', 
              icon: '💡', 
              description: 'Share your perspective on industry trends',
              example: 'The shift to remote work has changed how we think about...'
            },
            { 
              name: 'Thought Leadership', 
              icon: '🎯', 
              description: 'Position yourself as an expert',
              example: 'After 10 years in product management, here are 5 lessons...'
            },
            { 
              name: 'Personal Story', 
              icon: '📖', 
              description: 'Share experiences and lessons learned',
              example: 'My biggest career mistake taught me...'
            },
            { 
              name: 'Company News', 
              icon: '🏢', 
              description: 'Announce company updates and wins',
              example: 'Excited to announce our team just launched...'
            },
            { 
              name: 'Networking Post', 
              icon: '🤝', 
              description: 'Connect and engage with your network',
              example: 'Looking to connect with other professionals in...'
            },
          ].map((type, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
              onClick={() => handleInputChange('topic', type.example)}
            >
              <div className="text-2xl mb-2">{type.icon}</div>
              <h3 className="font-medium text-gray-900 mb-1">{type.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{type.description}</p>
              <p className="text-xs text-blue-600 italic">Click to use: "{type.example}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContentGenerationPage;