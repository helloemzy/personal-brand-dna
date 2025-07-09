import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux';
import { selectWorkshopState } from '../store/slices/workshopSlice';
import { 
  Rss, 
  Plus, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Search,
  Filter,
  TrendingUp,
  Globe,
  Zap,
  ChevronRight,
  X,
  Info
} from 'lucide-react';
import {
  RSSFeed,
  FeedRecommendation,
  generateFeedRecommendations,
  validateFeed,
  getFeedCategories,
  generateKeywordSuggestions,
  createDefaultFeeds,
  FeedValidationResult
} from '../services/rssFeedService';
import { determineArchetype } from '../services/archetypeService';
import { mapContentPillars } from '../services/contentPillarService';

const EnhancedRSSSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const workshopState = useAppSelector(selectWorkshopState);
  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [recommendations, setRecommendations] = useState<FeedRecommendation[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [validatingFeed, setValidatingFeed] = useState(false);
  const [validationResult, setValidationResult] = useState<FeedValidationResult | null>(null);
  
  // Custom feed form state
  const [customFeed, setCustomFeed] = useState({
    feedUrl: '',
    feedName: '',
    category: 'general',
    keywords: [] as string[]
  });
  const [keywordInput, setKeywordInput] = useState('');
  
  // Initialize personalized recommendations
  useEffect(() => {
    const initializeRecommendations = async () => {
      setLoading(true);
      try {
        // Determine user's archetype
        const archetypeResult = await determineArchetype(workshopState);
        const archetype = archetypeResult.primary.archetype.name;
        
        // Get content pillars
        const contentPillars = mapContentPillars(workshopState, archetype);
        
        // Generate personalized recommendations
        const feedRecs = generateFeedRecommendations(
          workshopState,
          archetype,
          contentPillars.pillars
        );
        setRecommendations(feedRecs);
        
        // Get relevant categories
        const cats = getFeedCategories(workshopState, archetype);
        setCategories(['all', ...cats]);
        
        // Generate keyword suggestions
        const keywords = generateKeywordSuggestions(workshopState, contentPillars.pillars);
        setSuggestedKeywords(keywords);
        
        // Create default feeds if first time
        if (feeds.length === 0) {
          const defaultFeeds = createDefaultFeeds(feedRecs);
          setFeeds(defaultFeeds);
        }
      } catch (error) {
        console.error('Error initializing recommendations:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (workshopState.values.selected.length > 0) {
      initializeRecommendations();
    } else {
      navigate('/brand-house');
    }
  }, [workshopState, navigate]);
  
  // Filter recommendations by category
  const filteredRecommendations = selectedCategory === 'all' 
    ? recommendations 
    : recommendations.filter(rec => rec.category === selectedCategory);
  
  // Handle adding a recommended feed
  const handleAddRecommendedFeed = (recommendation: FeedRecommendation) => {
    const newFeed: RSSFeed = {
      id: `feed-${Date.now()}`,
      feedUrl: recommendation.feedUrl,
      feedName: recommendation.feedName,
      feedType: 'rss',
      keywords: [],
      category: recommendation.category,
      isActive: true,
      lastFetched: new Date(),
      errorCount: 0
    };
    
    setFeeds([...feeds, newFeed]);
    
    // Remove from recommendations
    setRecommendations(recommendations.filter(r => r.feedUrl !== recommendation.feedUrl));
  };
  
  // Handle custom feed URL validation
  const handleValidateFeed = async () => {
    if (!customFeed.feedUrl) return;
    
    setValidatingFeed(true);
    setValidationResult(null);
    
    try {
      const result = await validateFeed(customFeed.feedUrl);
      setValidationResult(result);
      
      if (result.isValid && result.title) {
        setCustomFeed({
          ...customFeed,
          feedName: customFeed.feedName || result.title
        });
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: 'Failed to validate feed'
      });
    } finally {
      setValidatingFeed(false);
    }
  };
  
  // Handle adding custom feed
  const handleAddCustomFeed = () => {
    if (!customFeed.feedUrl || !customFeed.feedName) return;
    
    const newFeed: RSSFeed = {
      id: `feed-${Date.now()}`,
      feedUrl: customFeed.feedUrl,
      feedName: customFeed.feedName,
      feedType: 'rss',
      keywords: customFeed.keywords,
      category: customFeed.category,
      isActive: true,
      lastFetched: new Date(),
      errorCount: 0
    };
    
    setFeeds([...feeds, newFeed]);
    
    // Reset form
    setCustomFeed({
      feedUrl: '',
      feedName: '',
      category: 'general',
      keywords: []
    });
    setValidationResult(null);
    setShowAddCustom(false);
  };
  
  // Handle keyword input
  const handleAddKeyword = (keyword: string) => {
    if (keyword && !customFeed.keywords.includes(keyword)) {
      setCustomFeed({
        ...customFeed,
        keywords: [...customFeed.keywords, keyword]
      });
    }
    setKeywordInput('');
  };
  
  // Handle removing a feed
  const handleRemoveFeed = (feedId: string) => {
    setFeeds(feeds.filter(f => f.id !== feedId));
    
    // Add back to recommendations if it was a recommended feed
    const removedFeed = feeds.find(f => f.id === feedId);
    if (removedFeed) {
      const matchingRec = recommendations.find(r => r.feedUrl === removedFeed.feedUrl);
      if (!matchingRec) {
        // It might have been removed from recommendations, check original list
        // For now, we'll skip re-adding
      }
    }
  };
  
  // Handle toggling feed active state
  const handleToggleFeed = (feedId: string) => {
    setFeeds(feeds.map(f => 
      f.id === feedId ? { ...f, isActive: !f.isActive } : f
    ));
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="animate-pulse text-blue-600 mb-4 mx-auto" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Personalizing Your News Sources...</h2>
          <p className="text-gray-600">Analyzing your brand profile to find relevant feeds</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
            <Rss className="text-blue-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Set Up Your Content Inspiration
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            We've found news sources that match your brand archetype and content pillars. 
            Add the ones that resonate with your expertise.
          </p>
        </div>
        
        {/* Active Feeds Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Your News Sources</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {feeds.filter(f => f.isActive).length} active / {feeds.length} total
              </span>
              <button
                onClick={() => setShowAddCustom(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Add Custom Feed
              </button>
            </div>
          </div>
          
          {feeds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Rss className="mx-auto mb-3 text-gray-400" size={48} />
              <p>No feeds added yet. Choose from recommendations below or add a custom feed.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {feeds.map(feed => (
                <div
                  key={feed.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    feed.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      feed.isActive ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Rss className={feed.isActive ? 'text-green-600' : 'text-gray-400'} size={20} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${
                        feed.isActive ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {feed.feedName}
                      </h3>
                      <p className="text-sm text-gray-500">{feed.category}</p>
                      {feed.keywords.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {feed.keywords.map((kw, idx) => (
                            <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleFeed(feed.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        feed.isActive 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {feed.isActive ? 'Active' : 'Paused'}
                    </button>
                    <button
                      onClick={() => handleRemoveFeed(feed.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600">Filter by category:</span>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Personalized Recommendations */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-purple-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {filteredRecommendations.map((rec, index) => {
              const isAdded = feeds.some(f => f.feedUrl === rec.feedUrl);
              
              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 transition-all ${
                    isAdded 
                      ? 'border-gray-200 bg-gray-50 opacity-60'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{rec.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{rec.feedName}</h3>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {rec.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-500">
                      <TrendingUp size={14} />
                      <span className="text-xs font-medium">
                        {Math.round(rec.relevanceScore * 100)}% match
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 italic">{rec.matchReason}</p>
                    <button
                      onClick={() => handleAddRecommendedFeed(rec)}
                      disabled={isAdded}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        isAdded
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check size={14} />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          Add Feed
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {filteredRecommendations.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No recommendations in this category. Try selecting a different category or add a custom feed.
            </p>
          )}
        </div>
        
        {/* Suggested Keywords */}
        {suggestedKeywords.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Suggested Keywords</h3>
              <div className="group relative">
                <Info className="text-gray-400" size={16} />
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg">
                  Add these keywords to your feeds to filter for the most relevant content based on your brand pillars.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-white text-blue-700 rounded-full text-sm cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => setKeywordInput(keyword)}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/workshop/results')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Results
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            disabled={feeds.filter(f => f.isActive).length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Continue to Dashboard
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      
      {/* Add Custom Feed Modal */}
      {showAddCustom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Custom Feed</h3>
              <button
                onClick={() => {
                  setShowAddCustom(false);
                  setValidationResult(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Feed URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customFeed.feedUrl}
                    onChange={(e) => setCustomFeed({ ...customFeed, feedUrl: e.target.value })}
                    placeholder="https://example.com/rss"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleValidateFeed}
                    disabled={!customFeed.feedUrl || validatingFeed}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {validatingFeed ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700" />
                    ) : (
                      <Search size={20} />
                    )}
                  </button>
                </div>
                
                {validationResult && (
                  <div className={`mt-2 p-3 rounded-lg flex items-start gap-2 ${
                    validationResult.isValid ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {validationResult.isValid ? (
                      <Check className="text-green-600 mt-0.5" size={16} />
                    ) : (
                      <AlertCircle className="text-red-600 mt-0.5" size={16} />
                    )}
                    <div className="flex-1 text-sm">
                      {validationResult.isValid ? (
                        <div>
                          <p className="text-green-800 font-medium">Valid RSS feed detected!</p>
                          {validationResult.title && (
                            <p className="text-green-700">Title: {validationResult.title}</p>
                          )}
                          {validationResult.itemCount && (
                            <p className="text-green-700">Items found: {validationResult.itemCount}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-red-800">{validationResult.error}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Feed Name
                </label>
                <input
                  type="text"
                  value={customFeed.feedName}
                  onChange={(e) => setCustomFeed({ ...customFeed, feedName: e.target.value })}
                  placeholder="e.g., My Industry Blog"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={customFeed.category}
                  onChange={(e) => setCustomFeed({ ...customFeed, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords (optional)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeyword(keywordInput);
                      }
                    }}
                    placeholder="Add keyword and press Enter"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => handleAddKeyword(keywordInput)}
                    disabled={!keywordInput}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                
                {customFeed.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {customFeed.keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                      >
                        {kw}
                        <button
                          onClick={() => setCustomFeed({
                            ...customFeed,
                            keywords: customFeed.keywords.filter((_, i) => i !== idx)
                          })}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddCustom(false);
                    setValidationResult(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomFeed}
                  disabled={!customFeed.feedUrl || !customFeed.feedName || (validationResult && !validationResult.isValid)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Feed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRSSSetupPage;