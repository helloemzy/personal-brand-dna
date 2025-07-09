import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Users, 
  TrendingUp, 
  Target, 
  Clock,
  MousePointer,
  Eye,
  ChevronRight,
  Download,
  Settings,
  Info,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  Zap
} from 'lucide-react';
import { useTracking } from '../hooks/useTracking';
import { userAnalyticsService, UserJourney, WorkshopFunnel, ContentPerformance, FeatureAdoption, UserSegment } from '../services/userAnalyticsService';
import { trackingService } from '../services/trackingService';

interface AnalyticsTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const UserAnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { trackEvent } = useTracking({ trackPageViews: true, trackScrollDepth: true });
  const [activeTab, setActiveTab] = useState('overview');
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);
  
  // Analytics data states
  const [sessionData, setSessionData] = useState<any>(null);
  const [workshopFunnel, setWorkshopFunnel] = useState<WorkshopFunnel | null>(null);
  const [contentPerformance, setContentPerformance] = useState<ContentPerformance | null>(null);
  const [featureAdoption, setFeatureAdoption] = useState<FeatureAdoption[]>([]);
  const [userSegments, setUserSegments] = useState<UserSegment[]>([]);
  const [conversionFunnel, setConversionFunnel] = useState<any>(null);

  const tabs: AnalyticsTab[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'behavior', label: 'User Behavior', icon: MousePointer },
    { id: 'workshop', label: 'Workshop Analytics', icon: Target },
    { id: 'content', label: 'Content Performance', icon: BarChart3 },
    { id: 'features', label: 'Feature Adoption', icon: Zap },
    { id: 'segments', label: 'User Segments', icon: Users },
    { id: 'conversions', label: 'Conversions', icon: TrendingUp },
  ];

  useEffect(() => {
    loadAnalytics();
  }, [timeframe]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Get timeframe dates
      const end = new Date();
      const start = new Date();
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      start.setDate(start.getDate() - days);

      // Load all analytics data
      const [
        session,
        workshop,
        content,
        features,
        segments,
        conversion
      ] = await Promise.all([
        trackingService.getSessionAnalytics(),
        userAnalyticsService.getWorkshopFunnel({ start, end }),
        userAnalyticsService.getContentPerformance({ start, end }),
        userAnalyticsService.getFeatureAdoption(),
        userAnalyticsService.getUserSegments(),
        userAnalyticsService.getConversionFunnel('workshop_complete'),
      ]);

      setSessionData(session);
      setWorkshopFunnel(workshop);
      setContentPerformance(content);
      setFeatureAdoption(features);
      setUserSegments(segments);
      setConversionFunnel(conversion);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (dataType: string) => {
    try {
      const blob = await userAnalyticsService.exportAnalytics('csv', dataType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataType}-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      trackEvent('Analytics', 'Export', dataType);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Analytics</h1>
              <p className="text-gray-600 mt-1">Detailed insights into user behavior and engagement</p>
            </div>
            <div className="flex gap-4">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button
                onClick={() => navigate('/analytics/settings')}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  trackEvent('Analytics', 'Tab Switch', tab.label);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && sessionData && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Active Sessions</h3>
                  <Activity className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="text-2xl font-bold">{formatNumber(sessionData.currentSession.pageViews)}</p>
                <p className="text-sm text-gray-500 mt-1">Page views this session</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Session Duration</h3>
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold">{formatDuration(sessionData.sessionDuration)}</p>
                <p className="text-sm text-gray-500 mt-1">Current session</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Events Tracked</h3>
                  <MousePointer className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold">{formatNumber(sessionData.events.length)}</p>
                <p className="text-sm text-gray-500 mt-1">User interactions</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Device Type</h3>
                  <Eye className="h-5 w-5 text-orange-600" />
                </div>
                <p className="text-2xl font-bold capitalize">{sessionData.currentSession.device.type}</p>
                <p className="text-sm text-gray-500 mt-1">{sessionData.currentSession.device.browser}</p>
              </div>
            </div>

            {/* Recent Events */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Recent Events</h3>
              <div className="space-y-3">
                {sessionData.events.slice(-10).reverse().map((event: any, index: number) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        event.category === 'Workshop' ? 'bg-blue-100 text-blue-700' :
                        event.category === 'Content' ? 'bg-green-100 text-green-700' :
                        event.category === 'Feature' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {event.category}
                      </span>
                      <span className="font-medium">{event.action}</span>
                      {event.label && <span className="text-gray-600">- {event.label}</span>}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'behavior' && sessionData && (
          <div className="space-y-6">
            {/* Page Views Analysis */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Page Views</h3>
              <div className="space-y-3">
                {Object.entries(
                  sessionData.pageViews.reduce((acc: any, pv: any) => {
                    acc[pv.path] = (acc[pv.path] || 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([path, count]) => (
                    <div key={path} className="flex items-center justify-between">
                      <span className="font-medium">{path}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{count} views</span>
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: `${(count as number / sessionData.pageViews.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* User Flow */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Common User Paths</h3>
              <div className="space-y-4">
                {[
                  ['/', '/get-started', '/brand-house', '/workshop/results'],
                  ['/', '/login', '/dashboard', '/content'],
                  ['/dashboard', '/analytics', '/content/calendar'],
                ].map((path, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {path.map((page, idx) => (
                      <React.Fragment key={idx}>
                        <div className="px-3 py-1 bg-gray-100 rounded text-sm">
                          {page}
                        </div>
                        {idx < path.length - 1 && <ChevronRight className="h-4 w-4 text-gray-400" />}
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workshop' && workshopFunnel && (
          <div className="space-y-6">
            {/* Workshop Funnel */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Workshop Completion Funnel</h3>
                <button
                  onClick={() => handleExport('workshop_funnel')}
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Total Starts</p>
                  <p className="text-2xl font-bold">{workshopFunnel.totalStarts}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completions</p>
                  <p className="text-2xl font-bold">{workshopFunnel.overallCompletion}</p>
                  <p className="text-sm text-green-600">
                    {((workshopFunnel.overallCompletion / workshopFunnel.totalStarts) * 100).toFixed(1)}% rate
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Completion Time</p>
                  <p className="text-2xl font-bold">{Math.round(workshopFunnel.avgCompletionTime / 60)}m</p>
                </div>
              </div>

              {/* Step-by-step funnel */}
              <div className="space-y-3">
                {Object.entries(workshopFunnel.stepCompletion).map(([step, data]) => (
                  <div key={step}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{step}</span>
                      <span className="text-sm text-gray-600">
                        {data.completed} / {data.started} ({((data.completed / data.started) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-4 rounded-full relative"
                        style={{ width: `${(data.completed / data.started) * 100}%` }}
                      >
                        {data.dropOff > 0 && (
                          <div className="absolute right-0 top-0 bottom-0 bg-red-500 rounded-r-full"
                            style={{ width: `${(data.dropOff / data.started) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Avg time: {Math.round(data.avgTimeSpent)}s
                    </p>
                  </div>
                ))}
              </div>

              {/* Drop-off reasons */}
              {Object.keys(workshopFunnel.dropOffReasons).length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Drop-off Reasons</h4>
                  <div className="space-y-2">
                    {Object.entries(workshopFunnel.dropOffReasons).map(([reason, count]) => (
                      <div key={reason} className="flex justify-between">
                        <span className="text-sm">{reason}</span>
                        <span className="text-sm font-medium">{count} users</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'content' && contentPerformance && (
          <div className="space-y-6">
            {/* Content Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Content Creation</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Total Generated</span>
                    <span className="text-2xl font-bold">{contentPerformance.totalGenerated}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Published</span>
                    <span className="text-2xl font-bold text-green-600">{contentPerformance.totalPublished}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Publishing Rate</span>
                    <span className="text-lg font-medium">
                      {contentPerformance.totalGenerated > 0 
                        ? ((contentPerformance.totalPublished / contentPerformance.totalGenerated) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Content by Source</h3>
                <div className="space-y-3">
                  {Object.entries(contentPerformance.bySource).map(([source, count]) => (
                    <div key={source} className="flex justify-between items-center">
                      <span className="capitalize">{source}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{count}</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${(count / contentPerformance.totalGenerated) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Content by Pillar */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Performance by Content Pillar</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(contentPerformance.byPillar).map(([pillar, data]) => (
                  <div key={pillar} className="text-center">
                    <h4 className="font-medium capitalize mb-2">{pillar}</h4>
                    <div className="relative h-32 w-32 mx-auto">
                      <svg className="transform -rotate-90 w-32 h-32">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-gray-200"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${(data.published / data.generated) * 352} 352`}
                          className="text-indigo-600"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div>
                          <p className="text-2xl font-bold">{data.published}</p>
                          <p className="text-xs text-gray-600">of {data.generated}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      Avg engagement: {data.avgEngagement.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Publishing Times */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Publishing Times</h3>
              <div className="h-40 flex items-end justify-between gap-1">
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = contentPerformance.publishingTimes[hour] || 0;
                  const maxCount = Math.max(...Object.values(contentPerformance.publishingTimes));
                  return (
                    <div
                      key={hour}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 transition-colors relative group"
                      style={{ height: `${(count / maxCount) * 100}%` }}
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {hour}:00 - {count} posts
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-600">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'features' && featureAdoption.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Feature Adoption</h3>
                <button
                  onClick={() => handleExport('feature_adoption')}
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>

              <div className="space-y-4">
                {featureAdoption
                  .sort((a, b) => b.adoptionRate - a.adoptionRate)
                  .map((feature) => (
                    <div key={feature.feature} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{feature.feature}</h4>
                          <p className="text-sm text-gray-600">
                            {feature.uniqueUsers} unique users • {feature.totalUses} total uses
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          feature.adoptionRate > 50 ? 'bg-green-100 text-green-700' :
                          feature.adoptionRate > 25 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {feature.adoptionRate.toFixed(1)}% adoption
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-600">Day 1 Retention</p>
                          <p className="font-medium">{feature.retention.day1}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Day 7 Retention</p>
                          <p className="font-medium">{feature.retention.day7}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Day 30 Retention</p>
                          <p className="font-medium">{feature.retention.day30}%</p>
                        </div>
                      </div>

                      {feature.firstUsed && feature.lastUsed && (
                        <p className="text-xs text-gray-500 mt-3">
                          First used: {new Date(feature.firstUsed).toLocaleDateString()} • 
                          Last used: {new Date(feature.lastUsed).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'segments' && userSegments.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {userSegments.map((segment) => (
                <div key={segment.segmentName} className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">{segment.segmentName}</h3>
                  <p className="text-3xl font-bold mb-4">{formatNumber(segment.userCount)}</p>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Avg Session</span>
                      <span className="font-medium">{formatDuration(segment.characteristics.avgSessionDuration)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Page Views</span>
                      <span className="font-medium">{segment.characteristics.avgPageViews}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Conversion Rate</span>
                      <span className="font-medium">{(segment.characteristics.conversionRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-600 mb-2">Top Features</p>
                    <div className="flex flex-wrap gap-1">
                      {segment.characteristics.topFeatures.map((feature) => (
                        <span key={feature} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'conversions' && conversionFunnel && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Workshop Completion Funnel</h3>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600">Overall Conversion Rate</p>
                <p className="text-3xl font-bold">{(conversionFunnel.overallConversion * 100).toFixed(1)}%</p>
              </div>

              <div className="space-y-4">
                {conversionFunnel.steps.map((step: any, index: number) => (
                  <div key={step.name}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{step.name}</span>
                      <span className="text-sm text-gray-600">
                        {formatNumber(step.users)} users ({(step.conversionRate * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-8">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-8 rounded-full flex items-center justify-end pr-3"
                          style={{ width: `${step.conversionRate * 100}%` }}
                        >
                          <span className="text-white text-sm font-medium">
                            {formatNumber(step.users)}
                          </span>
                        </div>
                      </div>
                      {index < conversionFunnel.steps.length - 1 && (
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                          <ArrowDown className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {index < conversionFunnel.steps.length - 1 && (
                      <div className="text-center mt-4 mb-2">
                        <span className="text-sm text-red-600">
                          -{formatNumber(step.users - conversionFunnel.steps[index + 1].users)} 
                          ({((1 - conversionFunnel.steps[index + 1].users / step.users) * 100).toFixed(1)}% drop)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Conversion Optimization Tips */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-indigo-900 mb-2">Optimization Opportunities</h4>
                  <ul className="space-y-2 text-sm text-indigo-700">
                    <li>• Simplify Step 2 to reduce 15% drop-off rate</li>
                    <li>• Add progress indicators to increase completion by 20%</li>
                    <li>• Implement save & continue feature for longer sessions</li>
                    <li>• A/B test different value propositions on Step 1</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAnalyticsDashboard;