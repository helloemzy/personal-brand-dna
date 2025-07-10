/**
 * Cache Service
 * Provides unified caching interface with multiple storage backends
 */

import { performanceMonitor } from '../utils/performanceMonitor';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  compress?: boolean;
  encrypt?: boolean;
  namespace?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version?: string;
  checksum?: string;
}

class CacheService {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private namespace: string;
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes
  private maxMemoryCacheSize: number = 100; // Maximum items in memory
  
  constructor(namespace: string = 'brandpillar') {
    this.namespace = namespace;
    this.initializeCleanup();
  }

  /**
   * Get data from cache
   */
  async get<T>(
    key: string, 
    options: CacheOptions = {}
  ): Promise<T | null> {
    const { storage = 'memory' } = options;
    const fullKey = this.getFullKey(key, options.namespace);
    
    return performanceMonitor.measureAsync(`cache-get-${storage}`, async () => {
      switch (storage) {
        case 'memory':
          return this.getFromMemory<T>(fullKey);
        case 'localStorage':
          return this.getFromLocalStorage<T>(fullKey);
        case 'sessionStorage':
          return this.getFromSessionStorage<T>(fullKey);
        case 'indexedDB':
          return this.getFromIndexedDB<T>(fullKey);
        default:
          return null;
      }
    });
  }

  /**
   * Set data in cache
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const { 
      ttl = this.defaultTTL, 
      storage = 'memory',
      compress = false,
      encrypt = false
    } = options;
    
    const fullKey = this.getFullKey(key, options.namespace);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: this.getVersion()
    };

    return performanceMonitor.measureAsync(`cache-set-${storage}`, async () => {
      let processedData = data;
      
      if (compress && storage !== 'memory') {
        processedData = await this.compress(data);
      }
      
      if (encrypt && storage !== 'memory') {
        processedData = await this.encrypt(processedData);
      }
      
      entry.data = processedData as T;
      
      switch (storage) {
        case 'memory':
          this.setInMemory(fullKey, entry);
          break;
        case 'localStorage':
          this.setInLocalStorage(fullKey, entry);
          break;
        case 'sessionStorage':
          this.setInSessionStorage(fullKey, entry);
          break;
        case 'indexedDB':
          await this.setInIndexedDB(fullKey, entry);
          break;
      }
    });
  }

  /**
   * Remove data from cache
   */
  async remove(key: string, options: CacheOptions = {}): Promise<void> {
    const { storage = 'memory' } = options;
    const fullKey = this.getFullKey(key, options.namespace);
    
    switch (storage) {
      case 'memory':
        this.memoryCache.delete(fullKey);
        break;
      case 'localStorage':
        localStorage.removeItem(fullKey);
        break;
      case 'sessionStorage':
        sessionStorage.removeItem(fullKey);
        break;
      case 'indexedDB':
        await this.removeFromIndexedDB(fullKey);
        break;
    }
  }

  /**
   * Clear all cache data
   */
  async clear(options: { storage?: CacheOptions['storage'] } = {}): Promise<void> {
    const { storage } = options;
    
    if (!storage || storage === 'memory') {
      this.memoryCache.clear();
    }
    
    if (!storage || storage === 'localStorage') {
      this.clearStorage(localStorage);
    }
    
    if (!storage || storage === 'sessionStorage') {
      this.clearStorage(sessionStorage);
    }
    
    if (!storage || storage === 'indexedDB') {
      await this.clearIndexedDB();
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }
    
    const data = await factory();
    await this.set(key, data, options);
    
    return data;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string | RegExp, options: CacheOptions = {}): Promise<void> {
    const { storage = 'memory' } = options;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    switch (storage) {
      case 'memory':
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        }
        break;
      case 'localStorage':
      case 'sessionStorage':
        const storageObj = storage === 'localStorage' ? localStorage : sessionStorage;
        const keys = Object.keys(storageObj);
        keys.forEach(key => {
          if (regex.test(key)) {
            storageObj.removeItem(key);
          }
        });
        break;
      case 'indexedDB':
        await this.invalidateIndexedDBByPattern(regex);
        break;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    localStorageSize: number;
    sessionStorageSize: number;
    totalKeys: number;
  } {
    return {
      memorySize: this.memoryCache.size,
      localStorageSize: this.getStorageSize(localStorage),
      sessionStorageSize: this.getStorageSize(sessionStorage),
      totalKeys: this.getTotalKeys()
    };
  }

  // Private methods

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (this.isExpired(entry)) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setInMemory<T>(key: string, entry: CacheEntry<T>): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }
    
    this.memoryCache.set(key, entry);
  }

  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const entry: CacheEntry<T> = JSON.parse(item);
      
      if (this.isExpired(entry)) {
        localStorage.removeItem(key);
        return null;
      }
      
      return entry.data;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  private setInLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      // Handle quota exceeded error
      if (error instanceof DOMException && error.code === 22) {
        this.evictOldestFromStorage(localStorage);
        // Retry once
        try {
          localStorage.setItem(key, JSON.stringify(entry));
        } catch {
          console.error('Failed to save to localStorage after eviction');
        }
      }
    }
  }

  private getFromSessionStorage<T>(key: string): T | null {
    try {
      const item = sessionStorage.getItem(key);
      if (!item) return null;
      
      const entry: CacheEntry<T> = JSON.parse(item);
      
      if (this.isExpired(entry)) {
        sessionStorage.removeItem(key);
        return null;
      }
      
      return entry.data;
    } catch (error) {
      console.error('Error reading from sessionStorage:', error);
      return null;
    }
  }

  private setInSessionStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        this.evictOldestFromStorage(sessionStorage);
        try {
          sessionStorage.setItem(key, JSON.stringify(entry));
        } catch {
          console.error('Failed to save to sessionStorage after eviction');
        }
      }
    }
  }

  private async getFromIndexedDB<T>(key: string): Promise<T | null> {
    // Implement IndexedDB logic
    // This is a placeholder - actual implementation would use IndexedDB API
    return null;
  }

  private async setInIndexedDB<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Implement IndexedDB logic
    // This is a placeholder - actual implementation would use IndexedDB API
  }

  private async removeFromIndexedDB(key: string): Promise<void> {
    // Implement IndexedDB logic
  }

  private async clearIndexedDB(): Promise<void> {
    // Implement IndexedDB logic
  }

  private async invalidateIndexedDBByPattern(regex: RegExp): Promise<void> {
    // Implement IndexedDB logic
  }

  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace || this.namespace;
    return `${ns}:${key}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.timestamp + entry.ttl;
  }

  private getVersion(): string {
    // Could be tied to app version or deployment
    return '1.0.0';
  }

  private async compress(data: any): Promise<any> {
    // Implement compression logic (e.g., using pako)
    return data;
  }

  private async encrypt(data: any): Promise<any> {
    // Implement encryption logic
    return data;
  }

  private clearStorage(storage: Storage): void {
    const keys = Object.keys(storage);
    keys.forEach(key => {
      if (key.startsWith(this.namespace)) {
        storage.removeItem(key);
      }
    });
  }

  private evictOldestFromStorage(storage: Storage): void {
    const items: Array<{ key: string; timestamp: number }> = [];
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.namespace)) {
        try {
          const item = storage.getItem(key);
          if (item) {
            const entry = JSON.parse(item);
            items.push({ key, timestamp: entry.timestamp });
          }
        } catch {}
      }
    }
    
    // Sort by timestamp and remove oldest 25%
    items.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = Math.max(1, Math.floor(items.length * 0.25));
    
    for (let i = 0; i < toRemove; i++) {
      storage.removeItem(items[i].key);
    }
  }

  private getStorageSize(storage: Storage): number {
    let size = 0;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.namespace)) {
        size++;
      }
    }
    return size;
  }

  private getTotalKeys(): number {
    return this.memoryCache.size + 
           this.getStorageSize(localStorage) + 
           this.getStorageSize(sessionStorage);
  }

  private initializeCleanup(): void {
    // Run cleanup every minute
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private cleanup(): void {
    // Clean up expired entries in memory
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }
    
    // Clean up expired entries in localStorage
    this.cleanupStorage(localStorage);
    
    // Clean up expired entries in sessionStorage
    this.cleanupStorage(sessionStorage);
  }

  private cleanupStorage(storage: Storage): void {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.namespace)) {
        try {
          const item = storage.getItem(key);
          if (item) {
            const entry = JSON.parse(item);
            if (this.isExpired(entry)) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Remove corrupted entries
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => storage.removeItem(key));
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export specific cache instances for different domains
export const workshopCache = new CacheService('workshop');
export const contentCache = new CacheService('content');
export const analyticsCache = new CacheService('analytics');
export const apiCache = new CacheService('api');