import React, { useState, useEffect } from 'react';
import { Linkedin, Send, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { linkedinAPI, validatePostContent } from '../../services/linkedinAPI';
import { toast } from '../Toast';

interface LinkedInPostButtonProps {
  content: string;
  contentId: string;
  onSuccess?: () => void;
  className?: string;
}

const LinkedInPostButton: React.FC<LinkedInPostButtonProps> = ({
  content,
  contentId,
  onSuccess,
  className = ''
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');

  useEffect(() => {
    checkLinkedInStatus();
  }, []);

  const checkLinkedInStatus = async () => {
    try {
      const response = await linkedinAPI.getStatus();
      setIsConnected(response.data.connected);
    } catch (error) {
      console.error('Failed to check LinkedIn status:', error);
    }
  };

  const handlePostNow = async () => {
    // Validate content before posting
    const validation = validatePostContent(content);
    if (!validation.valid) {
      toast.error('Content validation failed', validation.errors.join(', '));
      return;
    }

    setIsPosting(true);
    try {
      const response = await linkedinAPI.publishNow({ contentId });
      toast.success('Posted to LinkedIn!', 'Your content is now live on LinkedIn');
      if (onSuccess) onSuccess();
      setShowOptions(false);
    } catch (error: any) {
      console.error('Failed to post to LinkedIn:', error);
      toast.error('Failed to post', error.response?.data?.error || 'Unable to post to LinkedIn');
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!scheduleDate) {
      toast.error('Please select a date', 'Choose when you want to post');
      return;
    }

    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    
    setIsPosting(true);
    try {
      const response = await linkedinAPI.queuePost({
        contentId,
        scheduledFor,
        autoPublish: false
      });
      
      toast.success(
        'Scheduled successfully!', 
        `Your post will be published on ${new Date(scheduledFor).toLocaleString()}`
      );
      
      if (onSuccess) onSuccess();
      setShowScheduler(false);
      setShowOptions(false);
    } catch (error: any) {
      console.error('Failed to schedule post:', error);
      toast.error('Failed to schedule', error.response?.data?.error || 'Unable to schedule post');
    } finally {
      setIsPosting(false);
    }
  };

  const connectLinkedIn = async () => {
    try {
      const response = await linkedinAPI.startAuth();
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to start LinkedIn auth:', error);
      toast.error('Failed to connect', 'Unable to connect to LinkedIn');
    }
  };

  if (!isConnected) {
    return (
      <button
        onClick={connectLinkedIn}
        className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${className}`}
      >
        <Linkedin className="w-4 h-4" />
        Connect LinkedIn
      </button>
    );
  }

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setShowOptions(!showOptions)}
          disabled={isPosting}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
        >
          <Linkedin className="w-4 h-4" />
          {isPosting ? 'Posting...' : 'Post to LinkedIn'}
        </button>

        {showOptions && !showScheduler && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
            <button
              onClick={handlePostNow}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100"
            >
              <Send className="w-4 h-4 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">Post Now</div>
                <div className="text-xs text-gray-500">Publish immediately</div>
              </div>
            </button>
            <button
              onClick={() => {
                setShowScheduler(true);
                setShowOptions(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">Schedule</div>
                <div className="text-xs text-gray-500">Choose date & time</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {showScheduler && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Schedule LinkedIn Post
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time
                </label>
                <select
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="08:00">8:00 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="18:00">6:00 PM</option>
                  <option value="19:00">7:00 PM</option>
                </select>
              </div>

              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Optimal posting times:</p>
                    <p>Weekdays 8-10 AM, 12 PM, 5-6 PM</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduler(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedulePost}
                disabled={!scheduleDate || isPosting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPosting ? 'Scheduling...' : 'Schedule Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LinkedInPostButton;