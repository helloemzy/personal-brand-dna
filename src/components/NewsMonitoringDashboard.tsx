import React, { useState, useEffect } from 'react';
import { 
  Newspaper, 
  TrendingUp, 
  Clock, 
  Filter, 
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Sparkles,
  BarChart3,
  Calendar,
  Hash,
  BookOpen
} from 'lucide-react';
import { FeedItem, FeedHealth, checkFeedHealth, parseFeedItems } from '../services/rssFeedService';
import { ContentPillarAnalysis } from '../services/contentPillarService';

interface NewsMonitoringDashboardProps {
  feeds: any[];
  contentPillars: ContentPillarAnalysis;
  onCreateContent: (item: FeedItem) => void;
}

const NewsMonitoringDashboard: React.FC<NewsMonitoringDashboardProps> = ({
  feeds,
  contentPillars,
  onCreateContent
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedHealth, setFeedHealth] = useState<Map<string, FeedHealth>>(new Map());
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('24h');
  const [minRelevance, setMinRelevance] = useState<number>(0.5);
  
  // Mock feed items for demonstration
  useEffect(() => {
    const loadFeedItems = async () => {
      setLoading(true);
      
      // In production, this would fetch from API
      const mockItems: FeedItem[] = [
        {
          id: '1',
          feedId: feeds[0]?.id || 'feed-1',
          title: 'AI Revolution: How Machine Learning is Transforming Business Strategy',
          description: 'New research shows companies using AI for strategic planning are seeing 40% improvement in decision-making speed and accuracy.',
          link: 'https://example.com/ai-strategy',
          pubDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          author: 'Tech Insights',
          categories: ['AI', 'Strategy', 'Business'],
          relevanceScore: 0.92,
          contentPillarMatch: 'Expertise'
        },
        {
          id: '2',
          feedId: feeds[0]?.id || 'feed-1',
          title: 'The Future of Remote Work: Building Culture in Distributed Teams',
          description: 'Leading companies share their strategies for maintaining strong culture and collaboration in remote-first environments.',
          link: 'https://example.com/remote-culture',
          pubDate: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
          author: 'Business Weekly',
          categories: ['Leadership', 'Culture', 'Remote Work'],
          relevanceScore: 0.85,
          contentPillarMatch: 'Experience'
        },
        {
          id: '3',
          feedId: feeds[1]?.id || 'feed-2',
          title: 'Sustainable Innovation: Companies Leading the Green Tech Revolution',
          description: 'How innovative startups are combining profitability with environmental responsibility to create the next unicorns.',
          link: 'https://example.com/green-tech',
          pubDate: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
          author: 'Innovation Daily',
          categories: ['Sustainability', 'Innovation', 'Startups'],
          relevanceScore: 0.78,
          contentPillarMatch: 'Evolution'
        },
        {
          id: '4',
          feedId: feeds[0]?.id || 'feed-1',
          title: 'Personal Branding in 2025: Authenticity Meets Strategy',
          description: 'Expert insights on building a personal brand that resonates with your audience while staying true to your values.',
          link: 'https://example.com/personal-branding',
          pubDate: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          author: 'Marketing Pros',
          categories: ['Personal Branding', 'Marketing', 'Strategy'],
          relevanceScore: 0.95,
          contentPillarMatch: 'Expertise'
        },
        {
          id: '5',
          feedId: feeds[1]?.id || 'feed-2',
          title: 'The Psychology of Leadership: Emotional Intelligence in the Digital Age',
          description: 'New studies reveal how emotional intelligence is becoming the most critical leadership skill in remote and hybrid work environments.',
          link: 'https://example.com/ei-leadership',
          pubDate: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18 hours ago
          author: 'Leadership Quarterly',
          categories: ['Leadership', 'Psychology', 'Management'],
          relevanceScore: 0.88,
          contentPillarMatch: 'Experience'
        }
      ];
      
      // Parse and enhance feed items with relevance scores
      const enhancedItems = parseFeedItems(
        mockItems,
        contentPillars.pillars,
        feeds.flatMap(f => f.keywords || [])
      );
      
      setFeedItems(enhancedItems);
      
      // Check feed health
      const healthMap = new Map<string, FeedHealth>();
      feeds.forEach(feed => {
        const feedItemsForHealth = enhancedItems.filter(item => item.feedId === feed.id);
        const health = checkFeedHealth(feed, feedItemsForHealth);
        healthMap.set(feed.id, health);
      });
      setFeedHealth(healthMap);
      
      setLoading(false);
    };
    
    loadFeedItems();
  }, [feeds, contentPillars]);
  
  // Filter items based on selected criteria
  const filteredItems = feedItems.filter(item => {
    // Filter by pillar
    if (selectedPillar !== 'all' && item.contentPillarMatch !== selectedPillar) {
      return false;
    }
    
    // Filter by relevance
    if ((item.relevanceScore || 0) < minRelevance) {
      return false;
    }
    
    // Filter by timeframe
    const hoursAgo = (Date.now() - item.pubDate.getTime()) / (1000 * 60 * 60);
    switch (selectedTimeframe) {
      case '24h':
        return hoursAgo <= 24;
      case '7d':
        return hoursAgo <= 168;
      case '30d':
        return hoursAgo <= 720;
      default:
        return true;
    }
  });
  
  // Sort by relevance and recency
  const sortedItems = [...filteredItems].sort((a, b) => {
    // Primary sort by relevance
    const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
    if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
    
    // Secondary sort by date
    return b.pubDate.getTime() - a.pubDate.getTime();
  });
  
  const handleRefresh = async () => {
    setRefreshing(true);
    // In production, this would trigger API refresh
    await new Promise(resolve => setTimeout(resolve, 2000));
    setRefreshing(false);
  };
  
  const formatTimeAgo = (date: Date): string => {
    const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };
  
  const getPillarColor = (pillar: string): string => {
    switch (pillar) {
      case 'Expertise':
        return 'blue';
      case 'Experience':
        return 'green';
      case 'Evolution':
        return 'purple';
      default:
        return 'gray';
    }
  };
  
  const getRelevanceColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-gray-600';
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Newspaper className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">News Monitoring</h2>
              <p className="text-sm text-gray-600">
                {filteredItems.length} relevant articles from {feeds.filter(f => f.isActive).length} sources
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`${refreshing ? 'animate-spin' : ''}`} size={16} />
            Refresh
          </button>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {feedItems.filter(item => (item.relevanceScore || 0) >= 0.8).length}
            </div>
            <p className="text-xs text-gray-600">High Relevance</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {feedItems.filter(item => {
                const hoursAgo = (Date.now() - item.pubDate.getTime()) / (1000 * 60 * 60);
                return hoursAgo <= 24;
              }).length}
            </div>
            <p className="text-xs text-gray-600">Last 24 Hours</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {feeds.filter(f => feedHealth.get(f.id)?.status === 'healthy').length}
            </div>
            <p className="text-xs text-gray-600">Healthy Feeds</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(
                feedItems.reduce((sum, item) => sum + (item.relevanceScore || 0), 0) / 
                feedItems.length * 100
              )}%
            </div>
            <p className="text-xs text-gray-600">Avg Relevance</p>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Filter className="text-gray-500" size={20} />
            
            {/* Pillar Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Pillar:</span>
              <select
                value={selectedPillar}
                onChange={(e) => setSelectedPillar(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Pillars</option>
                {contentPillars.pillars.map(pillar => (
                  <option key={pillar.id} value={pillar.name}>
                    {pillar.name} ({pillar.percentage}%)
                  </option>
                ))}
              </select>
            </div>
            
            {/* Timeframe Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Time:</span>
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
            
            {/* Relevance Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Min Relevance:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minRelevance}
                onChange={(e) => setMinRelevance(parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-medium text-gray-700">
                {Math.round(minRelevance * 100)}%
              </span>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            Showing {sortedItems.length} of {feedItems.length} articles
          </div>
        </div>
      </div>
      
      {/* Feed Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {feeds.map(feed => {
          const health = feedHealth.get(feed.id);
          if (!health) return null;
          
          return (
            <div
              key={feed.id}
              className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{feed.feedName}</h4>
                <div className={`flex items-center gap-1 ${
                  health.status === 'healthy' ? 'text-green-600' :
                  health.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {health.status === 'healthy' ? <CheckCircle size={16} /> :
                   health.status === 'warning' ? <AlertCircle size={16} /> :
                   <AlertCircle size={16} />}
                  <span className="text-xs font-medium capitalize">{health.status}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Articles:</span>
                  <span className="ml-1 font-medium">{health.itemsFound}</span>
                </div>
                <div>
                  <span className="text-gray-500">Avg Relevance:</span>
                  <span className="ml-1 font-medium">
                    {Math.round(health.averageRelevance * 100)}%
                  </span>
                </div>
              </div>
              {health.errorMessage && (
                <p className="text-xs text-red-600 mt-2">{health.errorMessage}</p>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Article List */}
      <div className="space-y-4">
        {sortedItems.map(item => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 bg-${getPillarColor(item.contentPillarMatch || 'gray')}-100 text-${getPillarColor(item.contentPillarMatch || 'gray')}-700 rounded-full text-xs font-medium`}>
                    {item.contentPillarMatch || 'General'}
                  </span>
                  <span className={`flex items-center gap-1 text-sm ${getRelevanceColor(item.relevanceScore || 0)}`}>
                    <TrendingUp size={14} />
                    {Math.round((item.relevanceScore || 0) * 100)}% relevant
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock size={14} />
                    {formatTimeAgo(item.pubDate)}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                
                <p className="text-gray-600 mb-3 line-clamp-2">
                  {item.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {item.author && (
                      <span className="flex items-center gap-1">
                        <BookOpen size={14} />
                        {item.author}
                      </span>
                    )}
                    {item.categories && item.categories.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Hash size={14} />
                        {item.categories.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink size={14} />
                      Read
                    </a>
                    <button
                      onClick={() => onCreateContent(item)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Sparkles size={14} />
                      Create Post
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {sortedItems.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Newspaper className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No matching articles found</h3>
            <p className="text-gray-600">
              Try adjusting your filters or waiting for new content from your feeds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsMonitoringDashboard;