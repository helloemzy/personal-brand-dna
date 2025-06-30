import React, { useState, useEffect } from 'react';
import {
  FaLinkedin,
  FaChartLine,
  FaEye,
  FaThumbsUp,
  FaShare,
  FaTrophy,
  FaClock,
  FaHashtag
} from 'react-icons/fa';

// Type assertion to fix React Icons issue
const FaLinkedinIcon = FaLinkedin as any;
const FaChartLineIcon = FaChartLine as any;
const FaEyeIcon = FaEye as any;
const FaThumbsUpIcon = FaThumbsUp as any;
const FaShareIcon = FaShare as any;
const FaTrophyIcon = FaTrophy as any;
const FaClockIcon = FaClock as any;
const FaHashtagIcon = FaHashtag as any;
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface AnalyticsSummary {
  period: string;
  summary: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
    avgEngagementRate: number;
    avgClickThroughRate: number;
  };
  bestPerformingPost: {
    post_text: string;
    linkedin_post_url: string;
    engagement_rate: number;
    impressions: number;
  } | null;
  postingFrequency: {
    byDayOfWeek: Record<number, number>;
    byHourOfDay: Record<number, number>;
    mostActiveDay: string;
    mostActiveHour: string;
  };
}

interface ContentInsights {
  byContentType: Array<{
    post_type: string;
    avg_engagement_rate: number;
    post_count: number;
  }>;
  hashtagPerformance: Array<{
    hashtag: string;
    usageCount: number;
    avgEngagement: string;
  }>;
  lengthImpact: Record<string, {
    avgEngagement: string;
    postCount: number;
    lengthRange: string;
  }>;
  bestTimes: Array<{
    day: string;
    hour: string;
    avgEngagement: string;
  }>;
}

const LinkedInAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [insights, setInsights] = useState<ContentInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'performance'>('overview');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const [summaryResponse, insightsResponse] = await Promise.all([
        fetch(`/api/linkedin/analytics/summary?period=${period}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch('/api/linkedin/analytics/insights', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      const summaryData = await summaryResponse.json();
      const insightsData = await insightsResponse.json();

      if (summaryData.success) {
        setSummary(summaryData.summary);
      }
      if (insightsData.success) {
        setInsights(insightsData.insights);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatEngagementRate = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  const getDayName = (dayNumber: string | number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[parseInt(dayNumber.toString())];
  };

  const getEngagementChartData = () => {
    if (!insights?.byContentType) return [];
    
    return insights.byContentType.map(item => ({
      name: item.post_type.charAt(0).toUpperCase() + item.post_type.slice(1),
      engagement: parseFloat(item.avg_engagement_rate.toString()),
      posts: item.post_count
    }));
  };

  const getPostingFrequencyData = () => {
    if (!summary?.postingFrequency?.byDayOfWeek) return [];
    
    return Object.entries(summary.postingFrequency.byDayOfWeek).map(([day, count]) => ({
      day: getDayName(day),
      posts: count
    }));
  };

  const getTimeDistributionData = () => {
    if (!summary?.postingFrequency?.byHourOfDay) return [];
    
    return Object.entries(summary.postingFrequency.byHourOfDay).map(([hour, count]) => ({
      hour: `${hour}:00`,
      posts: count
    }));
  };


  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <FaLinkedinIcon className="mr-2 text-blue-600" />
          LinkedIn Analytics
        </h2>
        
        <div className="flex items-center space-x-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
          
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b mb-6">
        {(['overview', 'insights', 'performance'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium capitalize ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && summary && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Posts</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {summary.summary.totalPosts}
                      </p>
                    </div>
                    <FaChartLineIcon className="text-blue-600 text-2xl" />
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Impressions</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {summary.summary.totalImpressions.toLocaleString()}
                      </p>
                    </div>
                    <FaEyeIcon className="text-green-600 text-2xl" />
                  </div>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Engagements</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {summary.summary.totalEngagements.toLocaleString()}
                      </p>
                    </div>
                    <FaThumbsUpIcon className="text-purple-600 text-2xl" />
                  </div>
                </div>
                
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Engagement Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatEngagementRate(summary.summary.avgEngagementRate)}
                      </p>
                    </div>
                    <FaShareIcon className="text-orange-600 text-2xl" />
                  </div>
                </div>
              </div>

              {/* Best Performing Post */}
              {summary.bestPerformingPost && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <FaTrophyIcon className="mr-2 text-yellow-500" />
                    Best Performing Post
                  </h3>
                  <p className="text-gray-700 mb-3 line-clamp-3">
                    {summary.bestPerformingPost.post_text}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-4 text-sm">
                      <span className="text-gray-600">
                        Engagement: <strong>{formatEngagementRate(summary.bestPerformingPost.engagement_rate)}</strong>
                      </span>
                      <span className="text-gray-600">
                        Impressions: <strong>{summary.bestPerformingPost.impressions.toLocaleString()}</strong>
                      </span>
                    </div>
                    <a
                      href={summary.bestPerformingPost.linkedin_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View on LinkedIn →
                    </a>
                  </div>
                </div>
              )}

              {/* Posting Frequency Chart */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Posting Frequency by Day
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getPostingFrequencyData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="posts" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && insights && (
            <div className="space-y-6">
              {/* Content Type Performance */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Performance by Content Type
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getEngagementChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="engagement" fill="#8884d8" name="Avg Engagement %" />
                    <Bar dataKey="posts" fill="#82ca9d" name="Number of Posts" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top Performing Hashtags */}
              {insights.hashtagPerformance && insights.hashtagPerformance.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FaHashtagIcon className="mr-2" />
                    Top Performing Hashtags
                  </h3>
                  <div className="space-y-2">
                    {insights.hashtagPerformance.slice(0, 10).map((tag, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b">
                        <div className="flex items-center">
                          <span className="text-blue-600 font-medium">{tag.hashtag}</span>
                          <span className="ml-2 text-sm text-gray-600">
                            ({tag.usageCount} uses)
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {tag.avgEngagement}% avg engagement
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Post Length Impact */}
              {insights.lengthImpact && Object.keys(insights.lengthImpact).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Engagement by Post Length
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(insights.lengthImpact).map(([category, data]) => (
                      <div key={category} className="bg-white rounded-lg p-4 border">
                        <h4 className="font-medium text-gray-900 capitalize">{category}</h4>
                        <p className="text-sm text-gray-600">{data.lengthRange}</p>
                        <p className="text-2xl font-bold text-blue-600 mt-2">
                          {data.avgEngagement}%
                        </p>
                        <p className="text-sm text-gray-600">{data.postCount} posts</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && insights && (
            <div className="space-y-6">
              {/* Best Posting Times */}
              {insights.bestTimes && insights.bestTimes.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FaClockIcon className="mr-2" />
                    Best Times to Post
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.bestTimes.map((time, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{time.day}</p>
                            <p className="text-sm text-gray-600">at {time.hour}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">
                              {time.avgEngagement}%
                            </p>
                            <p className="text-sm text-gray-600">avg engagement</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Distribution */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Posting Activity by Hour
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getTimeDistributionData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="posts" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Engagement Recommendations */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {summary && (
                    <>
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-2">•</span>
                        <span className="text-gray-700">
                          Your most active posting day is {getDayName(summary.postingFrequency.mostActiveDay)}. 
                          Consider scheduling more content on this day.
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-2">•</span>
                        <span className="text-gray-700">
                          Posts published at {summary.postingFrequency.mostActiveHour}:00 tend to get the most engagement.
                        </span>
                      </li>
                    </>
                  )}
                  {insights && insights.hashtagPerformance.length > 0 && (
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span className="text-gray-700">
                        Your top performing hashtag is {insights.hashtagPerformance[0]?.hashtag}. 
                        Use it more frequently in relevant posts.
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LinkedInAnalytics;