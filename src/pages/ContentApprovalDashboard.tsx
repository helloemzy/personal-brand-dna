import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { format, formatDistanceToNow } from 'date-fns';

interface GeneratedPost {
  id: string;
  newsArticle: {
    title: string;
    url: string;
    publishedAt: string;
    source: string;
  };
  contentType: string;
  contentAngle: string;
  headline: string;
  bodyContent: string;
  hashtags: string[];
  timingStrategy: string;
  optimalPostTime: string;
  expiryTime: string;
  predictedEngagementRate: number;
  contentQualityScore: number;
  approvalStatus: string;
  createdAt: string;
}

interface ContentStats {
  pending: number;
  approved: number;
  rejected: number;
  posted: number;
  scheduled: number;
}

const ContentApprovalDashboard: React.FC = () => {
  const { user, accessToken } = useSelector((state: RootState) => state.auth);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<GeneratedPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ContentStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    posted: 0,
    scheduled: 0
  });
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  
  // BrandPillar AI tier limits
  const tierLimits = {
    starter: { weekly: 3, daily: 1 },
    professional: { weekly: 5, daily: 2 },
    executive: { weekly: 14, daily: 3 }
  };
  const userTier = (user?.subscriptionTier || 'starter') as keyof typeof tierLimits;
  const weeklyLimit = tierLimits[userTier].weekly;
  const postsThisWeek = stats.posted + stats.scheduled;

  useEffect(() => {
    fetchGeneratedPosts();
    fetchContentStats();
    
    // Check if user's tier has auto-approval
    if (user?.postingTier === 'aggressive') {
      setAutoApproveEnabled(true);
    }
  }, []);

  useEffect(() => {
    filterPosts();
  }, [posts, filter]);

  const fetchGeneratedPosts = async () => {
    try {
      const response = await fetch('/api/content-automation/generated-posts', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContentStats = async () => {
    try {
      const response = await fetch('/api/content-automation/stats', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filterPosts = () => {
    if (filter === 'all') {
      setFilteredPosts(posts);
    } else {
      setFilteredPosts(posts.filter(post => 
        post.approvalStatus === filter || 
        (filter === 'approved' && post.approvalStatus === 'auto_approved')
      ));
    }
  };

  const handleApprove = async (postId: string) => {
    try {
      const response = await fetch('/api/content-automation/approve-content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          postId,
          action: 'approve',
          editedContent: editMode ? editedContent : undefined
        })
      });

      if (response.ok) {
        // Update local state
        setPosts(posts.map(post => 
          post.id === postId 
            ? { ...post, approvalStatus: 'approved' }
            : post
        ));
        setSelectedPost(null);
        setEditMode(false);
        fetchContentStats();
      }
    } catch (error) {
      console.error('Error approving post:', error);
    }
  };

  const handleReject = async (postId: string, reason: string) => {
    try {
      const response = await fetch('/api/content-automation/approve-content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          postId,
          action: 'reject',
          rejectionReason: reason
        })
      });

      if (response.ok) {
        setPosts(posts.map(post => 
          post.id === postId 
            ? { ...post, approvalStatus: 'rejected' }
            : post
        ));
        setSelectedPost(null);
        fetchContentStats();
      }
    } catch (error) {
      console.error('Error rejecting post:', error);
    }
  };

  const handleBulkApprove = async () => {
    const pendingPosts = posts.filter(p => p.approvalStatus === 'pending');
    
    for (const post of pendingPosts) {
      await handleApprove(post.id);
    }
  };

  const getAngleIcon = (angle: string) => {
    const icons: Record<string, string> = {
      'contrarian': '🤔',
      'industry_impact': '🏭',
      'personal_story': '📖',
      'future_prediction': '🔮',
      'actionable_advice': '✅',
      'instant_react': '⚡',
      'debate_starter': '💬',
      'myth_buster': '🚫',
      'insider_perspective': '🔍',
      'trend_analysis': '📈'
    };
    return icons[angle] || '📝';
  };

  const getTimingColor = (timingStrategy: string) => {
    switch (timingStrategy) {
      case 'instant_react': return 'text-red-600 bg-red-50';
      case 'deep_dive': return 'text-blue-600 bg-blue-50';
      case 'lessons_learned': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Content Approval Dashboard
          </h1>
          <p className="text-gray-600">
            Review and approve AI-generated content before it goes live
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending Approval</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
            <div className="text-sm text-gray-600">Scheduled</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-purple-600">{stats.posted}</div>
            <div className="text-sm text-gray-600">Posted</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
        </div>

        {/* Filter and Actions */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex space-x-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === status
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status === 'pending' && stats.pending > 0 && (
                    <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                      {stats.pending}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-4">
              {user?.postingTier === 'aggressive' && (
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApproveEnabled}
                    onChange={(e) => setAutoApproveEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Auto-approve all</span>
                </label>
              )}
              
              {stats.pending > 0 && (
                <button
                  onClick={handleBulkApprove}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Approve All Pending ({stats.pending})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-2 text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="col-span-2 text-center py-8">
              <p className="text-gray-500">No content to review</p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                <div className="p-6">
                  {/* News Article Info */}
                  <div className="mb-4 pb-4 border-b">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-600 mb-1">
                          Source Article
                        </h3>
                        <p className="text-sm text-gray-900 font-medium">
                          {post.newsArticle.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {post.newsArticle.source} • {formatDistanceToNow(new Date(post.newsArticle.publishedAt), { addSuffix: true })}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${getTimingColor(post.timingStrategy)}`}>
                        {post.timingStrategy.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Generated Content Preview */}
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <span className="text-2xl mr-2">{getAngleIcon(post.contentAngle)}</span>
                      <h4 className="font-semibold text-gray-900">
                        {post.headline}
                      </h4>
                    </div>
                    <p className="text-gray-700 line-clamp-3">
                      {post.bodyContent}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {post.hashtags.map((tag, index) => (
                        <span key={index} className="text-xs text-blue-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Metrics and Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-4 text-sm">
                      <div>
                        <span className="text-gray-500">Engagement:</span>
                        <span className="ml-1 font-medium text-gray-900">
                          {post.predictedEngagementRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Quality:</span>
                        <span className="ml-1 font-medium text-gray-900">
                          {Math.round(post.contentQualityScore * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {post.approvalStatus === 'pending' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(post.id, 'Not relevant');
                            }}
                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(post.id);
                            }}
                            className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                          >
                            Approve
                          </button>
                        </>
                      )}
                      {post.approvalStatus === 'approved' && (
                        <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-lg">
                          Approved
                        </span>
                      )}
                      {post.approvalStatus === 'rejected' && (
                        <span className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-lg">
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Optimal Post Time */}
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500">
                      Scheduled for: {format(new Date(post.optimalPostTime), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Modal */}
        {selectedPost && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Review Content
                  </h2>
                  <button
                    onClick={() => {
                      setSelectedPost(null);
                      setEditMode(false);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Source Article */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Source Article</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium text-gray-900">{selectedPost.newsArticle.title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedPost.newsArticle.source} • {format(new Date(selectedPost.newsArticle.publishedAt), 'MMM d, yyyy')}
                    </p>
                    <a
                      href={selectedPost.newsArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                    >
                      Read original →
                    </a>
                  </div>
                </div>

                {/* Generated Content */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Generated Content</h3>
                    {selectedPost.approvalStatus === 'pending' && (
                      <button
                        onClick={() => {
                          setEditMode(!editMode);
                          setEditedContent(selectedPost.bodyContent);
                        }}
                        className="text-sm text-purple-600 hover:text-purple-700"
                      >
                        {editMode ? 'Cancel Edit' : 'Edit Content'}
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Headline</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedPost.headline}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 mb-1">Body Content</p>
                      {editMode ? (
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full h-40 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {selectedPost.bodyContent}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 mb-1">Hashtags</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPost.hashtags.map((tag, index) => (
                          <span key={index} className="text-blue-600">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Content Angle</p>
                    <p className="font-medium text-gray-900 flex items-center">
                      <span className="mr-2">{getAngleIcon(selectedPost.contentAngle)}</span>
                      {selectedPost.contentAngle.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Timing Strategy</p>
                    <p className={`font-medium inline-block px-2 py-1 rounded ${getTimingColor(selectedPost.timingStrategy)}`}>
                      {selectedPost.timingStrategy.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Predicted Engagement</p>
                    <p className="font-medium text-gray-900">{selectedPost.predictedEngagementRate}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Quality Score</p>
                    <p className="font-medium text-gray-900">{Math.round(selectedPost.contentQualityScore * 100)}%</p>
                  </div>
                </div>

                {/* Actions */}
                {selectedPost.approvalStatus === 'pending' && (
                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() => handleReject(selectedPost.id, 'Content not suitable')}
                      className="px-6 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedPost.id)}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      {editMode ? 'Approve with Edits' : 'Approve & Schedule'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentApprovalDashboard;