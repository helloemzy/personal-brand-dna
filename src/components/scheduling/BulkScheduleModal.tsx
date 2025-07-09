import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, AlertCircle, Check } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { contentSchedulingService } from '../../services/contentSchedulingService';
import { ContentItem } from '../../types/content';
import { useAppSelector } from '../../store/hooks';

interface BulkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentItems: ContentItem[];
  onScheduled: () => void;
}

export function BulkScheduleModal({ 
  isOpen, 
  onClose, 
  contentItems, 
  onScheduled 
}: BulkScheduleModalProps) {
  const user = useAppSelector(state => state.auth.user);
  const [startDate, setStartDate] = useState(new Date());
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSchedule = async () => {
    if (!user?.id) return;

    setIsScheduling(true);
    setError(null);
    setScheduledCount(0);

    try {
      // Convert ContentItems to the format expected by the scheduling service
      const posts = contentItems.map(item => ({
        userId: user.id,
        title: item.title || 'Scheduled Post',
        content: item.content,
        contentType: 'post' as const,
        hashtags: item.hashtags,
        source: 'ai' as const
      }));

      // Schedule posts
      const scheduled = await contentSchedulingService.bulkSchedulePosts(
        user.id,
        posts,
        startDate
      );

      setScheduledCount(scheduled.length);
      
      // Wait briefly to show success
      setTimeout(() => {
        onScheduled();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error bulk scheduling:', error);
      setError('Failed to schedule content. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg max-w-md w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center mb-4">
          <Calendar className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-900">Bulk Schedule Content</h2>
        </div>

        {!isScheduling && scheduledCount === 0 && (
          <>
            <p className="text-gray-600 mb-6">
              Schedule {contentItems.length} posts automatically based on your preferences.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={format(startDate, 'yyyy-MM-dd')}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Scheduling Info</p>
                    <ul className="space-y-1">
                      <li>• Posts will be distributed based on your preferences</li>
                      <li>• Optimal posting times will be selected automatically</li>
                      <li>• Weekends will be skipped if configured</li>
                    </ul>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-sm text-red-900">{error}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Schedule {contentItems.length} Posts
              </button>
            </div>
          </>
        )}

        {isScheduling && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Scheduling your content...</p>
          </div>
        )}

        {scheduledCount > 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              Successfully Scheduled!
            </p>
            <p className="text-gray-600">
              {scheduledCount} posts have been added to your calendar
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}