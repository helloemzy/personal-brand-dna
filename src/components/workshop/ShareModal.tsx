import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Linkedin, 
  Twitter, 
  Mail, 
  Code,
  ExternalLink,
  Share2
} from 'lucide-react';
import {
  createShareableLink,
  generateSocialShareTemplates,
  generateShareUrls,
  generateEmbedCode,
  trackShareEvent,
  ShareableLink,
  SocialShareTemplate,
  ShareData
} from '../../services/sharingService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: ShareData;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareData }) => {
  const [shareableLink, setShareableLink] = useState<ShareableLink | null>(null);
  const [templates, setTemplates] = useState<SocialShareTemplate[]>([]);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'share' | 'embed'>('share');
  const [selectedTemplate, setSelectedTemplate] = useState<number>(0);

  useEffect(() => {
    if (isOpen && shareData) {
      // Create shareable link
      const link = createShareableLink(shareData);
      setShareableLink(link);
      
      // Generate social templates
      const socialTemplates = generateSocialShareTemplates(shareData, link);
      setTemplates(socialTemplates);
    }
  }, [isOpen, shareData]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates({ ...copiedStates, [key]: true });
      setTimeout(() => {
        setCopiedStates({ ...copiedStates, [key]: false });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSocialShare = (template: SocialShareTemplate) => {
    if (!shareableLink) return;
    
    const shareUrl = generateShareUrls(template, shareableLink.fullUrl);
    trackShareEvent(shareableLink.id, template.platform);
    
    // Open share URL in new window
    window.open(shareUrl.url, '_blank', 'width=600,height=400');
  };

  if (!isOpen) return null;

  const platformIcons = {
    linkedin: Linkedin,
    twitter: Twitter,
    email: Mail
  };

  const platformColors = {
    linkedin: 'bg-blue-600 hover:bg-blue-700',
    twitter: 'bg-black hover:bg-gray-800',
    email: 'bg-gray-600 hover:bg-gray-700'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Share2 className="mr-2" size={24} />
            Share Your Brand House
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-3 px-6 font-medium transition-colors ${
              activeTab === 'share'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Share Results
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            className={`flex-1 py-3 px-6 font-medium transition-colors ${
              activeTab === 'embed'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Embed Badge
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'share' && shareableLink && (
            <>
              {/* Shareable Link */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Your Unique Link</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareableLink.fullUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => handleCopy(shareableLink.fullUrl, 'link')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    {copiedStates.link ? (
                      <>
                        <Check size={16} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Social Share Options */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Share on Social Media</h3>
                <div className="grid grid-cols-3 gap-3">
                  {templates.map((template, index) => {
                    const Icon = platformIcons[template.platform as keyof typeof platformIcons];
                    const color = platformColors[template.platform as keyof typeof platformColors];
                    
                    return (
                      <button
                        key={template.platform}
                        onClick={() => setSelectedTemplate(index)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          selectedTemplate === index
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon size={24} className="mx-auto mb-2" />
                        <span className="text-sm font-medium capitalize">
                          {template.platform}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Template Preview */}
              {templates[selectedTemplate] && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {templates[selectedTemplate].platform === 'email' ? 'Email Template' : 'Post Preview'}
                    </h3>
                    {templates[selectedTemplate].characterCount && (
                      <span className="text-sm text-gray-500">
                        {templates[selectedTemplate].characterCount} characters
                      </span>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {templates[selectedTemplate].content}
                    </p>
                    
                    {templates[selectedTemplate].hashtags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {templates[selectedTemplate].hashtags.map((tag, i) => (
                          <span key={i} className="text-sm text-blue-600">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCopy(
                        templates[selectedTemplate].content + '\n\n' + 
                        templates[selectedTemplate].hashtags.map(t => `#${t}`).join(' ') + '\n\n' +
                        shareableLink.fullUrl,
                        `template-${selectedTemplate}`
                      )}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedStates[`template-${selectedTemplate}`] ? (
                        <>
                          <Check size={16} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copy Text
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleSocialShare(templates[selectedTemplate])}
                      className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        platformColors[templates[selectedTemplate].platform as keyof typeof platformColors]
                      }`}
                    >
                      <ExternalLink size={16} />
                      Share on {templates[selectedTemplate].platform}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'embed' && shareableLink && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Embed on Your Website</h3>
              <p className="text-sm text-gray-600 mb-4">
                Add this badge to your website to showcase your Brand House results
              </p>
              
              {/* Badge Preview */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-[300px] mx-auto p-5 border border-gray-200 rounded-lg bg-white">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">My Brand Archetype</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Discover your professional brand DNA with AI-powered insights
                  </p>
                  <a 
                    href={shareableLink.fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    View My Results
                  </a>
                  <p className="text-xs text-gray-500 mt-4">Powered by BrandPillar AI</p>
                </div>
              </div>
              
              {/* Embed Code */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Code size={16} className="inline mr-1" />
                  Embed Code
                </label>
                <textarea
                  value={generateEmbedCode(shareableLink)}
                  readOnly
                  className="w-full h-32 px-3 py-2 text-sm font-mono bg-gray-900 text-gray-100 rounded-lg resize-none"
                  onClick={(e) => e.currentTarget.select()}
                />
              </div>
              
              <button
                onClick={() => handleCopy(generateEmbedCode(shareableLink), 'embed')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {copiedStates.embed ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy Embed Code
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;