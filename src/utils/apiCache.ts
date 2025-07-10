import { apiCache } from '../services/cacheService';
import { performanceMonitor } from './performanceMonitor';

interface ApiCacheOptions {
  ttl?: number;
  storage?: 'memory' | 'localStorage';
  cacheKey?: string;
  invalidatePattern?: string;
  skipCache?: boolean;
  forceRefresh?: boolean;
}

interface CachedResponse<T> {
  data: T;
  timestamp: number;
  etag?: string;
  headers?: Record<string, string>;
}

/**
 * Create a cached API function
 */
export function createCachedApi<TParams extends any[], TResult>(
  apiFunction: (...args: TParams) => Promise<TResult>,
  defaultOptions: ApiCacheOptions = {}
) {
  return async function cachedApiCall(
    ...args: [...TParams, ApiCacheOptions?]
  ): Promise<TResult> {
    // Extract options from last argument if provided
    const lastArg = args[args.length - 1];
    const hasOptions = lastArg && typeof lastArg === 'object' && 'ttl' in lastArg;
    const options: ApiCacheOptions = hasOptions 
      ? { ...defaultOptions, ...lastArg }
      : defaultOptions;
    
    const apiArgs = hasOptions 
      ? args.slice(0, -1) as TParams
      : args as TParams;

    // Skip cache if requested
    if (options.skipCache) {
      return apiFunction(...apiArgs);
    }

    // Generate cache key
    const cacheKey = options.cacheKey || generateCacheKey(apiFunction.name, apiArgs);

    // Force refresh if requested
    if (options.forceRefresh) {
      await apiCache.remove(cacheKey, { storage: options.storage });
    }

    // Try to get from cache
    const cached = await apiCache.get<CachedResponse<TResult>>(cacheKey, {
      storage: options.storage
    });

    if (cached) {
      performanceMonitor.mark(`api-cache-hit-${apiFunction.name}`);
      return cached.data;
    }

    // Call API and cache result
    performanceMonitor.mark(`api-cache-miss-${apiFunction.name}`);
    
    try {
      const result = await apiFunction(...apiArgs);
      
      const cacheData: CachedResponse<TResult> = {
        data: result,
        timestamp: Date.now()
      };

      await apiCache.set(cacheKey, cacheData, {
        ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
        storage: options.storage || 'memory'
      });

      // Invalidate related cache if pattern provided
      if (options.invalidatePattern) {
        await apiCache.invalidateByPattern(options.invalidatePattern, {
          storage: options.storage
        });
      }

      return result;
    } catch (error) {
      // On error, return stale cache if available
      if (cached) {
        console.warn('Returning stale cache due to API error:', error);
        return cached.data;
      }
      throw error;
    }
  };
}

/**
 * Cache decorator for class methods
 */
export function CacheApi(options: ApiCacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = createCachedApi(originalMethod, {
      ...options,
      cacheKey: options.cacheKey || `${target.constructor.name}.${propertyKey}`
    });

    return descriptor;
  };
}

/**
 * Generate consistent cache key from function name and arguments
 */
function generateCacheKey(functionName: string, args: any[]): string {
  const argsString = JSON.stringify(args, (key, value) => {
    // Handle circular references and functions
    if (typeof value === 'function') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    return value;
  });

  return `api:${functionName}:${hashString(argsString)}`;
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Batch API calls with caching
 */
export class BatchApiCache<TKey, TResult> {
  private batchQueue: Map<TKey, Promise<TResult>> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  
  constructor(
    private batchFunction: (keys: TKey[]) => Promise<Map<TKey, TResult>>,
    private options: {
      batchDelay?: number;
      maxBatchSize?: number;
      cacheOptions?: ApiCacheOptions;
      keySerializer?: (key: TKey) => string;
    } = {}
  ) {}

  async get(key: TKey): Promise<TResult | null> {
    const cacheKey = this.getCacheKey(key);
    
    // Check cache first
    const cached = await apiCache.get<TResult>(cacheKey, this.options.cacheOptions);
    if (cached !== null) {
      return cached;
    }

    // Check if already in batch queue
    const queued = this.batchQueue.get(key);
    if (queued) {
      return queued;
    }

    // Add to batch queue
    const promise = this.scheduleBatch(key);
    this.batchQueue.set(key, promise);
    
    return promise;
  }

  private async scheduleBatch(key: TKey): Promise<TResult> {
    return new Promise((resolve, reject) => {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      this.batchTimeout = setTimeout(async () => {
        await this.executeBatch();
      }, this.options.batchDelay || 50);

      // Store resolver for later
      const existing = this.batchQueue.get(key);
      if (existing) {
        existing.then(resolve).catch(reject);
      }
    });
  }

  private async executeBatch(): Promise<void> {
    const keys = Array.from(this.batchQueue.keys());
    if (keys.length === 0) return;

    try {
      const results = await this.batchFunction(keys);
      
      // Cache and resolve results
      for (const [key, result] of results) {
        const cacheKey = this.getCacheKey(key);
        await apiCache.set(cacheKey, result, this.options.cacheOptions);
        
        const promise = this.batchQueue.get(key);
        if (promise) {
          (promise as any).resolve(result);
        }
      }
    } catch (error) {
      // Reject all pending promises
      for (const [key, promise] of this.batchQueue) {
        (promise as any).reject(error);
      }
    } finally {
      this.batchQueue.clear();
      this.batchTimeout = null;
    }
  }

  private getCacheKey(key: TKey): string {
    if (this.options.keySerializer) {
      return `batch:${this.options.keySerializer(key)}`;
    }
    return `batch:${JSON.stringify(key)}`;
  }
}

/**
 * Cache HTTP responses with ETags
 */
export async function fetchWithCache(
  url: string,
  options: RequestInit & ApiCacheOptions = {}
): Promise<Response> {
  const {
    ttl,
    storage,
    skipCache,
    forceRefresh,
    ...fetchOptions
  } = options;

  const cacheKey = `http:${url}`;

  if (!skipCache && !forceRefresh) {
    const cached = await apiCache.get<CachedResponse<any>>(cacheKey, { storage });
    
    if (cached && cached.etag) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'If-None-Match': cached.etag
      };
    }
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 304 && !skipCache) {
    // Not modified, return cached data
    const cached = await apiCache.get<CachedResponse<any>>(cacheKey, { storage });
    if (cached) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: cached.headers
      });
    }
  }

  if (response.ok && !skipCache) {
    const data = await response.json();
    const etag = response.headers.get('ETag');
    
    await apiCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      etag: etag || undefined,
      headers: Object.fromEntries(response.headers.entries())
    }, { ttl, storage });

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: response.headers
    });
  }

  return response;
}