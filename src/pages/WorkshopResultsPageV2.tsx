import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux';
import { selectWorkshopState } from '../store/slices/workshopSlice';
import workshopProcessingAPI from '../services/workshopProcessingAPI';
import { ProcessedResults, ProcessingStatus } from '../types/workshop';
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
  Lightbulb,
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { generateBrandHousePDF } from '../services/pdfExportService';
import ShareModal from '../components/workshop/ShareModal';
import { trackEvent } from '../services/trackingService';

const WorkshopResultsPageV2: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workshopState = useAppSelector(selectWorkshopState);
  
  // State management
  const [results, setResults] = useState<ProcessedResults | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  
  // UI state
  const [copied, setCopied] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0);
  const [selectedUvpStyle, setSelectedUvpStyle] = useState<'standard' | 'resultsFocused' | 'painFocused'>('standard');
  const [selectedHeadlineIndex, setSelectedHeadlineIndex] = useState(0);
  const [selectedPitchType, setSelectedPitchType] = useState<'30-second' | '60-second' | 'Networking Event'>('60-second');

  // Get session ID from URL or workshop state
  const sessionId = searchParams.get('session') || workshopState.sessionId || 'default';

  // Load or process results
  useEffect(() => {
    loadResults();
  }, [sessionId]);

  // Poll for processing status if in progress
  useEffect(() => {
    if (processingStatus?.status === 'processing') {
      const interval = setInterval(async () => {
        const status = await workshopProcessingAPI.getStatus(sessionId);
        if (status) {
          setProcessingStatus(status);
          if (status.status === 'completed') {
            clearInterval(interval);
            loadResults();
          } else if (status.status === 'error') {
            clearInterval(interval);
            setError('Processing failed. Please try again.');
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [processingStatus, sessionId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to get existing results
      const response = await workshopProcessingAPI.getResults(sessionId);
      
      if (response.success && response.results) {
        setResults(response.results);
        trackEvent('workshop_results_loaded', { sessionId });
      } else if (response.error?.code === 'PROCESSING_IN_PROGRESS') {
        // Show processing status
        const status = await workshopProcessingAPI.getStatus(sessionId);
        setProcessingStatus(status);
      } else if (workshopState.currentStep === 5 && workshopState.values.selected.length > 0) {
        // Process workshop data if we have it
        await processWorkshopData();
      } else {
        setError('No workshop data found. Please complete the workshop first.');
      }
    } catch (err) {
      console.error('Failed to load results:', err);
      setError('Failed to load results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const processWorkshopData = async () => {
    try {
      setProcessingStatus({
        status: 'processing',
        progress: 0,
        lastUpdated: new Date().toISOString()
      });

      const response = await workshopProcessingAPI.processWorkshop(workshopState, sessionId);
      
      if (response.success && response.results) {
        setResults(response.results);
        setProcessingStatus({
          status: 'completed',
          progress: 100,
          lastUpdated: new Date().toISOString()
        });
        trackEvent('workshop_results_processed', { sessionId });
      } else {
        throw new Error(response.error?.message || 'Processing failed');
      }
    } catch (err) {
      console.error('Failed to process workshop:', err);
      setError('Failed to process your workshop data. Please try again.');
      setProcessingStatus({
        status: 'error',
        progress: 0,
        lastUpdated: new Date().toISOString(),
        error: {
          code: 'PROCESSING_FAILED',
          message: err.message
        }
      });
    }
  };

  const handleRetry = async () => {
    try {
      setRetrying(true);
      setError(null);
      
      const response = await workshopProcessingAPI.retryProcessing(sessionId);
      
      if (response.success && response.results) {
        setResults(response.results);
        trackEvent('workshop_results_retry_success', { sessionId });
      } else {
        throw new Error(response.error?.message || 'Retry failed');
      }
    } catch (err) {
      console.error('Retry failed:', err);
      setError('Failed to retry processing. Please try again later.');
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyMission = () => {
    if (results?.mission[selectedMissionIndex]) {
      navigator.clipboard.writeText(results.mission[selectedMissionIndex]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('mission_copied', { sessionId });
    }
  };

  const handleDownloadPDF = async () => {
    if (!results) return;

    try {
      setDownloadingPDF(true);
      
      const reportData = {
        archetype: results.archetype,
        mission: results.mission,
        values: workshopState.values,
        tone: workshopState.tone,
        audience: workshopState.audience,
        contentPillars: results.contentPillars,
        uvp: results.uvp,
        headlines: results.headlines,
        elevatorPitches: results.elevatorPitches,
        contentIdeas: results.contentIdeas
      };

      await generateBrandHousePDF(reportData);
      trackEvent('pdf_downloaded', { sessionId });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
    trackEvent('share_modal_opened', { sessionId });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  // Processing state
  if (processingStatus?.status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <Brain className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold mb-2">Processing Your Brand DNA</h2>
            <p className="text-gray-600 mb-4">
              Our AI is analyzing your workshop responses to create your personalized brand framework...
            </p>
          </div>
          
          <div className="bg-gray-200 rounded-full h-4 mb-4">
            <div 
              className="bg-purple-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${processingStatus.progress}%` }}
            />
          </div>
          
          <p className="text-sm text-gray-500">{processingStatus.progress}% complete</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !results) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error || 'Unable to load your results'}</p>
          
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {retrying ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Try Again
                </>
              )}
            </button>
            
            <button
              onClick={() => navigate('/brand-house')}
              className="w-full px-6 py-3 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
            >
              Return to Workshop
            </button>
          </div>
        </div>
      </div>
    );
  }

  const archetype = results.archetype?.archetype;
  const currentMission = results.mission[selectedMissionIndex];
  const currentUvp = results.uvp?.variations[selectedUvpStyle];
  const currentHeadline = results.headlines[selectedHeadlineIndex];
  const currentPitch = results.elevatorPitches.find(p => p.duration === selectedPitchType);

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO {...seoService.getWorkshopResultsSEO()} />
      
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Your Brand House Results</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {downloadingPDF ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                Download Report
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                Share Results
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Archetype Section */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-purple-600" />
              <h2 className="text-3xl font-bold">Your Brand Archetype</h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Confidence Score</p>
              <p className="text-2xl font-bold text-purple-600">
                {Math.round((results.archetype?.confidence || 0) * 100)}%
              </p>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-6 mb-6">
            <h3 className="text-2xl font-bold mb-2 text-purple-800">
              {archetype?.name || 'Your Archetype'}
            </h3>
            <p className="text-lg text-purple-700">
              {archetype?.description || 'Your unique brand personality'}
            </p>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(results.archetype?.breakdown || {}).map(([factor, score]) => (
              <div key={factor} className="text-center">
                <div className="mb-2">
                  <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-purple-600">
                      {Math.round(score * 100)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 capitalize">{factor}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mission Section */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-8 h-8 text-purple-600" />
            <h2 className="text-3xl font-bold">Your Mission Statement</h2>
          </div>

          {results.mission.length > 1 && (
            <div className="flex gap-2 mb-4">
              {results.mission.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedMissionIndex(index)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedMissionIndex === index
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Option {index + 1}
                </button>
              ))}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 relative">
            <p className="text-xl italic text-gray-800">"{currentMission}"</p>
            <button
              onClick={handleCopyMission}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* UVP Section */}
        {results.uvp && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="w-8 h-8 text-purple-600" />
              <h2 className="text-3xl font-bold">Your Unique Value Proposition</h2>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedUvpStyle('standard')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedUvpStyle === 'standard'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setSelectedUvpStyle('resultsFocused')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedUvpStyle === 'resultsFocused'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Results-Focused
              </button>
              <button
                onClick={() => setSelectedUvpStyle('painFocused')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedUvpStyle === 'painFocused'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pain-Focused
              </button>
            </div>

            <div className="bg-purple-50 rounded-lg p-6 mb-4">
              <p className="text-lg">{currentUvp}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600">Key Differentiators:</p>
              <div className="flex flex-wrap gap-2">
                {results.uvp.differentiators.map((diff, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                  >
                    {diff}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content Pillars Section */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Layers className="w-8 h-8 text-purple-600" />
            <h2 className="text-3xl font-bold">Your Content Pillars</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {results.contentPillars.map((pillar, index) => (
              <div
                key={index}
                className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
                style={{ borderColor: pillar.color }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">{pillar.name}</h3>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: pillar.color }}
                  >
                    {pillar.percentage}%
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{pillar.description}</p>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Topics:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {pillar.topics.slice(0, 3).map((topic, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2">•</span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LinkedIn Headlines Section */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-8 h-8 text-purple-600" />
            <h2 className="text-3xl font-bold">LinkedIn Headlines</h2>
          </div>

          <div className="space-y-4">
            {results.headlines.map((headline, index) => (
              <div
                key={index}
                onClick={() => setSelectedHeadlineIndex(index)}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedHeadlineIndex === index
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-purple-600 mb-1">{headline.style}</p>
                    <p className="text-lg">{headline.headline}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className={`text-sm font-semibold ${
                      headline.isOptimalLength ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {headline.length}/220
                    </p>
                  </div>
                </div>
                {headline.keywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {headline.keywords.map((keyword, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Elevator Pitches Section */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <h2 className="text-3xl font-bold">Elevator Pitches</h2>
          </div>

          <div className="flex gap-2 mb-6">
            {['30-second', '60-second', 'Networking Event'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedPitchType(type as any)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedPitchType === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {currentPitch && (
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold">{currentPitch.type}</h4>
                <span className="text-sm text-gray-500">{currentPitch.wordCount} words</span>
              </div>
              <p className="text-gray-800 mb-4">{currentPitch.pitch}</p>
              <div className="flex flex-wrap gap-2">
                {currentPitch.keyPoints.map((point, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                    {point}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Ideas Section */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lightbulb className="w-8 h-8 text-purple-600" />
            <h2 className="text-3xl font-bold">Content Starter Pack</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.contentIdeas.slice(0, 10).map((idea, index) => (
              <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold flex-1">{idea.title}</h4>
                  <span className={`text-xs px-2 py-1 rounded ml-2 ${
                    idea.pillar === 'Expertise' ? 'bg-blue-100 text-blue-700' :
                    idea.pillar === 'Experience' ? 'bg-green-100 text-green-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {idea.pillar}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{idea.hook}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{idea.angle}</span>
                  <span className="text-xs text-gray-500">{idea.engagementType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl shadow-lg p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Build Your Brand?</h2>
          <p className="text-xl mb-8 opacity-90">
            Start creating content that resonates with your audience
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/content-generation')}
              className="px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Creating Content
            </button>
            <button
              onClick={() => navigate('/news-setup')}
              className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition-colors"
            >
              Set Up News Sources
            </button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && results && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareData={{
            archetype: archetype?.name || '',
            mission: currentMission,
            values: workshopState.values.selected,
            pillars: results.contentPillars.map(p => p.name),
            shareUrl: `${window.location.origin}/share/${sessionId}`
          }}
        />
      )}
    </div>
  );
};

export default WorkshopResultsPageV2;