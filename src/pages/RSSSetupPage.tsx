import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface RSSFeed {
  id?: string;
  feedUrl: string;
  feedName: string;
  feedType: 'rss' | 'google_alerts' | 'custom';
  keywords: string[];
  category: string;
  isActive: boolean;
}

interface NewsSource {
  name: string;
  description: string;
  url: string;
  category: string;
  icon: string;
}

const RSSSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken } = useSelector((state: RootState) => state.auth);
  
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [newFeed, setNewFeed] = useState<RSSFeed>({
    feedUrl: '',
    feedName: '',
    feedType: 'rss',
    keywords: [],
    category: 'general',
    isActive: true
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [testingFeed, setTestingFeed] = useState(false);

  // BrandPillar AI tier limits
  const tierLimits = {
    starter: 5,
    professional: 25,
    executive: 999
  };
  const userTier = (user?.subscriptionTier || 'starter') as keyof typeof tierLimits;
  const maxFeeds = tierLimits[userTier];

  // Popular news sources by category
  const suggestedSources: NewsSource[] = [
    // Technology
    {
      name: 'TechCrunch',
      description: 'Latest technology news and analysis',
      url: 'https://techcrunch.com/feed/',
      category: 'technology',
      icon: '💻'
    },
    {
      name: 'The Verge',
      description: 'Technology, science, art, and culture',
      url: 'https://www.theverge.com/rss/index.xml',
      category: 'technology',
      icon: '🔬'
    },
    {
      name: 'Hacker News',
      description: 'Top stories from tech community',
      url: 'https://news.ycombinator.com/rss',
      category: 'technology',
      icon: '🚀'
    },
    
    // Business
    {
      name: 'Harvard Business Review',
      description: 'Management tips and business strategy',
      url: 'https://hbr.org/feed',
      category: 'business',
      icon: '📊'
    },
    {
      name: 'Forbes',
      description: 'Business, investing, technology, entrepreneurship',
      url: 'https://www.forbes.com/real-time/feed2/',
      category: 'business',
      icon: '💼'
    },
    {
      name: 'Business Insider',
      description: 'Business, finance, and tech news',
      url: 'https://www.businessinsider.com/rss',
      category: 'business',
      icon: '📈'
    },
    
    // Marketing
    {
      name: 'Marketing Land',
      description: 'Digital marketing news and analysis',
      url: 'https://martech.org/feed/',
      category: 'marketing',
      icon: '📢'
    },
    {
      name: 'Seth Godin Blog',
      description: 'Marketing insights and wisdom',
      url: 'https://seths.blog/feed/',
      category: 'marketing',
      icon: '💡'
    },
    
    // Finance
    {
      name: 'Wall Street Journal',
      description: 'Business and financial news',
      url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
      category: 'finance',
      icon: '💰'
    },
    {
      name: 'Bloomberg',
      description: 'Global business and markets',
      url: 'https://feeds.bloomberg.com/markets/news.rss',
      category: 'finance',
      icon: '📉'
    }
  ];

  useEffect(() => {
    fetchUserFeeds();
  }, []);

  const fetchUserFeeds = async () => {
    try {
      const response = await fetch('/api/rss-monitoring/user-feeds', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFeeds(data.feeds);
      }
    } catch (error) {
      console.error('Error fetching feeds:', error);
    }
  };

  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      setNewFeed({
        ...newFeed,
        keywords: [...newFeed.keywords, keywordInput.trim()]
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setNewFeed({
      ...newFeed,
      keywords: newFeed.keywords.filter((_, i) => i !== index)
    });
  };

  const handleAddFeed = async () => {
    if (!newFeed.feedUrl || !newFeed.feedName) {
      setError('Please provide both feed URL and name');
      return;
    }

    if (feeds.length >= maxFeeds) {
      setError(`You've reached the limit of ${maxFeeds} feeds for your tier`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/rss-monitoring/add-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          userId: user?.id,
          ...newFeed
        })
      });

      if (response.ok) {
        const data = await response.json();
        setFeeds([...feeds, data.feed]);
        setNewFeed({
          feedUrl: '',
          feedName: '',
          feedType: 'rss',
          keywords: [],
          category: 'general',
          isActive: true
        });
        
        // Test the feed
        await testFeed(data.feed.id);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to add feed');
      }
    } catch (error) {
      setError('Failed to add feed');
    } finally {
      setLoading(false);
    }
  };

  const testFeed = async (feedId: string) => {
    setTestingFeed(true);
    try {
      const response = await fetch('/api/rss-monitoring/fetch-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          userId: user?.id,
          feedId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Feed test results:', data);
      }
    } catch (error) {
      console.error('Feed test error:', error);
    } finally {
      setTestingFeed(false);
    }
  };

  const handleQuickAdd = (source: NewsSource) => {
    setNewFeed({
      feedUrl: source.url,
      feedName: source.name,
      feedType: 'rss',
      keywords: [],
      category: source.category,
      isActive: true
    });
    setShowSuggestions(false);
  };

  const handleToggleFeed = async (feedId: string, isActive: boolean) => {
    try {
      await fetch(`/api/rss-monitoring/toggle-feed/${feedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ isActive })
      });

      setFeeds(feeds.map(f => 
        f.id === feedId ? { ...f, isActive } : f
      ));
    } catch (error) {
      console.error('Error toggling feed:', error);
    }
  };

  const handleContinue = () => {
    if (feeds.length === 0) {
      setError('Please add at least one news source to continue');
      return;
    }
    navigate('/content-dashboard');
  };

  const categories = ['general', 'technology', 'business', 'finance', 'marketing', 'industry-specific'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Set Up Your News Sources
          </h1>
          <p className="text-lg text-gray-600">
            Add RSS feeds to monitor for content opportunities
          </p>
          <div className="mt-4 bg-white rounded-lg px-4 py-2 inline-flex items-center">
            <span className="text-sm text-gray-500">Your tier allows</span>
            <span className="ml-2 font-semibold text-purple-600">
              {feeds.length} / {maxFeeds} feeds
            </span>
          </div>
        </div>

        {/* Quick Add Suggestions */}
        {showSuggestions && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Popular News Sources
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestedSources.map((source, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span className="text-2xl mr-2">{source.icon}</span>
                        <h3 className="font-semibold text-gray-900">
                          {source.name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {source.description}
                      </p>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {source.category}
                      </span>
                    </div>
                    <button
                      onClick={() => handleQuickAdd(source)}
                      className="ml-4 text-purple-600 hover:text-purple-700 font-medium text-sm"
                      disabled={feeds.length >= maxFeeds}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Custom Feed Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Add News Source
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feed Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="rss"
                    checked={newFeed.feedType === 'rss'}
                    onChange={(e) => setNewFeed({ ...newFeed, feedType: 'rss' })}
                    className="mr-2"
                  />
                  <span>RSS Feed</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="google_alerts"
                    checked={newFeed.feedType === 'google_alerts'}
                    onChange={(e) => setNewFeed({ ...newFeed, feedType: 'google_alerts' })}
                    className="mr-2"
                  />
                  <span>Google Alerts</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Feed Name
                </label>
                <input
                  type="text"
                  value={newFeed.feedName}
                  onChange={(e) => setNewFeed({ ...newFeed, feedName: e.target.value })}
                  placeholder="e.g., TechCrunch"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newFeed.category}
                  onChange={(e) => setNewFeed({ ...newFeed, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feed URL
              </label>
              <input
                type="url"
                value={newFeed.feedUrl}
                onChange={(e) => setNewFeed({ ...newFeed, feedUrl: e.target.value })}
                placeholder="https://example.com/rss"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter Keywords (optional)
              </label>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleAddKeyword}
                placeholder="Press Enter to add keywords"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {newFeed.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newFeed.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(index)}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              onClick={handleAddFeed}
              disabled={loading || feeds.length >= maxFeeds}
              className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Adding...' : 'Add Feed'}
            </button>
          </div>
        </div>

        {/* Active Feeds List */}
        {feeds.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Your News Sources
            </h2>
            <div className="space-y-3">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {feed.feedName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {feed.feedUrl}
                    </p>
                    {feed.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {feed.keywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={feed.isActive}
                        onChange={(e) => handleToggleFeed(feed.id!, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/tier-selection')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
          
          <button
            onClick={handleContinue}
            disabled={feeds.length === 0}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Continue to Dashboard →
          </button>
        </div>

        {testingFeed && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
              <span className="text-sm text-gray-600">Testing feed connection...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RSSSetupPage;