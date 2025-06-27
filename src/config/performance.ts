/**
 * Performance configuration for the Personal Brand DNA application
 */

// Debounce and throttle settings
export const DEBOUNCE_DELAYS = {
  // Workshop auto-save
  workshopAutoSave: 2000, // 2 seconds
  
  // Search inputs
  searchInput: 300, // 300ms
  
  // Form validation
  formValidation: 500, // 500ms
  
  // Text editor changes
  textEditor: 1000, // 1 second
  
  // Analytics tracking
  analyticsEvent: 1000, // 1 second
} as const;

export const THROTTLE_DELAYS = {
  // Scroll events
  scrollEvent: 100, // 100ms
  
  // Window resize
  windowResize: 200, // 200ms
  
  // Mouse move tracking
  mouseMove: 50, // 50ms
  
  // API calls
  apiCall: 1000, // 1 second minimum between calls
} as const;

// Cache TTL configurations (in milliseconds)
export const CACHE_TTL = {
  // User data
  userProfile: 5 * 60 * 1000, // 5 minutes
  userPreferences: 10 * 60 * 1000, // 10 minutes
  
  // Content data
  contentTemplates: 30 * 60 * 1000, // 30 minutes
  contentHistory: 5 * 60 * 1000, // 5 minutes
  generatedContent: 60 * 60 * 1000, // 1 hour
  
  // Workshop data
  workshopSession: 30 * 60 * 1000, // 30 minutes
  workshopValues: 60 * 60 * 1000, // 1 hour
  
  // News data
  newsArticles: 15 * 60 * 1000, // 15 minutes
  newsFeeds: 30 * 60 * 1000, // 30 minutes
  
  // Analytics data
  analyticsMetrics: 5 * 60 * 1000, // 5 minutes
  analyticsReports: 15 * 60 * 1000, // 15 minutes
  
  // LinkedIn data
  linkedInProfile: 60 * 60 * 1000, // 1 hour
  linkedInAnalytics: 30 * 60 * 1000, // 30 minutes
  
  // Voice profile
  voiceSignature: 24 * 60 * 60 * 1000, // 24 hours
  voiceAnalysis: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// Lazy loading thresholds
export const LAZY_LOADING = {
  // Image lazy loading
  imageRootMargin: '50px', // Start loading 50px before visible
  imageThreshold: 0.01, // 1% visible
  
  // Component lazy loading
  componentRootMargin: '100px', // Start loading 100px before visible
  componentThreshold: 0, // As soon as it enters the viewport
  
  // List virtualization
  virtualListOverscan: 5, // Render 5 items outside visible area
  virtualListItemHeight: 80, // Estimated item height in pixels
  
  // Infinite scroll
  infiniteScrollThreshold: 0.8, // Load more when 80% scrolled
  infiniteScrollDebounce: 300, // 300ms debounce
} as const;

// Pagination settings
export const PAGINATION = {
  // Default page sizes
  contentHistory: 20,
  newsArticles: 25,
  analyticsData: 50,
  linkedInPosts: 15,
  
  // Maximum page sizes
  maxContentHistory: 100,
  maxNewsArticles: 100,
  maxAnalyticsData: 200,
  maxLinkedInPosts: 50,
} as const;

// Performance budgets
export const PERFORMANCE_BUDGETS = {
  // Bundle sizes (in KB)
  mainBundle: 300,
  vendorBundle: 500,
  totalBundleSize: 1000,
  
  // Loading times (in ms)
  firstContentfulPaint: 1500,
  largestContentfulPaint: 2500,
  timeToInteractive: 3500,
  
  // API response times (in ms)
  apiResponseTime: 1000,
  criticalApiResponseTime: 500,
  
  // Memory usage (in MB)
  maxMemoryUsage: 100,
  warningMemoryUsage: 75,
} as const;

// Redux persist configuration
export const REDUX_PERSIST_CONFIG = {
  // Keys to persist
  persistKeys: [
    'auth',
    'workshop',
    'userPreferences',
    'contentDrafts',
  ],
  
  // Keys to exclude from persistence
  blacklist: [
    'ui',
    'loading',
    'errors',
    'temporaryData',
  ],
  
  // Storage configuration
  storage: 'localStorage', // or 'sessionStorage'
  
  // Debounce persist writes
  debounce: 1000, // 1 second
  
  // Maximum storage size (in KB)
  maxSize: 5000, // 5MB
} as const;

// API optimization settings
export const API_OPTIMIZATION = {
  // Request batching
  enableBatching: true,
  batchWindowMs: 50, // 50ms window for batching
  maxBatchSize: 10, // Maximum requests per batch
  
  // Request deduplication
  enableDeduplication: true,
  deduplicationWindowMs: 100, // 100ms window
  
  // Response caching
  enableResponseCache: true,
  defaultCacheDuration: 5 * 60 * 1000, // 5 minutes
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  retryBackoffMultiplier: 2,
} as const;

// Prefetch configuration
export const PREFETCH_CONFIG = {
  // Routes to prefetch
  prefetchRoutes: [
    '/dashboard',
    '/content',
    '/voice-discovery',
  ],
  
  // Data to prefetch
  prefetchData: {
    userProfile: true,
    contentTemplates: true,
    voiceProfile: true,
    recentContent: true,
  },
  
  // Prefetch timing
  prefetchDelay: 2000, // 2 seconds after page load
  prefetchOnHover: true,
  hoverDelay: 200, // 200ms hover delay
} as const;

// Service Worker configuration
export const SERVICE_WORKER_CONFIG = {
  // Enable service worker
  enabled: process.env.NODE_ENV === 'production',
  
  // Cache strategies
  cacheStrategies: {
    assets: 'cache-first',
    api: 'network-first',
    images: 'cache-first',
    fonts: 'cache-first',
  },
  
  // Cache expiration
  cacheExpiration: {
    assets: 7 * 24 * 60 * 60, // 7 days
    api: 5 * 60, // 5 minutes
    images: 30 * 24 * 60 * 60, // 30 days
    fonts: 365 * 24 * 60 * 60, // 1 year
  },
} as const;

// Export utility functions
export const shouldCache = (key: string): boolean => {
  return Object.keys(CACHE_TTL).includes(key);
};

export const getCacheTTL = (key: keyof typeof CACHE_TTL): number => {
  return CACHE_TTL[key] || 0;
};

export const getDebounceDelay = (key: keyof typeof DEBOUNCE_DELAYS): number => {
  return DEBOUNCE_DELAYS[key] || 300;
};

export const getThrottleDelay = (key: keyof typeof THROTTLE_DELAYS): number => {
  return THROTTLE_DELAYS[key] || 100;
};