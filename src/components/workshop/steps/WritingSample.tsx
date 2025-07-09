import React, { useState, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Upload, FileText, BarChart3, AlertCircle, CheckCircle, Sparkles, Target } from 'lucide-react';
import { 
  selectWorkshopState,
  setWritingSample,
  updateAnalysisResults
} from '../../../store/slices/workshopSlice';
import { AppDispatch } from '../../../store';

// Type for writing prompts
interface WritingPrompt {
  title: string;
  prompt: string;
  category: 'expertise' | 'experience' | 'evolution';
  tags: string[];
  personalized?: boolean;
}

// Base writing prompts
const baseWritingPrompts: WritingPrompt[] = [
  {
    title: 'Professional Achievement',
    prompt: 'Describe a recent professional achievement or project you\'re proud of. What was the challenge, your approach, and the outcome?',
    category: 'expertise',
    tags: ['achievement', 'results', 'expertise']
  },
  {
    title: 'Industry Insight',
    prompt: 'Share your perspective on a current trend or challenge in your industry. What do you think professionals should know about it?',
    category: 'evolution',
    tags: ['trends', 'insights', 'thought-leadership']
  },
  {
    title: 'Leadership Experience',
    prompt: 'Write about a time when you led a team or initiative. What leadership lessons did you learn from the experience?',
    category: 'experience',
    tags: ['leadership', 'teams', 'lessons']
  },
  {
    title: 'Problem-Solution Story',
    prompt: 'Describe a complex problem you solved at work. Walk through your thought process and the solution you implemented.',
    category: 'expertise',
    tags: ['problem-solving', 'analytical', 'technical']
  },
  {
    title: 'Career Journey',
    prompt: 'Tell the story of a pivotal moment in your career that shaped who you are professionally today.',
    category: 'experience',
    tags: ['journey', 'growth', 'personal']
  },
  {
    title: 'Future Vision',
    prompt: 'What change do you want to see in your industry in the next 5 years? How are you contributing to making it happen?',
    category: 'evolution',
    tags: ['vision', 'innovation', 'change']
  }
];

// Function to generate personalized prompts based on user data
const generatePersonalizedPrompts = (workshopState: any): WritingPrompt[] => {
  const prompts = [...baseWritingPrompts];
  const personalizedPrompts: WritingPrompt[] = [];
  
  // Get user's primary audience
  const primaryAudience = workshopState.audiencePersonas?.find((p: any) => p.isPrimary) || workshopState.audiencePersonas?.[0];
  
  // Get user's top values
  const topValues = workshopState.values?.primary || [];
  const valueName = topValues.length > 0 ? topValues[0] : null;
  
  // Add value-based prompt if user has selected values
  if (valueName && workshopState.values?.selected) {
    const valueObj = workshopState.values.selected.find((v: string) => v === valueName);
    personalizedPrompts.push({
      title: 'Living Your Values',
      prompt: `Share a specific example of how you've demonstrated ${valueName} in your professional life. What happened and what impact did it have?`,
      category: 'experience',
      tags: ['values', 'authenticity', 'personal'],
      personalized: true
    });
  }
  
  // Add audience-based prompt if user has defined personas
  if (primaryAudience) {
    personalizedPrompts.push({
      title: 'Client Transformation',
      prompt: `Describe a time when you helped a ${primaryAudience.role} in ${primaryAudience.industry} overcome a significant challenge. What was their situation before and after working with you?`,
      category: 'expertise',
      tags: ['transformation', 'impact', 'client-success'],
      personalized: true
    });
    
    // Add transformation-focused prompt if transformation data exists
    if (primaryAudience.transformation?.outcome) {
      personalizedPrompts.push({
        title: 'Transformation Story',
        prompt: `Tell the story of how you helped someone achieve this transformation: "${primaryAudience.transformation.outcome}". Include specific details about their journey.`,
        category: 'experience',
        tags: ['transformation', 'results', 'storytelling'],
        personalized: true
      });
    }
  }
  
  // Add industry-specific prompt
  const industry = primaryAudience?.industry || 'your industry';
  personalizedPrompts.push({
    title: 'Industry Expertise',
    prompt: `What's one thing about ${industry} that most people misunderstand? Share your insider perspective and explain why this matters.`,
    category: 'expertise',
    tags: ['expertise', 'insights', 'education'],
    personalized: true
  });
  
  // Return personalized prompts first, then base prompts
  return [...personalizedPrompts, ...prompts].slice(0, 8);
};

// Analysis metrics display component
const AnalysisResults: React.FC<{
  results: {
    readability: number;
    sentiment: Record<string, number>;
    styleMetrics: Record<string, any>;
  };
}> = ({ results }) => {
  const getReadabilityLabel = (score: number) => {
    if (score >= 80) return { label: 'Very Easy', color: 'text-green-600' };
    if (score >= 60) return { label: 'Easy', color: 'text-green-500' };
    if (score >= 40) return { label: 'Moderate', color: 'text-yellow-600' };
    if (score >= 20) return { label: 'Difficult', color: 'text-orange-600' };
    return { label: 'Very Difficult', color: 'text-red-600' };
  };

  const readability = getReadabilityLabel(results.readability);

  return (
    <div className="mt-6 p-6 bg-blue-50 rounded-lg">
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <BarChart3 className="w-5 h-5 mr-2" />
        Writing Analysis Results
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Readability Score */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Readability</p>
          <p className={`text-2xl font-bold ${readability.color}`}>
            {results.readability}
          </p>
          <p className="text-sm text-gray-600">{readability.label}</p>
        </div>

        {/* Sentiment Analysis */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Tone Sentiment</p>
          <div className="space-y-1">
            {Object.entries(results.sentiment).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-gray-600 capitalize">{key}:</span>
                <span className="font-medium">{Math.round(value * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Style Metrics */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Writing Style</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Avg Sentence:</span>
              <span className="font-medium">{results.styleMetrics['avgSentenceLength']} words</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Complexity:</span>
              <span className="font-medium">{results.styleMetrics['complexity']}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Voice:</span>
              <span className="font-medium">{results.styleMetrics['voice']}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-white rounded-md">
        <p className="text-sm text-gray-700">
          <strong>Key Insights:</strong> Your writing style is {readability.label.toLowerCase()} to read, 
          with a {results.styleMetrics['voice']} voice and {results.styleMetrics['complexity']} complexity. 
          This analysis helps us match your natural communication style.
        </p>
      </div>
    </div>
  );
};

// Main component
const WritingSample: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const workshopState = useSelector(selectWorkshopState);
  const { writingSample } = workshopState;
  const [text, setText] = useState(writingSample?.text || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<number | null>(null);
  const [promptCategory, setPromptCategory] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Generate personalized prompts
  const writingPrompts = useMemo(() => generatePersonalizedPrompts(workshopState), [workshopState]);

  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  const minWords = 150;
  const maxWords = 1000;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setText(content);
      };
      reader.readAsText(file);
    }
  };

  const analyzeWriting = async () => {
    if (wordCount < minWords) return;

    setIsAnalyzing(true);

    // Save the writing sample
    dispatch(setWritingSample({
      text,
      wordCount,
      uploadedAt: new Date().toISOString()
    }));

    // Simulate analysis (in production, this would call an API)
    setTimeout(() => {
      const mockResults = {
        readability: 65 + Math.random() * 20,
        sentiment: {
          positive: 0.6 + Math.random() * 0.2,
          neutral: 0.2 + Math.random() * 0.1,
          professional: 0.7 + Math.random() * 0.2
        },
        styleMetrics: {
          avgSentenceLength: 12 + Math.floor(Math.random() * 8),
          complexity: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
          voice: ['Active', 'Mixed', 'Passive'][Math.floor(Math.random() * 3)],
          formality: 0.5 + Math.random() * 0.3
        }
      };

      dispatch(updateAnalysisResults(mockResults));
      setIsAnalyzing(false);
    }, 2000);
  };

  const handlePromptSelect = (index: number) => {
    setSelectedPrompt(index);
    // Optionally pre-fill with prompt text
    if (!text) {
      if (writingPrompts[index]) {
        setText(`[${writingPrompts[index].title}]\n\n`);
      }
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Share a Writing Sample
        </h2>
        <p className="text-gray-600">
          Provide a sample of your professional writing (150-1000 words). This helps us analyze 
          your natural communication style, tone, and patterns.
        </p>
        
        {/* Content Pillars Info */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <Target className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Your content will be analyzed for 3 pillars:</p>
              <ul className="space-y-1 text-blue-700">
                <li>• <strong>Expertise (40%):</strong> What you know - skills, insights, knowledge</li>
                <li>• <strong>Experience (35%):</strong> What you've learned - stories, lessons, journey</li>
                <li>• <strong>Evolution (25%):</strong> Where you're going - vision, trends, innovation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Writing Prompts */}
      <div className="mb-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Need inspiration? Try one of these prompts:
          </h3>
          
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setPromptCategory('all')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                promptCategory === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Prompts
            </button>
            <button
              onClick={() => setPromptCategory('expertise')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                promptCategory === 'expertise' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Expertise (40%)
            </button>
            <button
              onClick={() => setPromptCategory('experience')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                promptCategory === 'experience' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Experience (35%)
            </button>
            <button
              onClick={() => setPromptCategory('evolution')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                promptCategory === 'evolution' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Evolution (25%)
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {writingPrompts
            .filter(prompt => promptCategory === 'all' || prompt.category === promptCategory)
            .map((prompt, index) => (
              <button
                key={index}
                onClick={() => handlePromptSelect(index)}
                className={`
                  relative text-left p-4 rounded-lg border-2 transition-all
                  ${selectedPrompt === index
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                  }
                `}
              >
                {prompt.personalized && (
                  <div className="absolute top-2 right-2">
                    <Sparkles className="w-4 h-4 text-purple-600" title="Personalized for you" />
                  </div>
                )}
                <h4 className="font-medium text-gray-900 pr-8">{prompt.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{prompt.prompt}</p>
                <div className="mt-2 flex gap-1">
                  {prompt.tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Text Input Area */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            Your Writing Sample
          </label>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload .txt file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className={`text-sm ${
              wordCount < minWords ? 'text-red-600' : 
              wordCount > maxWords ? 'text-orange-600' : 'text-green-600'
            }`}>
              {wordCount} words
            </span>
          </div>
        </div>
        
        <textarea
          value={text}
          onChange={handleTextChange}
          placeholder="Paste or type your writing sample here..."
          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        
        {/* Word count guidance */}
        <div className="mt-2 flex items-center text-sm">
          {wordCount < minWords ? (
            <div className="flex items-center text-red-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              Need at least {minWords - wordCount} more words
            </div>
          ) : wordCount > maxWords ? (
            <div className="flex items-center text-orange-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              Please reduce by {wordCount - maxWords} words
            </div>
          ) : (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              Good length for analysis
            </div>
          )}
        </div>
      </div>

      {/* Analyze Button */}
      {!writingSample?.analysisResults && (
        <button
          onClick={analyzeWriting}
          disabled={wordCount < minWords || wordCount > maxWords || isAnalyzing}
          className={`
            w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center
            ${wordCount >= minWords && wordCount <= maxWords && !isAnalyzing
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
              Analyzing your writing style...
            </>
          ) : (
            <>
              <BarChart3 className="w-5 h-5 mr-2" />
              Analyze Writing Style
            </>
          )}
        </button>
      )}

      {/* Analysis Results */}
      {writingSample?.analysisResults && (
        <AnalysisResults results={writingSample.analysisResults} />
      )}

      {/* Privacy Note */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-start">
          <FileText className="w-5 h-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">Privacy & Security</p>
            <p>
              Your writing sample is used solely to analyze your communication style and is never 
              shared or used for any other purpose. You can delete your data at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WritingSample;