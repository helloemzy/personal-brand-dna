import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuth } from '../store/slices/authSlice';
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Star,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Bug,
  Lightbulb,
  ArrowLeft
} from 'lucide-react';
import { feedbackService, FeedbackStats, FeedbackData } from '../services/feedbackService';
import { Layout } from '../components/Layout';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const FeedbackAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector(selectAuth);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'all' | FeedbackData['type']>('all');
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadFeedbackData();
  }, [user, navigate]);

  const loadFeedbackData = async () => {
    try {
      setLoading(true);
      
      // Load stats
      const feedbackStats = await feedbackService.getFeedbackStats();
      setStats(feedbackStats);
      
      // Load recent feedback
      const feedback = selectedType === 'all' 
        ? await feedbackService.getUserFeedback(user!.id, 50)
        : await feedbackService.getFeedbackByType(selectedType as FeedbackData['type'], 50);
      
      setRecentFeedback(feedback);
    } catch (error) {
      console.error('Error loading feedback data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadFeedbackData();
    }
  }, [selectedType]);

  const getNPSCategory = (score: number): { label: string; color: string } => {
    if (score >= 50) return { label: 'Excellent', color: 'text-green-600' };
    if (score >= 0) return { label: 'Good', color: 'text-blue-600' };
    if (score >= -50) return { label: 'Needs Improvement', color: 'text-yellow-600' };
    return { label: 'Critical', color: 'text-red-600' };
  };

  const getSatisfactionLevel = (score: number): { label: string; color: string } => {
    if (score >= 80) return { label: 'Very Satisfied', color: 'text-green-600' };
    if (score >= 60) return { label: 'Satisfied', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Neutral', color: 'text-yellow-600' };
    return { label: 'Unsatisfied', color: 'text-red-600' };
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const pieData = stats ? Object.entries(stats.feedbackByType).map(([type, count]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count
  })) : [];

  const getTypeIcon = (type: FeedbackData['type']) => {
    switch (type) {
      case 'nps': return <ThumbsUp className="w-4 h-4" />;
      case 'satisfaction': return <Star className="w-4 h-4" />;
      case 'feature': return <Lightbulb className="w-4 h-4" />;
      case 'bug': return <Bug className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: FeedbackData['type']) => {
    switch (type) {
      case 'nps': return 'bg-blue-100 text-blue-700';
      case 'satisfaction': return 'bg-yellow-100 text-yellow-700';
      case 'feature': return 'bg-purple-100 text-purple-700';
      case 'bug': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Feedback Analytics</h1>
              <p className="text-gray-600 mt-2">Monitor user satisfaction and feedback trends</p>
            </div>
            
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value) as 7 | 30 | 90)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* NPS Score */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">NPS Score</h3>
              <ThumbsUp className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-gray-900">
                {stats?.npsScore || 0}
              </span>
              <span className={`ml-2 text-sm ${getNPSCategory(stats?.npsScore || 0).color}`}>
                {getNPSCategory(stats?.npsScore || 0).label}
              </span>
            </div>
          </div>

          {/* Satisfaction Score */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Satisfaction</h3>
              <Star className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-gray-900">
                {stats?.satisfactionScore || 0}%
              </span>
              <span className={`ml-2 text-sm ${getSatisfactionLevel(stats?.satisfactionScore || 0).color}`}>
                {getSatisfactionLevel(stats?.satisfactionScore || 0).label}
              </span>
            </div>
          </div>

          {/* Total Feedback */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Total Feedback</h3>
              <MessageSquare className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-gray-900">
                {stats?.totalFeedback || 0}
              </span>
              <span className="ml-2 text-sm text-gray-500">
                responses
              </span>
            </div>
          </div>

          {/* Response Rate */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Response Rate</h3>
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-gray-900">
                {stats?.totalFeedback ? Math.round((stats.totalFeedback / 100) * 100) : 0}%
              </span>
              <span className="ml-2 text-sm text-green-600 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                +12%
              </span>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Trend Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Satisfaction Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats?.recentTrends || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="satisfaction" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Satisfaction"
                />
                <Line 
                  type="monotone" 
                  dataKey="nps" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="NPS"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Feedback Type Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feedback by Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Feedback */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Feedback</h3>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Types</option>
                <option value="nps">NPS</option>
                <option value="satisfaction">Satisfaction</option>
                <option value="feature">Features</option>
                <option value="bug">Bugs</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {recentFeedback.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No feedback found for the selected criteria
              </div>
            ) : (
              recentFeedback.map((feedback) => (
                <div key={feedback.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(feedback.type)}`}>
                          {getTypeIcon(feedback.type)}
                          {feedback.type}
                        </span>
                        {feedback.rating && (
                          <span className="text-sm text-gray-600">
                            Rating: {feedback.rating}/{feedback.type === 'nps' ? 10 : 5}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700">{feedback.feedback}</p>
                      {feedback.context?.page && (
                        <p className="text-xs text-gray-500 mt-1">
                          From: {feedback.context.page}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 ml-4">
                      {new Date(feedback.createdAt!).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};