import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, View, SlotInfo, Event as CalendarEvent } from 'react-big-calendar';
import moment from 'moment';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop/withDragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Filter,
  Plus, 
  Download,
  Upload,
  BarChart,
  Settings,
  Grid,
  List,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { contentSchedulingService } from '../services/contentSchedulingService';
import { linkedinAPI } from '../services/linkedinAPI';
import { ContentFromNewsModal } from '../components/content/ContentFromNewsModal';
import { motion } from 'framer-motion';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

interface ScheduledEvent extends CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  content: string;
  contentType: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  source: string;
  linkedinQueueId?: string;
  hashtags?: string[];
}

interface CalendarFilter {
  contentTypes: string[];
  status: string[];
  source: string[];
}

export default function ContentCalendarPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<ScheduledEvent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CalendarFilter>({
    contentTypes: [],
    status: [],
    source: []
  });
  const [queueHealth, setQueueHealth] = useState<any>(null);

  // Load calendar events
  useEffect(() => {
    if (user?.id) {
      loadCalendarEvents();
      loadQueueHealth();
    }
  }, [user, date, view]);

  const loadCalendarEvents = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      switch (view) {
        case 'week':
          startDate = startOfWeek(date);
          endDate = endOfWeek(date);
          break;
        case 'month':
          startDate = startOfMonth(date);
          endDate = endOfMonth(date);
          break;
        default:
          startDate = new Date(date);
          endDate = new Date(date);
          endDate.setHours(23, 59, 59, 999);
      }

      const calendarEvents = await contentSchedulingService.getContentCalendar(
        user.id,
        startDate,
        endDate
      );

      const formattedEvents: ScheduledEvent[] = calendarEvents.map(event => ({
        id: event.id,
        title: event.title,
        start: new Date(event.scheduledFor),
        end: new Date(event.scheduledFor),
        content: event.content,
        contentType: event.contentType,
        status: event.status,
        source: event.source,
        linkedinQueueId: event.linkedinQueueId,
        hashtags: event.hashtags
      }));

      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQueueHealth = async () => {
    if (!user?.id) return;
    
    try {
      const health = await contentSchedulingService.getQueueHealth(user.id);
      setQueueHealth(health);
    } catch (error) {
      console.error('Error loading queue health:', error);
    }
  };

  // Handle drag and drop
  const moveEvent = useCallback(
    async ({ event, start, end }: any) => {
      const updatedEvent = { ...event, start, end };
      
      try {
        await contentSchedulingService.updateScheduledPost(event.id, {
          scheduledFor: start
        });
        
        setEvents(prev => 
          prev.map(e => e.id === event.id ? updatedEvent : e)
        );
      } catch (error) {
        console.error('Error moving event:', error);
        // Revert on error
        loadCalendarEvents();
      }
    },
    []
  );

  // Handle resize
  const resizeEvent = useCallback(
    async ({ event, start, end }: any) => {
      const updatedEvent = { ...event, start, end };
      
      try {
        await contentSchedulingService.updateScheduledPost(event.id, {
          scheduledFor: start
        });
        
        setEvents(prev => 
          prev.map(e => e.id === event.id ? updatedEvent : e)
        );
      } catch (error) {
        console.error('Error resizing event:', error);
        loadCalendarEvents();
      }
    },
    []
  );

  // Handle event selection
  const handleSelectEvent = (event: ScheduledEvent) => {
    setSelectedEvent(event);
  };

  // Handle slot selection (create new event)
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    // Set the date for new event creation
    setDate(slotInfo.start);
    setShowCreateModal(true);
  };

  // Custom event style
  const eventStyleGetter = (event: ScheduledEvent) => {
    let backgroundColor = '#3B82F6'; // Default blue
    
    switch (event.status) {
      case 'published':
        backgroundColor = '#10B981'; // Green
        break;
      case 'failed':
        backgroundColor = '#EF4444'; // Red
        break;
      case 'cancelled':
        backgroundColor = '#6B7280'; // Gray
        break;
      case 'draft':
        backgroundColor = '#F59E0B'; // Amber
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  // Filter events
  const filteredEvents = events.filter(event => {
    if (filters.contentTypes.length > 0 && !filters.contentTypes.includes(event.contentType)) {
      return false;
    }
    if (filters.status.length > 0 && !filters.status.includes(event.status)) {
      return false;
    }
    if (filters.source.length > 0 && !filters.source.includes(event.source)) {
      return false;
    }
    return true;
  });

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <CalendarIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
                  <p className="text-sm text-gray-500">Plan and schedule your content</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* View Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setView('month')}
                    className={`px-3 py-1 rounded ${
                      view === 'month' 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setView('week')}
                    className={`px-3 py-1 rounded ${
                      view === 'week' 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                {/* Actions */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </button>
                
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Health Bar */}
        {queueHealth && (
          <div className="bg-white border-b px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                    <BarChart className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Queue Health</span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <div>
                      <span className="text-gray-500">Total Scheduled:</span>
                      <span className="ml-1 font-medium text-gray-900">{queueHealth.totalScheduled}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Next Week:</span>
                      <span className="ml-1 font-medium text-gray-900">{queueHealth.nextWeekCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Empty Days:</span>
                      <span className="ml-1 font-medium text-orange-600">{queueHealth.emptyDays.length}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={loadQueueHealth}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              
              {/* Content Balance */}
              <div className="mt-2 flex items-center space-x-4">
                <span className="text-xs text-gray-500">Content Balance:</span>
                <div className="flex-1 flex space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-blue-500"
                      style={{ width: `${queueHealth.contentBalance.expertise}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">Expertise {queueHealth.contentBalance.expertise}%</span>
                </div>
                <div className="flex-1 flex space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-green-500"
                      style={{ width: `${queueHealth.contentBalance.experience}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">Experience {queueHealth.contentBalance.experience}%</span>
                </div>
                <div className="flex-1 flex space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-purple-500"
                      style={{ width: `${queueHealth.contentBalance.evolution}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">Evolution {queueHealth.contentBalance.evolution}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-lg shadow" style={{ height: '600px' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <DnDCalendar
                localizer={localizer}
                events={filteredEvents}
                view={view}
                date={date}
                onView={setView}
                onNavigate={setDate}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
                onEventDrop={moveEvent}
                onEventResize={resizeEvent}
                eventPropGetter={eventStyleGetter}
                selectable
                resizable
                style={{ height: '100%' }}
                components={{
                  event: CustomEvent
                }}
              />
            )}
          </div>
        </div>

        {/* Event Details Modal */}
        {selectedEvent && (
          <EventDetailsModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onUpdate={loadCalendarEvents}
          />
        )}

        {/* Create Post Modal */}
        {showCreateModal && (
          <CreatePostModal
            date={date}
            onClose={() => setShowCreateModal(false)}
            onCreated={loadCalendarEvents}
          />
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <SchedulingSettingsModal
            onClose={() => setShowSettingsModal(false)}
            onSaved={loadCalendarEvents}
          />
        )}
      </div>
    </DndProvider>
  );
}

// Custom Event Component
function CustomEvent({ event }: { event: ScheduledEvent }) {
  const getStatusIcon = () => {
    switch (event.status) {
      case 'published':
        return <CheckCircle className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      case 'scheduled':
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-1 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium truncate">{event.title}</span>
        {getStatusIcon()}
      </div>
    </div>
  );
}

// Event Details Modal
function EventDetailsModal({ 
  event, 
  onClose, 
  onUpdate 
}: { 
  event: ScheduledEvent;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEvent, setEditedEvent] = useState(event);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await contentSchedulingService.updateScheduledPost(event.id, {
        title: editedEvent.title,
        content: editedEvent.content,
        scheduledFor: editedEvent.start,
        hashtags: editedEvent.hashtags
      });
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating event:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this post?')) {
      try {
        await contentSchedulingService.cancelScheduledPost(event.id);
        onUpdate();
        onClose();
      } catch (error) {
        console.error('Error cancelling post:', error);
      }
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
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Post Details</h2>
            <div className="flex items-center space-x-2">
              {event.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {isEditing ? 'Cancel Edit' : 'Edit'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="text-red-600 hover:text-red-700"
                  >
                    Cancel Post
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Status:</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                event.status === 'published' ? 'bg-green-100 text-green-800' :
                event.status === 'failed' ? 'bg-red-100 text-red-800' :
                event.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {event.status}
              </span>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedEvent.title}
                  onChange={e => setEditedEvent({ ...editedEvent, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : (
                <p className="text-gray-900">{event.title}</p>
              )}
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content
              </label>
              {isEditing ? (
                <textarea
                  value={editedEvent.content}
                  onChange={e => setEditedEvent({ ...editedEvent, content: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : (
                <p className="text-gray-900 whitespace-pre-wrap">{event.content}</p>
              )}
            </div>

            {/* Scheduled Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled For
              </label>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={format(editedEvent.start, "yyyy-MM-dd'T'HH:mm")}
                  onChange={e => setEditedEvent({ 
                    ...editedEvent, 
                    start: new Date(e.target.value),
                    end: new Date(e.target.value)
                  })}
                  className="px-3 py-2 border rounded-lg"
                />
              ) : (
                <p className="text-gray-900">
                  {format(event.start, 'MMMM d, yyyy h:mm a')}
                </p>
              )}
            </div>

            {/* Hashtags */}
            {event.hashtags && event.hashtags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hashtags
                </label>
                <div className="flex flex-wrap gap-2">
                  {event.hashtags.map((tag, index) => (
                    <span key={index} className="text-blue-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* LinkedIn Queue ID */}
            {event.linkedinQueueId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LinkedIn Queue ID
                </label>
                <p className="text-gray-500 text-sm font-mono">{event.linkedinQueueId}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {isEditing && (
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Create Post Modal
function CreatePostModal({ 
  date, 
  onClose, 
  onCreated 
}: { 
  date: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const user = useAppSelector(state => state.auth.user);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState(date);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!user?.id || !content.trim()) return;

    setCreating(true);
    try {
      await contentSchedulingService.schedulePost({
        userId: user.id,
        title: title || 'Scheduled Post',
        content,
        contentType: 'post',
        scheduledFor: scheduledDate,
        source: 'manual'
      });

      onCreated();
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setCreating(false);
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
        className="bg-white rounded-lg max-w-2xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Post</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Give your post a title..."
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content
              </label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your post content..."
                rows={6}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="mt-1 text-sm text-gray-500">
                {content.length}/3000 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule For
              </label>
              <input
                type="datetime-local"
                value={format(scheduledDate, "yyyy-MM-dd'T'HH:mm")}
                onChange={e => setScheduledDate(new Date(e.target.value))}
                className="px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!content.trim() || creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Schedule Post'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Scheduling Settings Modal
function SchedulingSettingsModal({ 
  onClose, 
  onSaved 
}: { 
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = useAppSelector(state => state.auth.user);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    if (!user?.id) return;
    
    try {
      const prefs = await contentSchedulingService.getSchedulingPreferences(user.id);
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    setSaving(true);
    try {
      await contentSchedulingService.saveSchedulingPreferences(preferences);
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

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
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Scheduling Preferences</h2>
          
          {preferences && (
            <div className="space-y-6">
              {/* Posting Frequency */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Posting Frequency</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Posts Per Day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={preferences.postsPerDay}
                      onChange={e => setPreferences({
                        ...preferences,
                        postsPerDay: parseInt(e.target.value)
                      })}
                      className="w-24 px-3 py-2 border rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Posts Per Week
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={preferences.postsPerWeek}
                      onChange={e => setPreferences({
                        ...preferences,
                        postsPerWeek: parseInt(e.target.value)
                      })}
                      className="w-24 px-3 py-2 border rounded-lg"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="excludeWeekends"
                      checked={preferences.excludeWeekends}
                      onChange={e => setPreferences({
                        ...preferences,
                        excludeWeekends: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <label htmlFor="excludeWeekends" className="text-sm text-gray-700">
                      Exclude weekends
                    </label>
                  </div>
                </div>
              </div>

              {/* Preferred Times */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Preferred Posting Times</h3>
                <div className="space-y-2">
                  {preferences.preferredTimes.map((time: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="time"
                        value={time}
                        onChange={e => {
                          const newTimes = [...preferences.preferredTimes];
                          newTimes[index] = e.target.value;
                          setPreferences({
                            ...preferences,
                            preferredTimes: newTimes
                          });
                        }}
                        className="px-3 py-2 border rounded-lg"
                      />
                      <button
                        onClick={() => {
                          const newTimes = preferences.preferredTimes.filter((_: any, i: number) => i !== index);
                          setPreferences({
                            ...preferences,
                            preferredTimes: newTimes
                          });
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setPreferences({
                      ...preferences,
                      preferredTimes: [...preferences.preferredTimes, '12:00']
                    })}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    + Add Time
                  </button>
                </div>
              </div>

              {/* Content Distribution */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Content Distribution</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expertise ({preferences.contentDistribution.expertise}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={preferences.contentDistribution.expertise}
                      onChange={e => {
                        const value = parseInt(e.target.value);
                        const remaining = 100 - value;
                        const experience = Math.floor(remaining * 0.6);
                        const evolution = remaining - experience;
                        
                        setPreferences({
                          ...preferences,
                          contentDistribution: {
                            expertise: value,
                            experience,
                            evolution
                          }
                        });
                      }}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Experience ({preferences.contentDistribution.experience}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={preferences.contentDistribution.experience}
                      onChange={e => {
                        const value = parseInt(e.target.value);
                        const expertise = preferences.contentDistribution.expertise;
                        const evolution = 100 - expertise - value;
                        
                        if (evolution >= 0) {
                          setPreferences({
                            ...preferences,
                            contentDistribution: {
                              ...preferences.contentDistribution,
                              experience: value,
                              evolution
                            }
                          });
                        }
                      }}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Evolution ({preferences.contentDistribution.evolution}%)
                    </label>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-full rounded-full"
                        style={{ width: `${preferences.contentDistribution.evolution}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}