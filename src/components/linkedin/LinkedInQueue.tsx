import React, { useState, useEffect } from 'react';
import { 
  FaLinkedin, 
  FaClock, 
  FaCheckCircle, 
  FaTimesCircle,
  FaExclamationTriangle,
  FaPaperPlane,
  FaTrash,
  FaEye,
  FaCalendarAlt,
  FaShieldAlt,
  FaFilter
} from 'react-icons/fa';
import Toast, { toast } from '../Toast';

interface QueueItem {
  id: string;
  content_id: string;
  post_text: string;
  post_type: string;
  status: string;
  approval_status: string;
  scheduled_for: string | null;
  published_at: string | null;
  linkedin_post_url: string | null;
  created_at: string;
  rejection_reason: string | null;
  safetyChecks: SafetyCheck[];
  metadata: {
    characterCount: number;
    hashtagCount: number;
    urlCount: number;
  };
}

interface SafetyCheck {
  check_type: string;
  passed: boolean;
  details: any;
}

const LinkedInQueue: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'published' | 'rejected'>('all');
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  

  useEffect(() => {
    fetchQueue();
  }, [filter]);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      let url = '/api/linkedin/queue';
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setQueue(data.queue);
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error);
      toast.error('Failed to load publishing queue');
    } finally {
      setIsLoading(false);
    }
  };

  const approveContent = async (queueId: string) => {
    setActionLoading(queueId);
    try {
      const response = await fetch(`/api/linkedin/queue/${queueId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Content approved for publishing');
        fetchQueue();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Failed to approve content', error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectContent = async () => {
    if (!selectedItem || !rejectionReason.trim()) return;
    
    setActionLoading(selectedItem.id);
    try {
      const response = await fetch(`/api/linkedin/queue/${selectedItem.id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason: rejectionReason })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Content rejected');
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedItem(null);
        fetchQueue();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Failed to reject content', error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const publishContent = async (queueId: string) => {
    setActionLoading(queueId);
    try {
      const response = await fetch(`/api/linkedin/publish/${queueId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Content published successfully to LinkedIn!');
        fetchQueue();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Failed to publish content', error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteContent = async (queueId: string) => {
    if (!confirm('Are you sure you want to delete this content from the queue?')) return;
    
    setActionLoading(queueId);
    try {
      const response = await fetch(`/api/linkedin/queue/${queueId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Content removed from queue');
        fetchQueue();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Failed to delete content', error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (item: QueueItem) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      published: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      scheduled: 'bg-purple-100 text-purple-800',
      failed: 'bg-gray-100 text-gray-800'
    };

    const statusIcons = {
      pending: () => React.createElement(FaClock, { className: "mr-1" }),
      approved: () => React.createElement(FaCheckCircle, { className: "mr-1" }),
      published: () => React.createElement(FaLinkedin, { className: "mr-1" }),
      rejected: () => React.createElement(FaTimesCircle, { className: "mr-1" }),
      scheduled: () => React.createElement(FaCalendarAlt, { className: "mr-1" }),
      failed: () => React.createElement(FaExclamationTriangle, { className: "mr-1" })
    };

    const color = statusColors[item.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
    const iconFn = statusIcons[item.status as keyof typeof statusIcons];

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {iconFn && iconFn()}
        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          {React.createElement(FaLinkedin, { className: "mr-2 text-blue-600" })}
          Publishing Queue
        </h2>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            {React.createElement(FaFilter, { className: "mr-2 text-gray-500" })}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Items</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          
          <button
            onClick={fetchQueue}
            className="px-4 py-2 text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading queue...</p>
        </div>
      ) : queue.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No items in the queue</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusBadge(item)}
                    <span className="text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </span>
                    {item.scheduled_for && (
                      <span className="text-sm text-purple-600 flex items-center">
                        {React.createElement(FaCalendarAlt, { className: "mr-1" })}
                        Scheduled: {formatDate(item.scheduled_for)}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-800 mb-2 line-clamp-3">
                    {item.post_text}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{item.metadata.characterCount} chars</span>
                    <span>{item.metadata.hashtagCount} hashtags</span>
                    <span>{item.metadata.urlCount} URLs</span>
                  </div>
                  
                  {item.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      <strong>Rejection reason:</strong> {item.rejection_reason}
                    </div>
                  )}
                  
                  {item.published_at && item.linkedin_post_url && (
                    <div className="mt-2">
                      <a
                        href={item.linkedin_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View on LinkedIn →
                      </a>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="p-2 text-gray-600 hover:text-gray-800"
                    title="View details"
                  >
                    {React.createElement(FaEye, {})}
                  </button>
                  
                  {item.status === 'pending' && item.approval_status === 'pending_review' && (
                    <>
                      <button
                        onClick={() => approveContent(item.id)}
                        disabled={actionLoading === item.id}
                        className="p-2 text-green-600 hover:text-green-800 disabled:opacity-50"
                        title="Approve"
                      >
                        {React.createElement(FaCheckCircle, {})}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setShowRejectModal(true);
                        }}
                        disabled={actionLoading === item.id}
                        className="p-2 text-red-600 hover:text-red-800 disabled:opacity-50"
                        title="Reject"
                      >
                        {React.createElement(FaTimesCircle, {})}
                      </button>
                    </>
                  )}
                  
                  {item.status === 'approved' && (
                    <button
                      onClick={() => publishContent(item.id)}
                      disabled={actionLoading === item.id}
                      className="p-2 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      title="Publish now"
                    >
                      {React.createElement(FaPaperPlane, {})}
                    </button>
                  )}
                  
                  {['pending', 'rejected', 'failed'].includes(item.status) && (
                    <button
                      onClick={() => deleteContent(item.id)}
                      disabled={actionLoading === item.id}
                      className="p-2 text-red-600 hover:text-red-800 disabled:opacity-50"
                      title="Delete"
                    >
                      {React.createElement(FaTrash, {})}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Safety Checks Summary */}
              {item.safetyChecks && item.safetyChecks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center text-sm">
                    {React.createElement(FaShieldAlt, { className: "mr-2 text-gray-500" })}
                    <span className="text-gray-600 mr-3">Safety Checks:</span>
                    {item.safetyChecks.map((check, index) => (
                      <span
                        key={index}
                        className={`mr-2 ${
                          check.passed ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {check.passed ? '✓' : '✗'} {check.check_type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && !showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold mb-4">Content Details</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Status</h4>
                <div className="flex items-center space-x-3">
                  {getStatusBadge(selectedItem)}
                  {selectedItem.approval_status && (
                    <span className="text-sm text-gray-600">
                      Approval: {selectedItem.approval_status}
                    </span>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Content</h4>
                <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                  {selectedItem.post_text}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Metadata</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Characters:</span>
                    <span className="ml-2 font-medium">
                      {selectedItem.metadata.characterCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Hashtags:</span>
                    <span className="ml-2 font-medium">
                      {selectedItem.metadata.hashtagCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">URLs:</span>
                    <span className="ml-2 font-medium">
                      {selectedItem.metadata.urlCount}
                    </span>
                  </div>
                </div>
              </div>
              
              {selectedItem.safetyChecks && selectedItem.safetyChecks.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Safety Checks</h4>
                  <div className="space-y-2">
                    {selectedItem.safetyChecks.map((check, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded ${
                          check.passed ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center">
                          {check.passed ? (
                            React.createElement(FaCheckCircle, { className: "text-green-600 mr-2" })
                          ) : (
                            React.createElement(FaTimesCircle, { className: "text-red-600 mr-2" })
                          )}
                          <span className="font-medium capitalize">
                            {check.check_type.replace('_', ' ')}
                          </span>
                        </div>
                        {check.details && (
                          <pre className="mt-1 text-xs text-gray-600">
                            {JSON.stringify(check.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Timeline</h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-gray-600">Created:</span>
                    <span className="ml-2">{formatDate(selectedItem.created_at)}</span>
                  </div>
                  {selectedItem.scheduled_for && (
                    <div>
                      <span className="text-gray-600">Scheduled for:</span>
                      <span className="ml-2">{formatDate(selectedItem.scheduled_for)}</span>
                    </div>
                  )}
                  {selectedItem.published_at && (
                    <div>
                      <span className="text-gray-600">Published:</span>
                      <span className="ml-2">{formatDate(selectedItem.published_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Reject Content</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Please provide a reason for rejection..."
                required
              />
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={rejectContent}
                disabled={!rejectionReason.trim() || actionLoading === selectedItem.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast />
    </div>
  );
};

export default LinkedInQueue;