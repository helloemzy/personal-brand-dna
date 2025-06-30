import { AxiosResponse } from 'axios';
import apiClient from './authAPI-consolidated';

// Calendar API response types
export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  content: string;
  contentId?: string;
  scheduledFor: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platformId?: string;
  platform: 'linkedin' | 'twitter' | 'facebook';
  metadata?: {
    contentType?: string;
    templateUsed?: string;
    tags?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  totalEvents: number;
}

export interface CalendarStatsResponse {
  scheduled: number;
  published: number;
  failed: number;
  upcoming: CalendarEvent[];
  recentlyPublished: CalendarEvent[];
}

export interface CreateEventRequest {
  title: string;
  content: string;
  contentId?: string;
  scheduledFor: string;
  platform: 'linkedin' | 'twitter' | 'facebook';
  metadata?: Record<string, any>;
}

export interface UpdateEventRequest {
  title?: string;
  content?: string;
  scheduledFor?: string;
  status?: 'draft' | 'scheduled' | 'published' | 'failed';
  metadata?: Record<string, any>;
}

// Calendar API service
export const calendarAPI = {
  // Get calendar events
  getEvents: async (params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    platform?: string;
    page?: number;
    limit?: number;
  }): Promise<AxiosResponse<CalendarEventsResponse>> => {
    const queryParams = new URLSearchParams({ action: 'events' });
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.platform) queryParams.append('platform', params.platform);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return apiClient.get(`/calendar?${queryParams.toString()}`);
  },

  // Get specific event
  getEvent: async (eventId: string): Promise<AxiosResponse<{ event: CalendarEvent }>> => {
    return apiClient.get(`/calendar?action=event&id=${eventId}`);
  },

  // Create a new event
  createEvent: async (event: CreateEventRequest): Promise<AxiosResponse<{ event: CalendarEvent }>> => {
    return apiClient.post('/calendar?action=create', event);
  },

  // Update an event
  updateEvent: async (
    eventId: string,
    updates: UpdateEventRequest
  ): Promise<AxiosResponse<{ event: CalendarEvent }>> => {
    return apiClient.put(`/calendar?action=update&id=${eventId}`, updates);
  },

  // Delete an event
  deleteEvent: async (eventId: string): Promise<AxiosResponse<{ message: string }>> => {
    return apiClient.delete(`/calendar?action=delete&id=${eventId}`);
  },

  // Get calendar statistics
  getStats: async (params?: {
    timeframe?: 'week' | 'month' | 'quarter';
  }): Promise<AxiosResponse<CalendarStatsResponse>> => {
    const queryParams = new URLSearchParams({ action: 'stats' });
    if (params?.timeframe) queryParams.append('timeframe', params.timeframe);

    return apiClient.get(`/calendar?${queryParams.toString()}`);
  },

  // Bulk schedule events
  bulkSchedule: async (events: CreateEventRequest[]): Promise<AxiosResponse<{
    created: number;
    failed: number;
    events: CalendarEvent[];
    errors?: string[];
  }>> => {
    return apiClient.post('/calendar?action=bulk-create', { events });
  },

  // Reschedule an event
  rescheduleEvent: async (
    eventId: string,
    newDate: string
  ): Promise<AxiosResponse<{ event: CalendarEvent }>> => {
    return apiClient.put(`/calendar?action=reschedule&id=${eventId}`, { scheduledFor: newDate });
  },

  // Get optimal posting times
  getOptimalTimes: async (params?: {
    platform?: string;
    timezone?: string;
  }): Promise<AxiosResponse<{
    optimalTimes: Array<{
      dayOfWeek: string;
      times: string[];
      engagementScore: number;
    }>;
  }>> => {
    const queryParams = new URLSearchParams({ action: 'optimal-times' });
    if (params?.platform) queryParams.append('platform', params.platform);
    if (params?.timezone) queryParams.append('timezone', params.timezone);

    return apiClient.get(`/calendar?${queryParams.toString()}`);
  },
};

// Helper functions
export const getEventStatusColor = (status: string): string => {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'published':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const formatEventDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
  
  if (isToday) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getTimeUntilPost = (scheduledFor: string): string => {
  const scheduled = new Date(scheduledFor);
  const now = new Date();
  const diffInMs = scheduled.getTime() - now.getTime();
  
  if (diffInMs < 0) return 'Past due';
  
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInDays > 0) return `In ${diffInDays} day${diffInDays > 1 ? 's' : ''}`;
  if (diffInHours > 0) return `In ${diffInHours} hour${diffInHours > 1 ? 's' : ''}`;
  
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  return `In ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
};

export default calendarAPI;