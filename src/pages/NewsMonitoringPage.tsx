import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux';
import { selectWorkshopState } from '../store/slices/workshopSlice';
import { ArrowLeft, Settings, Sparkles } from 'lucide-react';
import NewsMonitoringDashboard from '../components/NewsMonitoringDashboard';
import { determineArchetype } from '../services/archetypeService';
import { mapContentPillars } from '../services/contentPillarService';
import { FeedItem } from '../services/rssFeedService';
import { toast } from '../components/Toast';

const NewsMonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const workshopState = useAppSelector(selectWorkshopState);
  const [loading, setLoading] = useState(true);
  const [contentPillars, setContentPillars] = useState<any>(null);
  const [userFeeds, setUserFeeds] = useState<any[]>([]);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        // Determine archetype and content pillars
        const archetypeResult = await determineArchetype(workshopState);
        const pillars = mapContentPillars(workshopState, archetypeResult.primary.archetype.name);
        setContentPillars(pillars);
        
        // Load user's feeds from localStorage (in production, from API)
        const storedFeeds = localStorage.getItem('userRssFeeds');
        if (storedFeeds) {
          setUserFeeds(JSON.parse(storedFeeds));
        } else {
          // Default feeds if none saved
          setUserFeeds([
            {
              id: 'default-1',
              feedUrl: 'https://hbr.org/feed',
              feedName: 'Harvard Business Review',
              feedType: 'rss',
              keywords: [],
              category: 'business',
              isActive: true
            },
            {
              id: 'default-2',
              feedUrl: 'https://techcrunch.com/feed/',
              feedName: 'TechCrunch',
              feedType: 'rss',
              keywords: [],
              category: 'technology',
              isActive: true
            }
          ]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load news monitoring data', 'Please refresh the page or try again later');
      } finally {
        setLoading(false);
      }
    };
    
    if (workshopState.values.selected.length > 0) {
      loadData();
    } else {
      navigate('/brand-house');
    }
  }, [workshopState, navigate]);
  
  const handleCreateContent = (item: FeedItem) => {
    // Store the selected article in session storage
    sessionStorage.setItem('newsInspiration', JSON.stringify(item));
    // Navigate to content generation page
    navigate('/content');
  };
  
  if (loading || !contentPillars) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="animate-pulse text-blue-600 mb-4 mx-auto" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading News Monitor...</h2>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">News Monitoring</h1>
              <p className="text-gray-600">
                Discover content opportunities from your curated sources
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/news-setup')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Settings size={16} />
            Manage Sources
          </button>
        </div>
        
        {/* News Monitoring Dashboard */}
        <NewsMonitoringDashboard
          feeds={userFeeds}
          contentPillars={contentPillars}
          onCreateContent={handleCreateContent}
        />
      </div>
    </div>
  );
};

export default NewsMonitoringPage;