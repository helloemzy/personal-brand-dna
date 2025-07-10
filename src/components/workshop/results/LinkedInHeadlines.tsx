import React from 'react';
import { Linkedin, Copy, Check, TrendingUp } from 'lucide-react';
import { toast } from '../../Toast';

interface LinkedInHeadline {
  style: string;
  headline: string;
  keywords: string[];
  characterCount: number;
}

interface LinkedInHeadlinesProps {
  headlines: LinkedInHeadline[];
  selectedStyle: string;
  onStyleChange: (style: string) => void;
  archetype: string;
}

const LinkedInHeadlines: React.FC<LinkedInHeadlinesProps> = ({
  headlines,
  selectedStyle,
  onStyleChange,
  archetype
}) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopy = async (headline: string, index: number) => {
    try {
      await navigator.clipboard.writeText(headline);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      
      // Show enhanced toast notification
      toast.copy('LinkedIn headline');
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Copy failed', 'Please try again or select the text manually');
    }
  };

  const styleLabels: Record<string, string> = {
    authority: 'Authority-Based',
    outcome: 'Outcome-Focused',
    'problem-solver': 'Problem Solver',
    transformation: 'Transformation',
    'unique-method': 'Unique Method'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Linkedin className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">LinkedIn Headlines</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TrendingUp className="w-4 h-4" />
          <span>Optimized for {archetype}</span>
        </div>
      </div>

      {/* Style selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Choose your headline style:
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(styleLabels).map(([value, label]) => (
            <button
              key={value}
              onClick={() => onStyleChange(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedStyle === value
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected headline display */}
      {headlines.map((headline, index) => {
        if (headline.style !== selectedStyle) return null;
        
        return (
          <div key={index} className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-lg text-gray-800 leading-relaxed flex-1">
                  {headline.headline}
                </p>
                <button
                  onClick={() => handleCopy(headline.headline, index)}
                  className="flex-shrink-0 p-2 hover:bg-white rounded-lg transition-colors"
                  aria-label="Copy headline"
                  data-copy-button="linkedin-headline"
                >
                  {copiedIndex === index ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>
              
              <div className="mt-3 flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {headline.keywords.map((keyword, kidx) => (
                    <span 
                      key={kidx}
                      className="px-2 py-1 bg-white text-xs font-medium text-blue-700 rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                <span className={`text-sm font-medium ${
                  headline.characterCount <= 220 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {headline.characterCount}/220
                </span>
              </div>
            </div>

            {/* Additional variations preview */}
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Other styles available:</p>
              <div className="grid grid-cols-1 gap-2">
                {headlines
                  .filter(h => h.style !== selectedStyle)
                  .slice(0, 2)
                  .map((h, idx) => (
                    <button
                      key={idx}
                      onClick={() => onStyleChange(h.style)}
                      className="text-left p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-xs font-medium text-gray-500">
                        {styleLabels[h.style]}:
                      </span>
                      <p className="text-sm text-gray-700 line-clamp-1 mt-1">
                        {h.headline}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LinkedInHeadlines;