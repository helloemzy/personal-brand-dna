import React, { useState, useEffect } from 'react';
import { toast } from '../components/Toast';
import { contentAPI, GeneratedContent, getStatusColor, getContentTypeIcon, formatContentType, truncateContent } from '../services/contentAPI';

const ContentHistoryPage: React.FC = () => {
  const [content, setContent] = useState<GeneratedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });

  // Load content on component mount and when filters change
  useEffect(() => {
    loadContent();
  }, [pagination.page, searchQuery, contentTypeFilter, statusFilter]);

  const loadContent = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (searchQuery) params.search = searchQuery;
      if (contentTypeFilter) params.contentType = contentTypeFilter;
      if (statusFilter) params.status = statusFilter;
      const response = await contentAPI.getContent(params);
      
      setContent(response.data.content);
      setPagination(prev => ({
        ...prev,
        totalItems: response.data.pagination.totalItems,
        totalPages: response.data.pagination.totalPages
      }));
    } catch (error) {
      console.error('Failed to load content:', error);
      toast.error('Loading Failed', 'Failed to load your content history');
      // For demo purposes, we could load sample content here
      setContent([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (type: 'contentType' | 'status' | 'date', value: string) => {
    switch (type) {
      case 'contentType':
        setContentTypeFilter(value);
        break;
      case 'status':
        setStatusFilter(value);
        break;
      case 'date':
        // Date filter removed
        break;
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleEditContent = async (contentId: string, newContent: string) => {
    try {
      await contentAPI.updateContent(contentId, {
        content: newContent,
        status: 'edited'
      });
      
      // Update local state
      setContent(prev => 
        prev.map(item => 
          item.id === contentId 
            ? { ...item, content: newContent, status: 'edited' }
            : item
        )
      );
      
      setEditingContent(null);
      toast.success('Updated', 'Content updated successfully');
    } catch (error) {
      console.error('Failed to update content:', error);
      toast.error('Update Failed', 'Failed to update content');
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!window.confirm('Are you sure you want to delete this content?')) {
      return;
    }

    try {
      await contentAPI.deleteContent(contentId);
      setContent(prev => prev.filter(item => item.id !== contentId));
      toast.success('Deleted', 'Content deleted successfully');
    } catch (error) {
      console.error('Failed to delete content:', error);
      toast.error('Delete Failed', 'Failed to delete content');
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied', 'Content copied to clipboard');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Content History
        </h1>
        <p className="text-lg text-gray-600">
          View, manage, and track the performance of your generated content.
        </p>
      </div>

      {/* Summary Stats */}
      {content.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{pagination.totalItems}</div>
            <div className="text-sm text-gray-600">Total Content</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">
              {content.filter(item => item.status === 'used').length}
            </div>
            <div className="text-sm text-gray-600">Used Posts</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {content.filter(item => item.status === 'edited').length}
            </div>
            <div className="text-sm text-gray-600">Edited Posts</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-600">
              {content.filter(item => item.status === 'generated').length}
            </div>
            <div className="text-sm text-gray-600">Draft Posts</div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search your content..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select 
              value={contentTypeFilter}
              onChange={(e) => handleFilterChange('contentType', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="post">LinkedIn Post</option>
              <option value="article">LinkedIn Article</option>
              <option value="story">Story Post</option>
              <option value="poll">Poll Post</option>
              <option value="carousel">Carousel Post</option>
            </select>
            <select 
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="generated">Generated</option>
              <option value="edited">Edited</option>
              <option value="used">Used</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={() => {
                setSearchQuery('');
                setContentTypeFilter('');
                setStatusFilter('');
              }}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your content...</p>
          </div>
        ) : content.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-6">📝</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {searchQuery || contentTypeFilter || statusFilter 
                ? 'No Content Found' 
                : 'No Content Generated Yet'
              }
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {searchQuery || contentTypeFilter || statusFilter
                ? 'Try adjusting your search criteria or filters to find content.'
                : 'Start creating authentic LinkedIn content that sounds like you. All your generated posts will appear here for easy management.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                onClick={() => {
                  window.location.href = '/content';
                }}
              >
                Generate Content
              </button>
              {!(searchQuery || contentTypeFilter || statusFilter) && (
                <button
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  onClick={() => {
                    window.location.href = '/voice-discovery';
                  }}
                >
                  Complete Voice Discovery
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Content Items */
          <>
            {content.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{getContentTypeIcon(item.contentType)}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(item.status)}`}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {formatContentType(item.contentType)}
                        </span>
                        <span className="text-sm text-gray-500">{formatDate(item.createdAt)}</span>
                      </div>
                      
                      <h3 className="font-medium text-gray-900 mb-3">
                        Topic: {item.topic}
                      </h3>
                      
                      {editingContent === item.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            placeholder="Edit your content..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditContent(item.id, editedText)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => {
                                setEditingContent(null);
                                setEditedText('');
                              }}
                              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-md mb-4">
                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {truncateContent(item.content, 300)}
                          </p>
                          {item.content.length > 300 && (
                            <button 
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
                              onClick={() => {
                                // Could expand to show full content or navigate to detail view
                                navigator.clipboard.writeText(item.content);
                                toast.success('Copied', 'Full content copied to clipboard');
                              }}
                            >
                              Show full content
                            </button>
                          )}
                        </div>
                      )}
                      
                      {item.userEdits && (
                        <div className="text-xs text-gray-500 mb-2">
                          ✏️ This content has been edited
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-4">
                      <button 
                        onClick={() => {
                          setEditingContent(item.id);
                          setEditedText(item.content);
                        }}
                        className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition-colors"
                        title="Edit content"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleCopyContent(item.content)}
                        className="text-gray-600 hover:text-gray-700 p-2 rounded-md hover:bg-gray-50 transition-colors"
                        title="Copy to clipboard"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteContent(item.id)}
                        className="text-red-500 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete content"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.totalItems)}
                      </span> of{' '}
                      <span className="font-medium">{pagination.totalItems}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const pageNum = pagination.page <= 3 ? i + 1 : pagination.page - 2 + i;
                        if (pageNum > pagination.totalPages) return null;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pageNum === pagination.page
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContentHistoryPage;