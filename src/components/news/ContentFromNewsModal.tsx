import React, { useState } from 'react';
import { X, Sparkles, Send, Loader2 } from 'lucide-react';
import { useAppSelector } from '../../hooks/redux';
import { contentAPI } from '../../services/contentAPI';
import { toast } from '../Toast';
import ContentGenerationService from '../../services/contentGenerationService';
import LinkedInPostButton from '../linkedin/LinkedInPostButton';

interface ContentFromNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsItem: {
    title: string;
    url: string;
    summary?: string;
    source?: string;
  };
}

const ContentFromNewsModal: React.FC<ContentFromNewsModalProps> = ({
  isOpen,
  onClose,
  newsItem
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [variations, setVariations] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<number>(0);
  const [angle, setAngle] = useState<string>('professional-insight');
  const [contentId, setContentId] = useState<string>('');
  
  const workshopData = useAppSelector(state => state.workshop);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await contentAPI.generateContent({
        topic: newsItem.title,
        contentType: 'post',
        tone: 'thought-leader',
        includePersonalExperience: true,
        source: 'news',
        newsContext: {
          articleUrl: newsItem.url,
          articleTitle: newsItem.title,
          articleSummary: newsItem.summary || ''
        }
      });

      setGeneratedContent(response.data.content);
      setVariations(response.data.variations || []);
      setContentId(response.data.contentId);
      
      toast.success('Content Generated!', 'Your LinkedIn post has been created from the news article.');
    } catch (error) {
      console.error('Failed to generate content:', error);
      toast.error('Generation Failed', 'Unable to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const contentToCopy = selectedVariation === 0 
      ? generatedContent 
      : variations[selectedVariation - 1];
    
    navigator.clipboard.writeText(contentToCopy);
    toast.success('Copied!', 'Content copied to clipboard');
  };

  const handlePostToLinkedIn = () => {
    const contentToPost = selectedVariation === 0 
      ? generatedContent 
      : variations[selectedVariation - 1];
    
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?text=${encodeURIComponent(contentToPost)}`;
    window.open(linkedInUrl, '_blank');
  };

  if (!isOpen) return null;

  const archetype = workshopData.archetypeResult?.primary || 'Strategic Visionary';
  const hooks = ContentGenerationService.generateHooks(newsItem.title, archetype);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Content from News</h2>
              <p className="text-sm text-gray-600 mt-1">
                Transform this news into your unique LinkedIn perspective
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* News Article Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">{newsItem.title}</h3>
            {newsItem.source && (
              <p className="text-sm text-gray-600 mb-2">Source: {newsItem.source}</p>
            )}
            {newsItem.summary && (
              <p className="text-sm text-gray-700">{newsItem.summary}</p>
            )}
            <a 
              href={newsItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
            >
              Read full article →
            </a>
          </div>

          {/* Content Angle Selection */}
          {!generatedContent && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose your angle:
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'professional-insight', label: 'Professional Insight', icon: '💡' },
                  { id: 'industry-impact', label: 'Industry Impact', icon: '📊' },
                  { id: 'personal-story', label: 'Personal Story', icon: '📖' },
                  { id: 'contrarian-view', label: 'Contrarian View', icon: '🔥' }
                ].map(option => (
                  <button
                    key={option.id}
                    onClick={() => setAngle(option.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      angle === option.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.icon}</div>
                    <div className="text-sm font-medium">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hook Suggestions */}
          {!generatedContent && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggested hooks for your {archetype} style:
              </label>
              <div className="space-y-2">
                {hooks.slice(0, 3).map((hook, index) => (
                  <div 
                    key={index}
                    className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 italic"
                  >
                    "{hook}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Content */}
          {generatedContent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Generated Content</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedVariation}
                    onChange={(e) => setSelectedVariation(Number(e.target.value))}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1"
                  >
                    <option value={0}>Main Version</option>
                    {variations.map((_, index) => (
                      <option key={index + 1} value={index + 1}>
                        Variation {index + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div 
                  className="whitespace-pre-wrap text-gray-800"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    if (selectedVariation === 0) {
                      setGeneratedContent(e.currentTarget.textContent || '');
                    } else {
                      const newVariations = [...variations];
                      newVariations[selectedVariation - 1] = e.currentTarget.textContent || '';
                      setVariations(newVariations);
                    }
                  }}
                >
                  {selectedVariation === 0 ? generatedContent : variations[selectedVariation - 1]}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Copy to Clipboard
                </button>
                <LinkedInPostButton
                  content={selectedVariation === 0 ? generatedContent : variations[selectedVariation - 1]}
                  contentId={contentId}
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          {!generatedContent ? (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating your unique perspective...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Content
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setGeneratedContent('');
                  setVariations([]);
                  setSelectedVariation(0);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-300 transition-colors"
              >
                Generate New Version
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-md hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentFromNewsModal;