import React from 'react';
import { Lightbulb, BookOpen, Users, TrendingUp, MessageCircle, Hash } from 'lucide-react';

interface ContentIdea {
  pillar: string;
  headline: string;
  hook: string;
  angle: string;
  engagementType: string;
}

interface ContentPillar {
  name: string;
  percentage: number;
  color: string;
}

interface ContentStarterPackProps {
  ideas: ContentIdea[];
  contentPillars: ContentPillar[];
}

const ContentStarterPack: React.FC<ContentStarterPackProps> = ({
  ideas,
  contentPillars
}) => {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);
  const [filterPillar, setFilterPillar] = React.useState<string>('all');

  const engagementIcons = {
    educational: BookOpen,
    inspirational: TrendingUp,
    controversial: MessageCircle,
    storytelling: Users
  };

  const pillarColors = {
    Expertise: 'blue',
    Experience: 'purple',
    Evolution: 'green'
  };

  const filteredIdeas = filterPillar === 'all' 
    ? ideas 
    : ideas.filter(idea => idea.pillar === filterPillar);

  const getPillarStyle = (pillar: string) => {
    const color = pillarColors[pillar as keyof typeof pillarColors] || 'gray';
    return {
      bg: `bg-${color}-50`,
      text: `text-${color}-700`,
      border: `border-${color}-200`,
      hover: `hover:bg-${color}-100`
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Lightbulb className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Content Starter Pack</h3>
        </div>
        <span className="text-sm text-gray-600">
          {filteredIdeas.length} ideas ready to use
        </span>
      </div>

      {/* Pillar filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterPillar('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filterPillar === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Pillars
          </button>
          {contentPillars.map((pillar) => {
            const isActive = filterPillar === pillar.name;
            return (
              <button
                key={pillar.name}
                onClick={() => setFilterPillar(pillar.name)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive
                    ? `bg-${pillar.color}-100 text-${pillar.color}-700 border-2 border-${pillar.color}-300`
                    : 'bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                {pillar.name}
                <span className="text-xs">({pillar.percentage}%)</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content ideas grid */}
      <div className="grid gap-4">
        {filteredIdeas.map((idea, index) => {
          const Icon = engagementIcons[idea.engagementType as keyof typeof engagementIcons] || Lightbulb;
          const isExpanded = expandedIndex === index;
          const pillarStyle = getPillarStyle(idea.pillar);
          
          return (
            <div
              key={index}
              className={`border rounded-lg transition-all cursor-pointer ${
                isExpanded ? 'border-gray-300 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${pillarStyle.bg} ${pillarStyle.text}`}>
                        {idea.pillar}
                      </span>
                      <Icon className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 capitalize">
                        {idea.engagementType}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">
                      {idea.headline}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {idea.hook}
                    </p>
                  </div>
                  <button
                    className="flex-shrink-0 p-1 hover:bg-gray-100 rounded"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    <svg
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Content Angle:</h5>
                      <p className="text-sm text-gray-600">{idea.angle}</p>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Suggested Hashtags:</h5>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Hash className="w-3 h-3" />
                          {idea.pillar.toLowerCase()}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Hash className="w-3 h-3" />
                          {idea.engagementType}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Hash className="w-3 h-3" />
                          linkedincontent
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // This would navigate to content creation with pre-filled data
                        console.log('Create content from idea:', idea);
                      }}
                      className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Create This Post
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Content distribution insight */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          📊 Content Distribution Strategy:
        </h4>
        <div className="space-y-2">
          {contentPillars.map((pillar) => {
            const count = ideas.filter(i => i.pillar === pillar.name).length;
            return (
              <div key={pillar.name} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{pillar.name}</span>
                    <span className="text-gray-500">{count} ideas ({pillar.percentage}%)</span>
                  </div>
                  <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${pillar.color}-500 transition-all`}
                      style={{ width: `${pillar.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ContentStarterPack;