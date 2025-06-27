import React from 'react';
import { VoiceSignature, formatVoiceDimensions, getConfidenceDescription } from '../services/voiceAPI';

interface VoiceProfileVisualizationProps {
  voiceSignature: VoiceSignature;
  confidenceScore: number;
  className?: string;
  compact?: boolean;
}

const VoiceProfileVisualization: React.FC<VoiceProfileVisualizationProps> = ({
  voiceSignature,
  confidenceScore,
  className = '',
  compact = false
}) => {
  const dimensions = formatVoiceDimensions(voiceSignature);
  const confidenceDescription = getConfidenceDescription(confidenceScore);
  
  // Get color for confidence score
  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 bg-green-100';
    if (score >= 0.8) return 'text-blue-600 bg-blue-100';
    if (score >= 0.7) return 'text-yellow-600 bg-yellow-100';
    if (score >= 0.6) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  // Get color for dimension bar
  const getDimensionColor = (value: number) => {
    if (value >= 0.8) return 'bg-green-500';
    if (value >= 0.6) return 'bg-blue-500';
    if (value >= 0.4) return 'bg-yellow-500';
    if (value >= 0.2) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Get top characteristics
  const topDimensions = dimensions
    .sort((a, b) => b.value - a.value)
    .slice(0, compact ? 3 : 5);

  const bottomDimensions = dimensions
    .sort((a, b) => a.value - b.value)
    .slice(0, compact ? 2 : 3);

  if (compact) {
    return (
      <div className={`voice-profile-compact ${className}`}>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Voice Profile</h3>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(confidenceScore)}`}>
              {Math.round(confidenceScore * 100)}% {confidenceDescription}
            </div>
          </div>

          {/* Top characteristics */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Strongest Traits</h4>
            {topDimensions.map((dim) => (
              <div key={dim.dimension} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{dim.label}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getDimensionColor(dim.value)}`}
                      style={{ width: `${dim.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8">{dim.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`voice-profile-full ${className}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Your Voice Profile</h3>
            <p className="text-gray-600 text-sm mt-1">
              Based on your conversation, here's your unique communication style
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg text-lg font-bold ${getConfidenceColor(confidenceScore)}`}>
            {Math.round(confidenceScore * 100)}%<br />
            <span className="text-xs font-normal">{confidenceDescription}</span>
          </div>
        </div>

        {/* Radar chart placeholder */}
        <div className="mb-8">
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <div className="w-48 h-48 mx-auto bg-white rounded-full border-4 border-gray-200 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {Math.round(confidenceScore * 100)}%
                </div>
                <div className="text-sm text-gray-600">
                  Voice Match<br />Confidence
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Detailed radar chart visualization coming soon
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Strongest traits */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Strongest Communication Traits</h4>
            <div className="space-y-3">
              {topDimensions.map((dim) => (
                <div key={dim.dimension} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{dim.label}</span>
                    <span className="text-sm font-bold text-gray-700">{dim.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${getDimensionColor(dim.value)} transition-all duration-500`}
                      style={{ width: `${dim.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {getTraitDescription(dim.dimension, dim.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Development areas */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Growth Opportunities</h4>
            <div className="space-y-3">
              {bottomDimensions.map((dim) => (
                <div key={dim.dimension} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{dim.label}</span>
                    <span className="text-sm font-bold text-gray-700">{dim.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${getDimensionColor(dim.value)} transition-all duration-500`}
                      style={{ width: `${dim.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {getGrowthSuggestion(dim.dimension, dim.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* All dimensions */}
        <div className="mt-8">
          <h4 className="font-semibold text-gray-900 mb-4">Complete Voice Signature</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dimensions.map((dim) => (
              <div key={dim.dimension} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{dim.label}</span>
                    <span className="text-xs text-gray-500">{dim.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getDimensionColor(dim.value)}`}
                      style={{ width: `${dim.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile summary */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Your Communication Style Summary</h4>
          <p className="text-blue-800 text-sm">
            {generateStyleSummary(voiceSignature, topDimensions)}
          </p>
        </div>
      </div>
    </div>
  );
};

// Helper function to get trait descriptions
const getTraitDescription = (dimension: string, value: number): string => {
  const descriptions: Record<string, string> = {
    formality: value > 0.7 ? "You communicate with professional structure and proper language" : "You prefer casual, approachable communication",
    enthusiasm: value > 0.7 ? "Your passion and energy shine through in your communication" : "You maintain a calm, measured communication style",
    directness: value > 0.7 ? "You get straight to the point with clear, concise messaging" : "You prefer nuanced, detailed explanations",
    empathy: value > 0.7 ? "You naturally consider others' perspectives and feelings" : "You focus on facts and logical reasoning",
    confidence: value > 0.7 ? "You speak with authority and self-assurance" : "You take a humble, collaborative approach",
    humor: value > 0.7 ? "You use wit and humor to connect with your audience" : "You maintain a serious, professional tone",
    storytelling: value > 0.7 ? "You excel at using narratives to illustrate points" : "You prefer data and direct statements",
    technicality: value > 0.7 ? "You comfortably use industry jargon and technical details" : "You explain concepts in accessible language",
    authority: value > 0.7 ? "You position yourself as a subject matter expert" : "You present ideas as suggestions or insights",
    vulnerability: value > 0.7 ? "You're open about challenges and learning experiences" : "You project strength and competence",
    optimism: value > 0.7 ? "You focus on possibilities and positive outcomes" : "You take a realistic, balanced perspective",
    brevity: value > 0.7 ? "You communicate efficiently with minimal words" : "You provide comprehensive, detailed explanations",
    curiosity: value > 0.7 ? "You ask questions and explore new perspectives" : "You share established knowledge and expertise",
    authenticity: value > 0.7 ? "Your genuine personality comes through clearly" : "You maintain professional boundaries in communication"
  };
  
  return descriptions[dimension] || "This trait influences your communication style";
};

// Helper function to get growth suggestions
const getGrowthSuggestion = (dimension: string, value: number): string => {
  const suggestions: Record<string, string> = {
    formality: "Consider when formal structure might enhance your credibility",
    enthusiasm: "Try expressing more passion for topics you care about",
    directness: "Practice getting to your main point more quickly",
    empathy: "Consider how your message affects your audience",
    confidence: "Trust your expertise and speak with more authority",
    humor: "Light humor can make you more relatable and memorable",
    storytelling: "Use examples and stories to make your points stick",
    technicality: "Don't be afraid to show your technical expertise when relevant",
    authority: "Position yourself as the expert you are",
    vulnerability: "Sharing challenges can build deeper connections",
    optimism: "Focus on possibilities and positive outcomes",
    brevity: "Practice communicating your key points more concisely",
    curiosity: "Ask more questions to engage your audience",
    authenticity: "Let more of your personality shine through"
  };
  
  return suggestions[dimension] || "This area offers growth potential";
};

// Helper function to generate style summary
const generateStyleSummary = (voiceSignature: VoiceSignature, topDimensions: any[]): string => {
  const traits = topDimensions.slice(0, 3).map(d => d.label.toLowerCase());
  const style = traits.join(", ");
  
  return `You communicate with a ${style} style. This authentic voice will help you create content that resonates with your professional audience and drives meaningful business outcomes.`;
};

export default React.memo(VoiceProfileVisualization);