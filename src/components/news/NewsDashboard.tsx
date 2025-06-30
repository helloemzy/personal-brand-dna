import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Newspaper, 
  Filter, 
  Sparkles, 
  Bookmark, 
  X, 
  ExternalLink, 
  TrendingUp,
  Clock,
  MoreVertical,
  Rss,
  Settings,
  Loader
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FixedSizeList as List } from 'react-window';
import { useComponentPerformance } from '../../utils/performance';
import { LAZY_LOADING, PAGINATION } from '../../config/performance';

// Types
interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  articleUrl: string;
  imageUrl?: string;
  sourceName: string;
  sourceCategory?: string;
  publishedAt: string;
  relevanceScore?: number;
  contentPillarMatches?: string[];
  isFeatured?: boolean;
  userInteraction?: string;
}

interface NewsSource {
  id: string;
  name: string;
  feedUrl: string;
  category?: string;
  isActive: boolean;
  totalArticles: number;
  latestArticleDate?: string;
  lastFetchStatus?: string;
  lastFetchDate?: string;
}

// Article Card Component
const ArticleCard = React.memo<{
  article: NewsArticle;
  onSave: () => void;
  onDismiss: () => void;
  onGenerateIdeas: () => void;
}>(({ article, onSave, onDismiss, onGenerateIdeas }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const relevanceColor = article.relevanceScore 
    ? article.relevanceScore >= 0.8 ? 'text-green-600' 
    : article.relevanceScore >= 0.6 ? 'text-yellow-600' 
    : 'text-gray-400'
    : 'text-gray-400';

  return (
    <div className={`
      bg-white rounded-lg shadow-sm border p-5 hover:shadow-md transition-shadow
      ${article.isFeatured ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}
    `}>
      {article.isFeatured && (
        <div className="flex items-center text-blue-600 text-sm font-medium mb-2">
          <Sparkles className="w-4 h-4 mr-1" />
          Featured for you
        </div>
      )}
      
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
            {article.title}
          </h3>
          <div className="flex items-center text-sm text-gray-500 space-x-3">
            <span>{article.sourceName}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
            {article.relevanceScore && (
              <>
                <span>•</span>
                <span className={`font-medium ${relevanceColor}`}>
                  {Math.round(article.relevanceScore * 100)}% relevant
                </span>
              </>
            )}
          </div>
        </div>
        
        <div className="relative ml-4">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  onSave();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Save for later
              </button>
              <button
                onClick={() => {
                  onGenerateIdeas();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate ideas
              </button>
              <button
                onClick={() => {
                  onDismiss();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center text-red-600"
              >
                <X className="w-4 h-4 mr-2" />
                Not interested
              </button>
            </div>
          )}
        </div>
      </div>
      
      {article.summary && (
        <p className="text-gray-600 mb-3 line-clamp-3">{article.summary}</p>
      )}
      
      {article.contentPillarMatches && article.contentPillarMatches.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {article.contentPillarMatches.map((pillar, index) => (
            <span 
              key={index}
              className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full"
            >
              {pillar}
            </span>
          ))}
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <a
          href={article.articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
        >
          Read full article
          <ExternalLink className="w-3.5 h-3.5 ml-1" />
        </a>
        
        {article.userInteraction === 'save' && (
          <span className="text-sm text-gray-500 flex items-center">
            <Bookmark className="w-4 h-4 mr-1 fill-current" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
});

// Sources Management Component
const SourcesManager = React.memo<{
  sources: NewsSource[];
  onAddSource: (source: { name: string; feedUrl: string; category?: string }) => void;
  onDeleteSource: (sourceId: string) => void;
}>(({ sources, onAddSource, onDeleteSource }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', feedUrl: '', category: '' });
  const [discovering, setDiscovering] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddSource(newSource);
    setNewSource({ name: '', feedUrl: '', category: '' });
    setShowAddForm(false);
  };
  
  const handleDiscoverFeeds = async (websiteUrl: string) => {
    setDiscovering(true);
    try {
      // API call to discover feeds
      console.log('Discovering feeds from:', websiteUrl);
    } catch (error) {
      console.error('Error discovering feeds:', error);
    } finally {
      setDiscovering(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">News Sources</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          Add Source
        </button>
      </div>
      
      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Name
              </label>
              <input
                type="text"
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., TechCrunch"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feed URL
              </label>
              <input
                type="url"
                value={newSource.feedUrl}
                onChange={(e) => setNewSource({ ...newSource, feedUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com/feed"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category (optional)
              </label>
              <input
                type="text"
                value={newSource.category}
                onChange={(e) => setNewSource({ ...newSource, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Technology, Business"
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Source
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}
      
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Rss className={`w-5 h-5 ${source.isActive ? 'text-green-500' : 'text-gray-400'}`} />
              <div>
                <h4 className="font-medium text-gray-900">{source.name}</h4>
                <p className="text-sm text-gray-500">
                  {source.category && `${source.category} • `}
                  {source.totalArticles} articles
                  {source.lastFetchDate && ` • Updated ${formatDistanceToNow(new Date(source.lastFetchDate), { addSuffix: true })}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => onDeleteSource(source.id)}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

// Main News Dashboard Component
const NewsDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'featured' | 'saved'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const listRef = useRef<List>(null);
  
  // Track component performance
  useComponentPerformance('NewsDashboard');
  
  // Mock data for demonstration
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setArticles([
        {
          id: '1',
          title: 'The Future of AI in Professional Development',
          summary: 'New research shows how AI is transforming career advancement and skill development in the modern workplace...',
          articleUrl: 'https://example.com/article1',
          sourceName: 'TechCrunch',
          sourceCategory: 'Technology',
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          relevanceScore: 0.92,
          contentPillarMatches: ['AI & Technology', 'Career Development'],
          isFeatured: true
        },
        {
          id: '2',
          title: 'Building Authentic Personal Brands in 2024',
          summary: 'Industry experts share insights on creating genuine connections through content...',
          articleUrl: 'https://example.com/article2',
          sourceName: 'Forbes',
          sourceCategory: 'Business',
          publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          relevanceScore: 0.78,
          contentPillarMatches: ['Personal Branding'],
          isFeatured: false
        }
      ]);
      
      setSources([
        {
          id: '1',
          name: 'TechCrunch',
          feedUrl: 'https://techcrunch.com/feed',
          category: 'Technology',
          isActive: true,
          totalArticles: 142,
          lastFetchDate: new Date().toISOString()
        }
      ]);
      
      setLoading(false);
    }, 1000);
  }, []);
  
  const handleSaveArticle = useCallback((articleId: string) => {
    console.log('Saving article:', articleId);
    // API call to save article
  }, []);
  
  const handleDismissArticle = useCallback((articleId: string) => {
    console.log('Dismissing article:', articleId);
    setArticles(prev => prev.filter(a => a.id !== articleId));
    // API call to record dismissal
  }, []);
  
  const handleGenerateIdeas = useCallback((articleId: string) => {
    console.log('Generating ideas for article:', articleId);
    // Navigate to idea generation or show modal
  }, []);
  
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      if (filter === 'featured') return article.isFeatured;
      if (filter === 'saved') return article.userInteraction === 'save';
      return true;
    });
  }, [articles, filter]);
  
  // Virtualized list row renderer
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const article = filteredArticles[index];
    if (!article) return null;
    
    return (
      <div style={style}>
        <div className="px-4">
          <ArticleCard
            article={article}
            onSave={() => handleSaveArticle(article.id)}
            onDismiss={() => handleDismissArticle(article.id)}
            onGenerateIdeas={() => handleGenerateIdeas(article.id)}
          />
        </div>
      </div>
    );
  }, [filteredArticles, handleSaveArticle, handleDismissArticle, handleGenerateIdeas]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Newspaper className="w-8 h-8 mr-3 text-blue-600" />
          News & Inspiration Hub
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Discover relevant articles and generate content ideas based on your brand voice
        </p>
      </div>
      
      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">New Today</p>
              <p className="text-2xl font-semibold text-gray-900">12</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Featured</p>
              <p className="text-2xl font-semibold text-gray-900">3</p>
            </div>
            <Sparkles className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saved</p>
              <p className="text-2xl font-semibold text-gray-900">7</p>
            </div>
            <Bookmark className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ideas Generated</p>
              <p className="text-2xl font-semibold text-gray-900">24</p>
            </div>
            <Sparkles className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Articles List */}
        <div className="lg:col-span-2">
          {/* Filter Tabs */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Articles
              </button>
              <button
                onClick={() => setFilter('featured')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'featured' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Featured
              </button>
              <button
                onClick={() => setFilter('saved')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'saved' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Saved
              </button>
            </div>
            
            <button className="flex items-center text-gray-600 hover:text-gray-900">
              <Filter className="w-5 h-5 mr-1" />
              Filters
            </button>
          </div>
          
          {/* Articles - Virtualized List */}
          {filteredArticles.length > 0 ? (
            <List
              ref={listRef}
              height={600}
              itemCount={filteredArticles.length}
              itemSize={220} // Estimated height of each article card
              width="100%"
              overscanCount={LAZY_LOADING.virtualListOverscan}
            >
              {Row}
            </List>
          ) : null}
          
          {filteredArticles.length === 0 && (
            <div className="text-center py-12">
              <Newspaper className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No articles found</p>
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Minimum Relevance Score
                </label>
                <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="0.5">50%</option>
                  <option value="0.6">60%</option>
                  <option value="0.7">70%</option>
                  <option value="0.8">80%</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Notifications
                </label>
                <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option>Daily Digest</option>
                  <option>Weekly Summary</option>
                  <option>Real-time</option>
                  <option>Never</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto-generate"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="auto-generate" className="ml-2 text-sm text-gray-700">
                  Auto-generate ideas for featured articles
                </label>
              </div>
            </div>
          </div>
          
          {/* Sources Manager */}
          <SourcesManager
            sources={sources}
            onAddSource={(source) => console.log('Adding source:', source)}
            onDeleteSource={(id) => console.log('Deleting source:', id)}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(NewsDashboard);