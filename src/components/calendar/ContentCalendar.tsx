import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  Filter,
  Download,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit2,
  Trash2,
  Copy,
  MoreVertical
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
         eachDayOfInterval, isSameMonth, isSameDay, addMonths, 
         subMonths, addWeeks, subWeeks, isToday, isPast } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { RootState } from '../../store';

// Types
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  contentType: 'post' | 'article' | 'carousel' | 'video' | 'story' | 'poll';
  contentBody?: string;
  scheduledFor?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  color: string;
  platforms: { linkedin?: boolean; twitter?: boolean; facebook?: boolean };
  hashtags: string[];
  mentions: string[];
  seriesName?: string;
  seriesPartNumber?: number;
  seriesTotalParts?: number;
}

interface CalendarViewState {
  currentDate: Date;
  viewType: 'month' | 'week' | 'day' | 'list';
  selectedDate: Date | null;
  filters: {
    contentTypes: string[];
    statuses: string[];
  };
}

// Content type configurations
const contentTypeConfig = {
  post: { label: 'Post', color: '#3B82F6', icon: '📝' },
  article: { label: 'Article', color: '#10B981', icon: '📄' },
  carousel: { label: 'Carousel', color: '#8B5CF6', icon: '🎠' },
  video: { label: 'Video', color: '#EF4444', icon: '🎥' },
  story: { label: 'Story', color: '#F59E0B', icon: '📖' },
  poll: { label: 'Poll', color: '#EC4899', icon: '📊' }
};

// Event Card Component
const EventCard: React.FC<{
  event: CalendarEvent;
  isDragging?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ event, isDragging, onEdit, onDelete, onDuplicate }) => {
  const [showMenu, setShowMenu] = useState(false);
  const config = contentTypeConfig[event.contentType];
  
  const getStatusIcon = () => {
    switch (event.status) {
      case 'published':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'scheduled':
        return <Clock className="w-3 h-3 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };
  
  return (
    <div 
      className={`
        bg-white p-2 rounded-md shadow-sm border transition-all
        ${isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'}
        ${event.status === 'cancelled' ? 'opacity-50' : ''}
      `}
      style={{ borderLeftColor: config.color, borderLeftWidth: '3px' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1 mb-1">
            <span className="text-xs">{config.icon}</span>
            <span className="text-xs font-medium text-gray-600 truncate">
              {config.label}
            </span>
            {getStatusIcon()}
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">
            {event.title}
          </p>
          {event.seriesName && (
            <p className="text-xs text-gray-500 mt-1">
              {event.seriesName} ({event.seriesPartNumber}/{event.seriesTotalParts})
            </p>
          )}
        </div>
        
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <MoreVertical className="w-3 h-3 text-gray-400" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
              <button
                onClick={() => {
                  onEdit();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center"
              >
                <Edit2 className="w-3 h-3 mr-2" />
                Edit
              </button>
              <button
                onClick={() => {
                  onDuplicate();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center"
              >
                <Copy className="w-3 h-3 mr-2" />
                Duplicate
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center text-red-600"
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Calendar Day Cell Component
const DayCell: React.FC<{
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  onSelectDate: (date: Date) => void;
  onDropEvent: (eventId: string, date: Date) => void;
}> = ({ date, events, isCurrentMonth, isSelected, onSelectDate, onDropEvent }) => {
  const isToday_ = isToday(date);
  const isPast_ = isPast(date) && !isToday_;
  
  return (
    <Droppable droppableId={format(date, 'yyyy-MM-dd')} type="event">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          onClick={() => onSelectDate(date)}
          className={`
            min-h-[100px] p-2 border-r border-b cursor-pointer transition-all
            ${!isCurrentMonth ? 'bg-gray-50' : 'bg-white'}
            ${isSelected ? 'ring-2 ring-blue-500' : ''}
            ${isToday_ ? 'bg-blue-50' : ''}
            ${isPast_ ? 'opacity-60' : ''}
            ${snapshot.isDraggingOver ? 'bg-blue-100' : ''}
            hover:bg-gray-50
          `}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={`
              text-sm font-medium
              ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}
              ${isToday_ ? 'text-blue-600' : ''}
            `}>
              {format(date, 'd')}
            </span>
            {events.length > 3 && (
              <span className="text-xs text-gray-500">
                +{events.length - 3}
              </span>
            )}
          </div>
          
          <div className="space-y-1">
            {events.slice(0, 3).map((event, index) => (
              <Draggable
                key={event.id}
                draggableId={event.id}
                index={index}
                isDragDisabled={event.status === 'published'}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={provided.draggableProps.style}
                  >
                    <EventCard
                      event={event}
                      isDragging={snapshot.isDragging}
                      onEdit={() => console.log('Edit:', event.id)}
                      onDelete={() => console.log('Delete:', event.id)}
                      onDuplicate={() => console.log('Duplicate:', event.id)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
          </div>
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
};

// Main Calendar Component
const ContentCalendar: React.FC = () => {
  const dispatch = useDispatch();
  const [viewState, setViewState] = useState<CalendarViewState>({
    currentDate: new Date(),
    viewType: 'month',
    selectedDate: null,
    filters: {
      contentTypes: [],
      statuses: []
    }
  });
  
  const [events, setEvents] = useState<CalendarEvent[]>([
    // Mock data for demonstration
    {
      id: '1',
      title: 'AI in Business: Weekly Insights',
      contentType: 'article',
      scheduledFor: format(new Date(), 'yyyy-MM-dd'),
      status: 'scheduled',
      color: '#10B981',
      platforms: { linkedin: true },
      hashtags: ['#AI', '#BusinessStrategy'],
      mentions: []
    },
    {
      id: '2',
      title: 'Team Leadership Tips',
      contentType: 'carousel',
      scheduledFor: format(addWeeks(new Date(), 1), 'yyyy-MM-dd'),
      status: 'draft',
      color: '#8B5CF6',
      platforms: { linkedin: true },
      hashtags: ['#Leadership'],
      mentions: [],
      seriesName: 'Leadership Series',
      seriesPartNumber: 3,
      seriesTotalParts: 10
    }
  ]);
  
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Get calendar days
  const getCalendarDays = useCallback(() => {
    const start = startOfWeek(startOfMonth(viewState.currentDate));
    const end = endOfWeek(endOfMonth(viewState.currentDate));
    return eachDayOfInterval({ start, end });
  }, [viewState.currentDate]);
  
  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter(event => event.scheduledFor === dateStr);
  };
  
  // Handle navigation
  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = direction === 'next' 
      ? addMonths(viewState.currentDate, 1)
      : subMonths(viewState.currentDate, 1);
    setViewState({ ...viewState, currentDate: newDate });
  };
  
  // Handle drag and drop
  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const eventId = result.draggableId;
    const newDate = result.destination.droppableId;
    
    setEvents(events.map(event => 
      event.id === eventId 
        ? { ...event, scheduledFor: newDate }
        : event
    ));
  };
  
  // Handle event actions
  const handleCreateEvent = (date?: Date) => {
    setSelectedEvent(null);
    setShowEventModal(true);
  };
  
  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };
  
  const handleDeleteEvent = (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      setEvents(events.filter(e => e.id !== eventId));
    }
  };
  
  const handleDuplicateEvent = (event: CalendarEvent) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: `${Date.now()}`,
      title: `${event.title} (Copy)`,
      status: 'draft',
      scheduledFor: undefined
    };
    setEvents([...events, newEvent]);
  };
  
  const calendarDays = getCalendarDays();
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <CalendarIcon className="w-8 h-8 mr-3 text-blue-600" />
          Content Calendar
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Plan, schedule, and manage your content across all platforms
        </p>
      </div>
      
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          {/* View Controls */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateCalendar('prev')}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
                {format(viewState.currentDate, 'MMMM yyyy')}
              </h2>
              <button
                onClick={() => navigateCalendar('next')}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <button
              onClick={() => setViewState({ ...viewState, currentDate: new Date() })}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Today
            </button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setViewState({ ...viewState, viewType: 'month' })}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  viewState.viewType === 'month' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewState({ ...viewState, viewType: 'week' })}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  viewState.viewType === 'week' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewState({ ...viewState, viewType: 'list' })}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  viewState.viewType === 'list' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>
            
            <button className="flex items-center text-gray-600 hover:text-gray-900">
              <Filter className="w-5 h-5 mr-1" />
              Filter
            </button>
            
            <button
              onClick={() => handleCreateEvent()}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-1" />
              New Post
            </button>
          </div>
        </div>
      </div>
      
      {/* Calendar Grid */}
      {viewState.viewType === 'month' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="px-2 py-3 text-sm font-medium text-gray-700 text-center">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-7">
              {calendarDays.map((date) => (
                <DayCell
                  key={format(date, 'yyyy-MM-dd')}
                  date={date}
                  events={getEventsForDate(date)}
                  isCurrentMonth={isSameMonth(date, viewState.currentDate)}
                  isSelected={viewState.selectedDate ? isSameDay(date, viewState.selectedDate) : false}
                  onSelectDate={(date) => setViewState({ ...viewState, selectedDate: date })}
                  onDropEvent={(eventId, date) => console.log('Drop:', eventId, date)}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}
      
      {/* Stats Section */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Scheduled</p>
              <p className="text-2xl font-semibold text-gray-900">
                {events.filter(e => e.status === 'scheduled').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Drafts</p>
              <p className="text-2xl font-semibold text-gray-900">
                {events.filter(e => e.status === 'draft').length}
              </p>
            </div>
            <Edit2 className="w-8 h-8 text-gray-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Published</p>
              <p className="text-2xl font-semibold text-gray-900">
                {events.filter(e => e.status === 'published').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Week</p>
              <p className="text-2xl font-semibold text-gray-900">7</p>
            </div>
            <CalendarIcon className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentCalendar;