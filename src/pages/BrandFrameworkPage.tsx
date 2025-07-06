import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface BrandFramework {
  id: string;
  brandArchetype: string;
  valueProposition: string;
  uniqueDifferentiators: string[];
  targetAudience: {
    primary: string;
    painPoints: string[];
    desires: string[];
  };
  communicationStyle: {
    formality: number;
    analyticalVsEmotional: number;
    conciseVsDetailed: number;
    seriousVsPlayful: number;
  };
  voiceCharacteristics: {
    tone: string;
    pace: string;
    vocabulary: string;
    energy: string;
  };
  authenticPhrases: string[];
  coreMessage: string;
  supportingMessages: string[];
  contentPillars: Array<{
    name: string;
    description: string;
    topics: string[];
    percentage: number;
  }>;
  personalityTraits: string[];
  strengths: string[];
  passionIndicators: string[];
  expertiseAreas: string[];
  confidenceScore: number;
}

const BrandFrameworkPage: React.FC = () => {
  const navigate = useNavigate();
  const { accessToken } = useSelector((state: RootState) => state.auth);
  const [framework, setFramework] = useState<BrandFramework | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'voice' | 'content' | 'strategy'>('overview');

  useEffect(() => {
    fetchBrandFramework();
  }, []);

  const fetchBrandFramework = async () => {
    try {
      const response = await fetch('/api/voice-discovery/check-status', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch framework');

      const data = await response.json();
      if (data.brandFramework) {
        setFramework(data.brandFramework);
      }
    } catch (error) {
      console.error('Error fetching framework:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your brand framework...</p>
        </div>
      </div>
    );
  }

  if (!framework) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No brand framework found.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-purple-600 hover:underline"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const archetypeIcons: Record<string, string> = {
    'Expert': '🎓',
    'Innovator': '💡',
    'Mentor': '🤝',
    'Visionary': '🔮',
    'Challenger': '⚡',
    'Creator': '🎨',
    'Leader': '👑',
    'Connector': '🌐'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Your Personal Brand Framework
              </h1>
              <p className="text-gray-600">
                AI-powered analysis based on your authentic voice
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-2">
                {archetypeIcons[framework.brandArchetype] || '✨'}
              </div>
              <p className="text-sm font-medium text-purple-600">
                {framework.brandArchetype}
              </p>
            </div>
          </div>

          {/* Confidence Score */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Framework Confidence</span>
              <span className="text-sm font-bold text-purple-600">
                {Math.round(framework.confidenceScore * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${framework.confidenceScore * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-t-2xl shadow-xl px-8 pt-6">
          <div className="flex space-x-8 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: '📋' },
              { id: 'voice', label: 'Voice & Style', icon: '🎤' },
              { id: 'content', label: 'Content Strategy', icon: '📝' },
              { id: 'strategy', label: 'Messaging', icon: '💬' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-4 px-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-2xl shadow-xl p-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Value Proposition */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Your Value Proposition
                </h3>
                <div className="bg-purple-50 rounded-xl p-6">
                  <p className="text-lg text-gray-800 italic">
                    "{framework.valueProposition}"
                  </p>
                </div>
              </div>

              {/* Unique Differentiators */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  What Makes You Unique
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {framework.uniqueDifferentiators.map((diff, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-semibold">
                          {index + 1}
                        </span>
                      </div>
                      <p className="text-gray-700">{diff}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Your Ideal Audience
                </h3>
                <div className="bg-blue-50 rounded-xl p-6 space-y-4">
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Primary Audience:</p>
                    <p className="text-gray-700">{framework.targetAudience.primary}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Their Pain Points:</p>
                      <ul className="space-y-1">
                        {framework.targetAudience.painPoints.map((pain, index) => (
                          <li key={index} className="text-gray-700 flex items-start">
                            <span className="text-red-500 mr-2">•</span>
                            {pain}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Their Desires:</p>
                      <ul className="space-y-1">
                        {framework.targetAudience.desires.map((desire, index) => (
                          <li key={index} className="text-gray-700 flex items-start">
                            <span className="text-green-500 mr-2">•</span>
                            {desire}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strengths & Expertise */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Core Strengths
                  </h3>
                  <div className="space-y-2">
                    {framework.strengths.map((strength, index) => (
                      <div key={index} className="bg-purple-50 rounded-lg px-4 py-2">
                        <p className="text-gray-800">{strength}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Expertise Areas
                  </h3>
                  <div className="space-y-2">
                    {framework.expertiseAreas.map((area, index) => (
                      <div key={index} className="bg-blue-50 rounded-lg px-4 py-2">
                        <p className="text-gray-800">{area}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Voice & Style Tab */}
          {activeTab === 'voice' && (
            <div className="space-y-8">
              {/* Voice Characteristics */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Your Voice Profile
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(framework.voiceCharacteristics).map(([key, value]) => (
                    <div key={key} className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 text-center">
                      <p className="text-sm text-gray-600 capitalize mb-1">{key}</p>
                      <p className="text-lg font-semibold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Communication Style */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Communication Style
                </h3>
                <div className="space-y-4">
                  {Object.entries(framework.communicationStyle).map(([key, value]) => {
                    const labels = {
                      formality: ['Casual', 'Formal'],
                      analyticalVsEmotional: ['Analytical', 'Emotional'],
                      conciseVsDetailed: ['Concise', 'Detailed'],
                      seriousVsPlayful: ['Serious', 'Playful']
                    };
                    const [left, right] = labels[key as keyof typeof labels] || ['', ''];
                    
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>{left}</span>
                          <span>{right}</span>
                        </div>
                        <div className="relative">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full"
                              style={{ width: `${value * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Authentic Phrases */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Your Authentic Phrases
                </h3>
                <p className="text-gray-600 mb-4">
                  These phrases capture your natural way of expressing ideas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {framework.authenticPhrases.map((phrase, index) => (
                    <span
                      key={index}
                      className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium"
                    >
                      "{phrase}"
                    </span>
                  ))}
                </div>
              </div>

              {/* Personality Traits */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Personality Profile
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {framework.personalityTraits.map((trait, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg px-4 py-3 text-center"
                    >
                      <p className="text-gray-800 font-medium">{trait}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Content Strategy Tab */}
          {activeTab === 'content' && (
            <div className="space-y-8">
              {/* Content Pillars */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Content Pillars
                </h3>
                <div className="space-y-4">
                  {framework.contentPillars.map((pillar, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {pillar.name}
                          </h4>
                          <p className="text-gray-600 mt-1">{pillar.description}</p>
                        </div>
                        <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                          {pillar.percentage}%
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {pillar.topics.map((topic, topicIndex) => (
                          <span
                            key={topicIndex}
                            className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Mix Visualization */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Recommended Content Mix
                </h3>
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6">
                  <div className="space-y-3">
                    {framework.contentPillars.map((pillar, index) => (
                      <div key={index} className="flex items-center space-x-4">
                        <div className="w-32 text-sm font-medium text-gray-700">
                          {pillar.name}
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 rounded-full h-6">
                            <div
                              className="bg-gradient-to-r from-purple-600 to-blue-600 h-6 rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${pillar.percentage}%` }}
                            >
                              <span className="text-xs text-white font-semibold">
                                {pillar.percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Passion Indicators */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Topics You're Passionate About
                </h3>
                <div className="bg-yellow-50 rounded-xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {framework.passionIndicators.map((passion, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-yellow-500">🔥</span>
                        <p className="text-gray-800">{passion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messaging Tab */}
          {activeTab === 'strategy' && (
            <div className="space-y-8">
              {/* Core Message */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Core Message
                </h3>
                <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-8 text-center">
                  <p className="text-xl text-gray-900 font-medium italic">
                    "{framework.coreMessage}"
                  </p>
                </div>
              </div>

              {/* Supporting Messages */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Supporting Messages
                </h3>
                <div className="space-y-3">
                  {framework.supportingMessages.map((message, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 font-semibold text-sm">
                            {index + 1}
                          </span>
                        </div>
                        <p className="text-gray-800 flex-1">{message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call to Action */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-8 text-white text-center">
                <h3 className="text-2xl font-bold mb-4">Ready to Build Your Brand?</h3>
                <p className="mb-6 text-purple-100">
                  Start creating authentic content that resonates with your audience
                </p>
                <button
                  onClick={() => navigate('/content-generation')}
                  className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
                >
                  Generate Your First Post
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back to Dashboard
          </button>
          <div className="space-x-4">
            <button className="px-6 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors">
              Download PDF
            </button>
            <button
              onClick={() => navigate('/content-generation')}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
            >
              Start Creating Content
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandFrameworkPage;