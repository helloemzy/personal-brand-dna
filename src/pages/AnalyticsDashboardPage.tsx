import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { analyticsService, PerformanceMetrics, ActionableInsights } from '../services/analyticsService';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  MessageSquare, 
  Share2, 
  BarChart3,
  Calendar,
  Target,
  AlertCircle,
  Download,
  ChevronRight,
  Brain,
  Sparkles
} from 'lucide-react';

const AnalyticsDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const workshopData = useSelector((state: RootState) => state.workshop);
  const [timeframe, setTimeframe] = useState<PerformanceMetrics['timeframe']>('30d');
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [insights, setInsights] = useState<ActionableInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'audience' | 'insights'>('overview');

  useEffect(() => {
    loadAnalytics();
  }, [timeframe]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const performanceMetrics = await analyticsService.getPerformanceMetrics(timeframe);
      setMetrics(performanceMetrics);
      
      const actionableInsights = await analyticsService.generateInsights(workshopData, performanceMetrics);
      setInsights(actionableInsights);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'json') => {
    try {
      const blob = await analyticsService.exportAnalytics(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`;
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

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-gray-600">Failed to load analytics</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-gray-600 mt-1">Track your content performance and audience growth</p>
            </div>
            <div className="flex gap-4">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as PerformanceMetrics['timeframe'])}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <div className="relative">
                <button
                  onClick={() => {
                    const dropdown = document.getElementById('export-dropdown');
                    dropdown?.classList.toggle('hidden');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <div id="export-dropdown" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => handleExport('csv')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Export as PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 sm:space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'content', label: 'Content', icon: MessageSquare },
              { id: 'audience', label: 'Audience', icon: Users },
              { id: 'insights', label: 'Insights', icon: Brain }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Total Posts</p>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.overview.totalPosts}</p>
                  </div>
                  <MessageSquare className="hidden sm:block h-8 w-8 text-indigo-600 opacity-20" />
                </div>
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Total Engagement</p>
                    <p className="text-xl sm:text-2xl font-bold">{formatNumber(metrics.overview.totalEngagement)}</p>
                  </div>
                  <TrendingUp className="hidden sm:block h-8 w-8 text-green-600 opacity-20" />
                </div>
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Avg. Engagement</p>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.overview.avgEngagementRate.toFixed(1)}%</p>
                  </div>
                  <Target className="hidden sm:block h-8 w-8 text-purple-600 opacity-20" />
                </div>
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Total Reach</p>
                    <p className="text-xl sm:text-2xl font-bold">{formatNumber(metrics.overview.totalReach)}</p>
                  </div>
                  <Eye className="hidden sm:block h-8 w-8 text-blue-600 opacity-20" />
                </div>
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow col-span-2 sm:col-span-1">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Profile Views</p>
                    <p className="text-xl sm:text-2xl font-bold">{formatNumber(metrics.overview.profileViews)}</p>
                  </div>
                  <Users className="hidden sm:block h-8 w-8 text-orange-600 opacity-20" />
                </div>
              </div>
            </div>

            {/* Engagement Trend Chart */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Engagement Trend</h3>
              <div className="h-64 flex items-end space-x-2">
                {metrics.trends.engagement.slice(-30).map((item, index) => (
                  <div
                    key={index}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    style={{
                      height: `${(item.value / Math.max(...metrics.trends.engagement.map(e => e.value))) * 100}%`
                    }}
                    title={`${item.date}: ${item.value} engagements`}
                  />
                ))}
              </div>
            </div>

            {/* Top Performing Content */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Top Performing Content</h3>
              <div className="space-y-4">
                {metrics.topContent.map((content) => (
                  <div key={content.postId} className="flex items-center justify-between border-b pb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          content.contentPillar === 'expertise' ? 'bg-blue-100 text-blue-700' :
                          content.contentPillar === 'experience' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {content.contentPillar}
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(content.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">{formatNumber(content.metrics.views)}</span> views •
                        <span className="font-medium ml-2">{content.metrics.engagementRate.toFixed(1)}%</span> engagement
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{content.metrics.likes} ❤️</span>
                      <span>{content.metrics.comments} 💬</span>
                      <span>{content.metrics.shares} 🔄</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Content Pillar Performance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {metrics.contentPillars.map((pillar) => (
                <div key={pillar.pillar} className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">{pillar.pillar}</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Posts Published</p>
                      <p className="text-2xl font-bold">{pillar.postCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Avg. Engagement</p>
                      <p className="text-xl font-semibold">{pillar.avgEngagement.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Top Topics</p>
                      <div className="space-y-1">
                        {pillar.topPerformingTopics.map((topic, idx) => (
                          <div key={idx} className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {topic}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Recommended Topics</p>
                      <div className="space-y-1">
                        {pillar.recommendedTopics.slice(0, 2).map((topic, idx) => (
                          <div key={idx} className="text-sm bg-indigo-50 text-indigo-700 px-2 py-1 rounded flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {topic}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Optimal Posting Times */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Optimal Posting Times</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metrics.contentPillars.map((pillar) => (
                  <div key={pillar.pillar}>
                    <h4 className="font-medium text-gray-700 mb-2">{pillar.pillar}</h4>
                    <div className="space-y-1">
                      {pillar.optimalPostingTimes.map((time, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {time}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audience' && (
          <div className="space-y-6">
            {/* Follower Growth */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Follower Growth</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Total Followers</p>
                  <p className="text-2xl font-bold">{formatNumber(metrics.audience.totalFollowers)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Daily Growth</p>
                  <p className="text-xl font-semibold text-green-600">+{metrics.audience.followerGrowth.daily}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Weekly Growth</p>
                  <p className="text-xl font-semibold text-green-600">+{metrics.audience.followerGrowth.weekly}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monthly Growth</p>
                  <p className="text-xl font-semibold text-green-600">+{metrics.audience.followerGrowth.monthly}</p>
                </div>
              </div>
              
              {/* Follower Trend Chart */}
              <div className="h-64 flex items-end space-x-1">
                {metrics.trends.followers.slice(-30).map((item, index) => (
                  <div
                    key={index}
                    className="flex-1 bg-green-600 hover:bg-green-700 transition-colors"
                    style={{
                      height: `${(item.value / Math.max(...metrics.trends.followers.map(f => f.value))) * 100}%`
                    }}
                    title={`${item.date}: ${formatNumber(item.value)} followers`}
                  />
                ))}
              </div>
            </div>

            {/* Audience Demographics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Industries</h3>
                <div className="space-y-3">
                  {metrics.audience.demographics.industries.map((industry) => (
                    <div key={industry.name}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{industry.name}</span>
                        <span className="text-sm font-medium">{industry.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${industry.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Seniority Levels</h3>
                <div className="space-y-3">
                  {metrics.audience.demographics.seniority.map((level) => (
                    <div key={level.level}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{level.level}</span>
                        <span className="text-sm font-medium">{level.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${level.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Companies & Locations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Top Companies</h3>
                <div className="space-y-2">
                  {metrics.audience.demographics.companies.map((company) => (
                    <div key={company.company} className="flex justify-between items-center">
                      <span className="text-sm">{company.company}</span>
                      <span className="text-sm font-medium">{company.count} followers</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Engagement Patterns</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Best Days</p>
                    <div className="flex gap-2">
                      {metrics.audience.engagementPatterns.bestDays.map((day) => (
                        <span key={day} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Best Times</p>
                    <div className="flex gap-2">
                      {metrics.audience.engagementPatterns.bestTimes.map((time) => (
                        <span key={time} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          {time}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && insights && (
          <div className="space-y-6">
            {/* Key Recommendations */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
              <div className="space-y-4">
                {insights.recommendations.map((rec, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        rec.priority === 'high' ? 'bg-red-100' :
                        rec.priority === 'medium' ? 'bg-yellow-100' :
                        'bg-gray-100'
                      }`}>
                        {rec.type === 'content' && <MessageSquare className="h-5 w-5 text-gray-700" />}
                        {rec.type === 'timing' && <Calendar className="h-5 w-5 text-gray-700" />}
                        {rec.type === 'audience' && <Users className="h-5 w-5 text-gray-700" />}
                        {rec.type === 'strategy' && <Target className="h-5 w-5 text-gray-700" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{rec.insight}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                            rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">{rec.action}</p>
                        <p className="text-sm text-indigo-600 font-medium">Expected impact: {rec.expectedImpact}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Opportunities */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Content Opportunities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.opportunities.map((opp, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
                    <h4 className="font-medium mb-2">{opp.topic}</h4>
                    <p className="text-sm text-gray-600 mb-3">{opp.reason}</p>
                    <div className="bg-indigo-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-indigo-700 mb-1">Suggested Angle:</p>
                      <p className="text-sm text-indigo-600">{opp.suggestedAngle}</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Est. engagement: {opp.estimatedEngagement.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {insights.warnings.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Warnings</h3>
                <div className="space-y-4">
                  {insights.warnings.map((warning, idx) => (
                    <div key={idx} className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">{warning.issue}</h4>
                          <p className="text-sm text-yellow-700 mt-1">{warning.impact}</p>
                          <p className="text-sm text-yellow-600 mt-2">
                            <strong>Solution:</strong> {warning.solution}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboardPage;