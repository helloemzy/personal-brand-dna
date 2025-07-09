import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { selectWorkshopState, loadWorkshopState } from '../store/slices/workshopSlice';
import { workshopPersistence } from '../services/workshopPersistenceService';
import SEO from '../components/SEO';
import { seoService } from '../services/seoService';
import { 
  Award, 
  Target, 
  Share2, 
  Download, 
  Copy, 
  Check,
  Sparkles,
  Building,
  Users,
  Zap,
  Brain,
  TrendingUp,
  Layers,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { 
  determineArchetype, 
  generateMissionStatement,
  ArchetypeScore,
  archetypes 
} from '../services/archetypeService';
import { 
  analyzeWritingWithAI,
  analyzePersonalityWithAI,
  generateEnhancedMission
} from '../services/aiAnalysisService';
import { 
  mapContentPillars, 
  generateStarterContent, 
  type ContentPillarAnalysis 
} from '../services/contentPillarService';
import { 
  constructUVP, 
  generateUVPContentHooks,
  type UVPAnalysis 
} from '../services/uvpConstructorService';
import { generateBrandHousePDF, type BrandHouseReportData } from '../services/pdfExportService';
import { 
  generateActionableContent, 
  type ActionableContentPackage,
  type LinkedInHeadline,
  type ElevatorPitch
} from '../services/linkedinHeadlineService';
import ShareModal from '../components/workshop/ShareModal';
import { ShareData } from '../services/sharingService';

interface ArchetypeResult {
  primary: ArchetypeScore;
  secondary?: ArchetypeScore;
  hybrid?: {
    name: string;
    description: string;
    ratio: number;
  };
}

const WorkshopResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const workshopState = useAppSelector(selectWorkshopState);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [archetypeResult, setArchetypeResult] = useState<ArchetypeResult | null>(null);
  const [mission, setMission] = useState<string>('');
  const [aiMissions, setAiMissions] = useState<string[]>([]);
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0);
  const [contentPillars, setContentPillars] = useState<ContentPillarAnalysis | null>(null);
  const [starterContent, setStarterContent] = useState<string[]>([]);
  const [uvpAnalysis, setUvpAnalysis] = useState<UVPAnalysis | null>(null);
  const [selectedUvpIndex, setSelectedUvpIndex] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [actionableContent, setActionableContent] = useState<ActionableContentPackage | null>(null);
  const [selectedHeadlineIndex, setSelectedHeadlineIndex] = useState(0);
  const [selectedPitchType, setSelectedPitchType] = useState<'30-second' | '60-second' | 'networking-event'>('60-second');
  const [showShareModal, setShowShareModal] = useState(false);

  // Load persisted data if needed
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        setDataLoading(true);
        setLoadError(null);

        // Check if we already have data in Redux
        if (workshopState.values.selected.length > 0) {
          setDataLoading(false);
          return;
        }

        // Try to load from persistence service
        const persistedData = await workshopPersistence.load();
        
        if (persistedData && persistedData.values.selected.length > 0) {
          // Load the persisted data into Redux
          dispatch(loadWorkshopState(persistedData));
          setDataLoading(false);
          return;
        }

        // Check URL params for session ID
        const sessionId = searchParams.get('session');
        if (sessionId) {
          // Could attempt to load from API with session ID here
          // For now, we'll just note it exists
          console.log('Session ID in URL:', sessionId);
        }

        // If no data found after all attempts, show error
        setLoadError('No workshop data found. Please complete the assessment first.');
        setDataLoading(false);
      } catch (error) {
        console.error('Error loading persisted data:', error);
        setLoadError('Failed to load workshop data. Please try again.');
        setDataLoading(false);
      }
    };

    loadPersistedData();
  }, [dispatch, searchParams]);

  // Determine archetype after data is loaded
  useEffect(() => {
    const analyzeArchetype = async () => {
      // Don't analyze if still loading data or if there's an error
      if (dataLoading || loadError || !workshopState.values.selected.length) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Perform archetype analysis
        const result = await determineArchetype(workshopState);
        setArchetypeResult(result);

        // Generate basic mission
        const basicMission = generateMissionStatement(result.primary.archetype, workshopState);
        setMission(basicMission);
        
        // Generate content pillars
        const pillarAnalysis = mapContentPillars(workshopState, result.primary.archetype.name);
        setContentPillars(pillarAnalysis);
        
        // Generate starter content ideas
        const contentIdeas = generateStarterContent(
          pillarAnalysis, 
          result.primary.archetype.name,
          basicMission
        );
        setStarterContent(contentIdeas);
        
        // Generate UVP variations
        const uvp = constructUVP(workshopState, result.primary.archetype.name);
        setUvpAnalysis(uvp);
        
        // Generate actionable content (headlines, pitches, starters)
        const actionable = generateActionableContent(
          workshopState,
          result.primary.archetype.name,
          uvp,
          pillarAnalysis.pillars
        );
        setActionableContent(actionable);

        // If we have writing sample and API key, perform enhanced analysis
        if (workshopState.writingSample?.text && process.env.REACT_APP_OPENAI_API_KEY) {
          const writingAnalysis = await analyzeWritingWithAI(
            workshopState.writingSample.text,
            archetypes
          );
          
          const personalityAnalysis = await analyzePersonalityWithAI(
            workshopState.personalityQuiz.responses,
            archetypes
          );

          const enhancedMissions = await generateEnhancedMission(
            result.primary.archetype,
            workshopState,
            writingAnalysis,
            personalityAnalysis
          );

          if (enhancedMissions.length > 0) {
            setAiMissions(enhancedMissions);
            setMission(enhancedMissions[0]);
          }
        }
      } catch (error) {
        console.error('Archetype analysis error:', error);
      } finally {
        setLoading(false);
      }
    };

    analyzeArchetype();
  }, [workshopState, dataLoading, loadError]);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleDownloadPDF = async () => {
    if (!archetypeResult || !contentPillars || !uvpAnalysis || downloadingPDF) return;

    setDownloadingPDF(true);
    const reportData: BrandHouseReportData = {
      workshopState,
      archetypeResult,
      mission: aiMissions.length > 0 ? aiMissions[selectedMissionIndex] : mission,
      contentPillars,
      uvpAnalysis,
      starterContent
    };

    try {
      await generateBrandHousePDF(reportData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // You could show an error toast here
    } finally {
      setDownloadingPDF(false);
    }
  };

  const getArchetypeIcon = (archetypeId: string) => {
    const iconMap: Record<string, any> = {
      'innovative-leader': Zap,
      'empathetic-expert': Users,
      'strategic-visionary': Target,
      'authentic-changemaker': Sparkles
    };
    return iconMap[archetypeId] || Brain;
  };

  const getArchetypeColor = (archetypeId: string) => {
    const colorMap: Record<string, string> = {
      'innovative-leader': 'blue',
      'empathetic-expert': 'green',
      'strategic-visionary': 'purple',
      'authentic-changemaker': 'orange'
    };
    return colorMap[archetypeId] || 'gray';
  };

  // Show loading state while loading data or analyzing
  if (dataLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Brain className="animate-pulse text-blue-600 mb-4 mx-auto" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {dataLoading ? 'Loading Your Workshop Data...' : 'Analyzing Your Brand DNA...'}
          </h2>
          <p className="text-gray-600">
            {dataLoading 
              ? 'Retrieving your saved progress' 
              : 'Using AI to determine your unique brand archetype'}
          </p>
        </div>
      </div>
    );
  }

  // Show error state if data loading failed
  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4 p-3 bg-red-100 rounded-full inline-block">
            <Building className="text-red-600" size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Results</h2>
          <p className="text-gray-600 mb-6">{loadError}</p>
          <button
            onClick={() => navigate('/brand-house')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Brand House Workshop
          </button>
        </div>
      </div>
    );
  }

  if (!archetypeResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Unable to analyze results. Please try again.</p>
          <button
            onClick={() => navigate('/brand-house')}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Return to Workshop
          </button>
        </div>
      </div>
    );
  }

  const { primary, secondary, hybrid } = archetypeResult;
  const ArchetypeIcon = getArchetypeIcon(primary.archetype.id);
  const primaryColor = getArchetypeColor(primary.archetype.id);

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const iconBgClasses = {
    blue: 'bg-blue-200',
    green: 'bg-green-200',
    purple: 'bg-purple-200',
    orange: 'bg-orange-200',
    gray: 'bg-gray-200'
  };

  // Generate dynamic SEO metadata
  const seoMetadata = primary && (aiMissions.length > 0 || mission) 
    ? seoService.getResultsPageMetadata({
        archetype: primary.archetype.name,
        missionStatements: aiMissions.length > 0 ? aiMissions : [mission]
      })
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <SEO customMetadata={seoMetadata} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Your Brand House is Ready!
          </h1>
          <p className="text-xl text-gray-600">
            AI-powered analysis of your unique professional brand
          </p>
        </div>

        {/* Archetype Card */}
        <div className={`rounded-xl border-2 p-8 mb-8 ${colorClasses[primaryColor as keyof typeof colorClasses]}`}>
          <div className="flex items-center justify-center mb-6">
            <div className={`p-4 rounded-full ${iconBgClasses[primaryColor as keyof typeof iconBgClasses]}`}>
              <ArchetypeIcon size={48} />
            </div>
          </div>
          
          {hybrid ? (
            <>
              <h2 className="text-3xl font-bold text-center mb-4">
                You're a {hybrid.name}
              </h2>
              <p className="text-lg text-center mb-4">
                {hybrid.description}
              </p>
              <div className="flex justify-center items-center gap-4 text-sm">
                <span className="font-medium">{Math.round(hybrid.ratio * 100)}% {primary.archetype.name}</span>
                <span className="text-gray-500">•</span>
                <span className="font-medium">{Math.round((1 - hybrid.ratio) * 100)}% {secondary?.archetype.name}</span>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-center mb-4">
                You're {primary.archetype.name.startsWith('I') || primary.archetype.name.startsWith('A') || primary.archetype.name.startsWith('E') ? 'an' : 'a'} {primary.archetype.name}
              </h2>
              <p className="text-lg text-center">
                {primary.archetype.description}
              </p>
            </>
          )}

          {/* Confidence Score */}
          <div className="mt-6 flex justify-center">
            <div className="bg-white bg-opacity-50 rounded-lg px-4 py-2 flex items-center gap-2">
              <BarChart3 size={16} />
              <span className="text-sm font-medium">
                {Math.round(primary.confidence * 100)}% Confidence
              </span>
            </div>
          </div>
        </div>

        {/* Archetype Breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex items-center mb-6">
            <Brain className="text-gray-700 mr-3" size={24} />
            <h3 className="text-2xl font-bold text-gray-900">Archetype Analysis</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(primary.breakdown).map(([factor, score]) => (
              <div key={factor} className="text-center">
                <div className="mb-2">
                  <div className="text-sm text-gray-600 capitalize mb-1">{factor}</div>
                  <div className="h-20 bg-gray-200 rounded-lg relative overflow-hidden">
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all duration-500"
                      style={{ height: `${score * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm font-medium">{Math.round(score * 100)}%</div>
              </div>
            ))}
          </div>

          {secondary && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                Secondary Archetype: <span className="font-medium">{secondary.archetype.name}</span> ({Math.round(secondary.score * 100)}%)
              </p>
            </div>
          )}
        </div>

        {/* Values Foundation */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex items-center mb-6">
            <Building className="text-gray-700 mr-3" size={24} />
            <h3 className="text-2xl font-bold text-gray-900">Your Foundation</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {workshopState.values.selected.slice(0, 6).map((value, index) => (
              <div 
                key={value} 
                className={`text-center p-4 rounded-lg ${
                  index < 2 ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <span className={`font-medium capitalize ${
                  index < 2 ? 'text-blue-700' : 'text-gray-700'
                }`}>
                  {value}
                </span>
                {index < 2 && (
                  <div className="text-xs text-blue-600 mt-1">Core Value</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mission Statement */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex items-center mb-6">
            <Award className="text-gray-700 mr-3" size={24} />
            <h3 className="text-2xl font-bold text-gray-900">Your Mission</h3>
          </div>
          
          {aiMissions.length > 1 ? (
            <div>
              <p className="text-lg text-gray-700 italic mb-4">
                "{aiMissions[selectedMissionIndex]}"
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Option {selectedMissionIndex + 1} of {aiMissions.length}</span>
                <div className="flex gap-1">
                  {aiMissions.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedMissionIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === selectedMissionIndex ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-lg text-gray-700 italic">
              "{mission}"
            </p>
          )}
        </div>

        {/* Unique Value Proposition */}
        {uvpAnalysis && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
            <div className="flex items-center mb-6">
              <Target className="text-gray-700 mr-3" size={24} />
              <h3 className="text-2xl font-bold text-gray-900">Your Unique Value Proposition</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-lg text-gray-800 font-medium mb-4">
                {uvpAnalysis.variations[selectedUvpIndex].fullStatement}
              </p>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700 font-medium mb-1">LinkedIn Headline:</p>
                <p className="text-blue-900">
                  {uvpAnalysis.variations[selectedUvpIndex].linkedinHeadline}
                </p>
              </div>
            </div>
            
            {/* UVP Variations Selector */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-500">Style:</span>
              <div className="flex gap-2">
                {uvpAnalysis.variations.map((variation, index) => (
                  <button
                    key={variation.id}
                    onClick={() => setSelectedUvpIndex(index)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      index === selectedUvpIndex 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {variation.type === 'standard' && 'Comprehensive'}
                    {variation.type === 'results-focused' && 'Results-Focused'}
                    {variation.type === 'pain-focused' && 'Problem-Solving'}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Key Differentiators */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-gray-600 mb-2">Key Differentiators:</p>
              <div className="flex flex-wrap gap-2">
                {uvpAnalysis.variations[selectedUvpIndex].differentiators.map((diff, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {diff}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Competitive Positioning */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Market Position:</span> {uvpAnalysis.industryContext.competitiveLandscape}
              </p>
            </div>
          </div>
        )}

        {/* LinkedIn Headlines & Elevator Pitches */}
        {actionableContent && (
          <>
            {/* LinkedIn Headlines */}
            <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
              <div className="flex items-center mb-6">
                <Building className="text-gray-700 mr-3" size={24} />
                <h3 className="text-2xl font-bold text-gray-900">Your LinkedIn Headlines</h3>
              </div>
              
              <div className="mb-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-4">
                  <p className="text-lg text-gray-800 font-medium mb-2">
                    {actionableContent.headlines[selectedHeadlineIndex].text}
                  </p>
                  <p className="text-sm text-gray-600">
                    {actionableContent.headlines[selectedHeadlineIndex].characterCount} characters
                    {actionableContent.headlines[selectedHeadlineIndex].characterCount <= 180 && 
                      <span className="text-green-600 ml-2">✓ Optimal length</span>
                    }
                  </p>
                </div>
                
                {/* Headline Type Selector */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-500">Style:</span>
                  <div className="flex flex-wrap gap-2">
                    {actionableContent.headlines.map((headline, index) => (
                      <button
                        key={headline.id}
                        onClick={() => setSelectedHeadlineIndex(index)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          index === selectedHeadlineIndex 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {headline.type === 'authority' && 'Authority'}
                        {headline.type === 'outcome' && 'Outcome-Focused'}
                        {headline.type === 'problem-solver' && 'Problem-Solver'}
                        {headline.type === 'transformation' && 'Transformation'}
                        {headline.type === 'unique-method' && 'Unique Method'}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Keywords */}
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-2">Optimized Keywords:</p>
                  <div className="flex flex-wrap gap-2">
                    {actionableContent.headlines[selectedHeadlineIndex].keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Elevator Pitches */}
            <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
              <div className="flex items-center mb-6">
                <Zap className="text-gray-700 mr-3" size={24} />
                <h3 className="text-2xl font-bold text-gray-900">Your Elevator Pitches</h3>
              </div>
              
              {/* Pitch Type Selector */}
              <div className="flex items-center gap-2 mb-6">
                <span className="text-sm text-gray-500">Duration:</span>
                <div className="flex gap-2">
                  {actionableContent.elevatorPitches.map((pitch) => (
                    <button
                      key={pitch.id}
                      onClick={() => setSelectedPitchType(pitch.duration)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        pitch.duration === selectedPitchType 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {pitch.duration === '30-second' && '30 Seconds'}
                      {pitch.duration === '60-second' && '60 Seconds'}
                      {pitch.duration === 'networking-event' && 'Networking Event'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Selected Pitch */}
              {(() => {
                const selectedPitch = actionableContent.elevatorPitches.find(
                  p => p.duration === selectedPitchType
                );
                return selectedPitch && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Hook:</p>
                      <p className="text-gray-800 font-medium italic">"{selectedPitch.hook}"</p>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Full Pitch:</p>
                      <p className="text-gray-800">{selectedPitch.text}</p>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Close:</p>
                      <p className="text-gray-800 font-medium italic">"{selectedPitch.close}"</p>
                    </div>
                    
                    <div className="flex items-center justify-between border-t pt-4">
                      <p className="text-sm text-gray-600">
                        Word count: {selectedPitch.wordCount} words
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPitch.keyPoints.map((point, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 bg-white rounded text-gray-600"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* Content Starter Pack */}
        {actionableContent && actionableContent.contentStarters.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
            <div className="flex items-center mb-6">
              <Lightbulb className="text-gray-700 mr-3" size={24} />
              <h3 className="text-2xl font-bold text-gray-900">Your Content Starter Pack</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              10 ready-to-use post ideas with headlines, hooks, and angles mapped to your content pillars
            </p>
            
            <div className="space-y-4">
              {actionableContent.contentStarters.slice(0, 10).map((starter) => {
                const pillarColors = {
                  'expertise': 'blue',
                  'experience': 'green',
                  'evolution': 'purple'
                };
                const engagementIcons = {
                  'educational': '🎓',
                  'inspirational': '✨',
                  'controversial': '🔥',
                  'storytelling': '📖'
                };
                const color = pillarColors[starter.pillar] || 'gray';
                const icon = engagementIcons[starter.engagementType] || '📝';
                
                return (
                  <div 
                    key={starter.id} 
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 flex-1 pr-4">
                        {starter.headline}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 bg-${color}-100 text-${color}-700 rounded-full capitalize`}>
                          {starter.pillar}
                        </span>
                        <span className="text-xl" title={starter.engagementType}>
                          {icon}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 italic mb-2">
                      Hook: "{starter.hook}"
                    </p>
                    
                    <p className="text-xs text-gray-500">
                      Angle: {starter.angle}
                    </p>
                  </div>
                );
              })}
            </div>
            
            <p className="text-xs text-gray-500 mt-6 text-center">
              Each post idea is crafted to match your {archetypeResult.primary.archetype.name} voice and engage your audience
            </p>
          </div>
        )}

        {/* Content Pillars Preview */}
        {contentPillars && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
            <div className="flex items-center mb-6">
              <Layers className="text-gray-700 mr-3" size={24} />
              <h3 className="text-2xl font-bold text-gray-900">Your Content Pillars</h3>
            </div>
            
            <p className="text-gray-600 mb-6">{contentPillars.contentStrategy}</p>
            
            <div className="grid md:grid-cols-3 gap-6">
              {contentPillars.pillars.map((pillar, index) => {
                const iconMap = {
                  'expertise': Lightbulb,
                  'experience': Users,
                  'evolution': TrendingUp
                };
                const colorMap = {
                  'expertise': 'blue',
                  'experience': 'green',
                  'evolution': 'purple'
                };
                const Icon = iconMap[pillar.id as keyof typeof iconMap] || Brain;
                const color = colorMap[pillar.id as keyof typeof colorMap] || 'gray';
                
                return (
                  <div key={pillar.id} className="text-center">
                    <div className={`bg-${color}-100 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center`}>
                      <Icon className={`text-${color}-600`} size={24} />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{pillar.name}</h4>
                    <p className="text-sm text-gray-600">{pillar.percentage}% of your content</p>
                    <p className="text-xs text-gray-500 mt-2">{pillar.description}</p>
                    
                    {/* Show topics on hover or expand */}
                    <details className="mt-4 text-left">
                      <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-800">
                        View topics ({pillar.topics.length})
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {pillar.topics.slice(0, 3).map((topic, idx) => (
                          <li key={idx} className="text-xs text-gray-600">• {topic}</li>
                        ))}
                        {pillar.topics.length > 3 && (
                          <li className="text-xs text-gray-500 italic">+ {pillar.topics.length - 3} more</li>
                        )}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Starter Content Ideas */}
        {starterContent.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-8 mb-8">
            <div className="flex items-center mb-6">
              <Sparkles className="text-purple-600 mr-3" size={24} />
              <h3 className="text-2xl font-bold text-gray-900">Your First 15 Content Ideas</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Ready-to-use content ideas aligned with your brand archetype and pillars
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {starterContent.map((idea, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <p className="text-sm text-gray-800">{idea}</p>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-500 mt-6 text-center">
              Click any idea to start creating content based on your unique voice profile
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-12">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloadingPDF ? (
              <>
                <Brain className="animate-pulse" size={20} />
                Generating PDF...
              </>
            ) : (
              <>
                <Download size={20} />
                Download Report
              </>
            )}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            <Share2 size={20} />
            Share Results
          </button>
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            {copied ? (
              <>
                <Check size={20} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={20} />
                Copy Link
              </>
            )}
          </button>
        </div>

        {/* Next Steps */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to Build Your Brand?
          </h3>
          <p className="text-gray-700 mb-6">
            Get AI-powered content that matches your {primary.archetype.name} voice and connects with your ideal audience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/news-setup')}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Set Up News Sources
            </button>
            <button
              onClick={() => navigate('/content')}
              className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              Generate Content
            </button>
            <button
              onClick={() => navigate('/tier-selection')}
              className="bg-gray-200 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              View Pricing
            </button>
          </div>
        </div>
      </div>
      
      {/* Share Modal */}
      {archetypeResult && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareData={{
            workshopState,
            archetypeResult,
            mission: aiMissions.length > 0 ? aiMissions[selectedMissionIndex] : mission,
            contentPillars,
            uvpAnalysis,
            actionableContent
          } as ShareData}
        />
      )}
    </div>
  );
};

export default WorkshopResultsPage;