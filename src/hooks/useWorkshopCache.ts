import { useEffect, useCallback, useRef } from 'react';
import { useAppSelector, useAppDispatch } from './redux';
import { 
  selectWorkshopState, 
  loadWorkshopState,
  updateWorkshopMeta 
} from '../store/slices/workshopSlice';
import { selectUser } from '../store/slices/authSlice';
import { workshopCache } from '../services/cacheService';
import { workshopPersistence } from '../services/workshopPersistenceService';
import { performanceMonitor } from '../utils/performanceMonitor';
import { debounce } from '../utils/debounce';

interface WorkshopCacheOptions {
  enableAutoSave?: boolean;
  saveDebounceMs?: number;
  enableOfflineSync?: boolean;
  cacheStrategy?: 'memory' | 'localStorage' | 'hybrid';
}

export const useWorkshopCache = (options: WorkshopCacheOptions = {}) => {
  const {
    enableAutoSave = true,
    saveDebounceMs = 2000,
    enableOfflineSync = true,
    cacheStrategy = 'hybrid'
  } = options;

  const dispatch = useAppDispatch();
  const workshopState = useAppSelector(selectWorkshopState);
  const user = useAppSelector(selectUser);
  
  const lastSavedStateRef = useRef<string>('');
  const saveQueueRef = useRef<Array<() => Promise<void>>>([]);
  const isOnlineRef = useRef(navigator.onLine);

  /**
   * Get cache key for current user and session
   */
  const getCacheKey = useCallback(() => {
    const userId = user?.id || 'anonymous';
    const sessionId = workshopState.sessionId || 'default';
    return `workshop:${userId}:${sessionId}`;
  }, [user?.id, workshopState.sessionId]);

  /**
   * Save workshop state to cache
   */
  const saveToCache = useCallback(async () => {
    if (!workshopState) return;

    const cacheKey = getCacheKey();
    const stateString = JSON.stringify(workshopState);
    
    // Skip if state hasn't changed
    if (stateString === lastSavedStateRef.current) {
      return;
    }

    try {
      await performanceMonitor.measureAsync('workshop-cache-save', async () => {
        // Save to memory cache for fast access
        await workshopCache.set(cacheKey, workshopState, {
          storage: 'memory',
          ttl: 5 * 60 * 1000 // 5 minutes
        });

        // Save to localStorage for persistence
        if (cacheStrategy === 'localStorage' || cacheStrategy === 'hybrid') {
          await workshopCache.set(cacheKey, workshopState, {
            storage: 'localStorage',
            ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
          });
        }

        lastSavedStateRef.current = stateString;
      });

      // Update last saved timestamp
      dispatch(updateWorkshopMeta({ lastSavedAt: new Date().toISOString() }));

    } catch (error) {
      console.error('Failed to save workshop to cache:', error);
    }
  }, [workshopState, getCacheKey, cacheStrategy, dispatch]);

  /**
   * Load workshop state from cache
   */
  const loadFromCache = useCallback(async () => {
    const cacheKey = getCacheKey();

    try {
      return await performanceMonitor.measureAsync('workshop-cache-load', async () => {
        // Try memory cache first
        let cachedState = await workshopCache.get(cacheKey, { storage: 'memory' });
        
        // Fall back to localStorage
        if (!cachedState && (cacheStrategy === 'localStorage' || cacheStrategy === 'hybrid')) {
          cachedState = await workshopCache.get(cacheKey, { storage: 'localStorage' });
          
          // Populate memory cache if found in localStorage
          if (cachedState) {
            await workshopCache.set(cacheKey, cachedState, {
              storage: 'memory',
              ttl: 5 * 60 * 1000
            });
          }
        }

        return cachedState;
      });
    } catch (error) {
      console.error('Failed to load workshop from cache:', error);
      return null;
    }
  }, [getCacheKey, cacheStrategy]);

  /**
   * Sync cache with remote storage
   */
  const syncWithRemote = useCallback(async () => {
    if (!isOnlineRef.current || !user) return;

    try {
      await performanceMonitor.measureAsync('workshop-cache-sync', async () => {
        // Get local cache
        const localState = await loadFromCache();
        if (!localState) return;

        // Get remote state
        const persistence = workshopPersistence.getInstance();
        const remoteState = await persistence.load(user.id);

        // Compare timestamps and merge
        if (remoteState && localState) {
          const localTime = new Date(localState.lastSavedAt || 0).getTime();
          const remoteTime = new Date(remoteState.lastSavedAt || 0).getTime();

          if (remoteTime > localTime) {
            // Remote is newer, update local
            await saveToCache();
            dispatch(loadWorkshopState(remoteState));
          } else if (localTime > remoteTime) {
            // Local is newer, update remote
            await persistence.save(localState);
          }
        } else if (localState && !remoteState) {
          // Only local exists, push to remote
          await persistence.save(localState);
        }
      });
    } catch (error) {
      console.error('Failed to sync cache with remote:', error);
    }
  }, [user, loadFromCache, saveToCache, dispatch]);

  /**
   * Clear workshop cache
   */
  const clearCache = useCallback(async () => {
    const cacheKey = getCacheKey();
    
    await workshopCache.remove(cacheKey, { storage: 'memory' });
    await workshopCache.remove(cacheKey, { storage: 'localStorage' });
    
    lastSavedStateRef.current = '';
  }, [getCacheKey]);

  /**
   * Prefetch related data
   */
  const prefetchRelatedData = useCallback(async () => {
    if (!workshopState.isCompleted) return;

    try {
      // Prefetch archetype data
      const archetypeKey = `archetype:${workshopState.values.selected.join(',')}`;
      const cachedArchetype = await workshopCache.get(archetypeKey, { storage: 'memory' });
      
      if (!cachedArchetype) {
        // In a real app, this would fetch from API
        // For now, we'll just mark it for prefetching
        console.log('Prefetching archetype data...');
      }

      // Prefetch content pillars
      const pillarsKey = `pillars:${user?.id}:${workshopState.sessionId}`;
      const cachedPillars = await workshopCache.get(pillarsKey, { storage: 'memory' });
      
      if (!cachedPillars) {
        console.log('Prefetching content pillars...');
      }
    } catch (error) {
      console.error('Failed to prefetch related data:', error);
    }
  }, [workshopState, user]);

  // Debounced save function
  const debouncedSave = useRef(
    debounce(saveToCache, saveDebounceMs)
  ).current;

  // Auto-save on state changes
  useEffect(() => {
    if (enableAutoSave && workshopState) {
      debouncedSave();
    }
  }, [workshopState, enableAutoSave, debouncedSave]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      
      if (enableOfflineSync) {
        // Process queued saves
        saveQueueRef.current.forEach(save => save());
        saveQueueRef.current = [];
        
        // Sync with remote
        syncWithRemote();
      }
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableOfflineSync, syncWithRemote]);

  // Load from cache on mount
  useEffect(() => {
    const initializeCache = async () => {
      const cachedState = await loadFromCache();
      
      if (cachedState && !workshopState.currentStep) {
        dispatch(loadWorkshopState(cachedState));
      }
    };

    initializeCache();
  }, []);

  // Prefetch related data when workshop is completed
  useEffect(() => {
    if (workshopState.isCompleted) {
      prefetchRelatedData();
    }
  }, [workshopState.isCompleted, prefetchRelatedData]);

  return {
    saveToCache,
    loadFromCache,
    clearCache,
    syncWithRemote,
    isOnline: isOnlineRef.current,
    cacheStats: workshopCache.getStats()
  };
};

// Hook for caching individual workshop sections
export const useWorkshopSectionCache = (section: string) => {
  const user = useAppSelector(selectUser);
  const userId = user?.id || 'anonymous';
  
  const getCacheKey = useCallback((key: string) => {
    return `workshop:${userId}:${section}:${key}`;
  }, [userId, section]);

  const cacheData = useCallback(async <T>(key: string, data: T, ttl?: number) => {
    const cacheKey = getCacheKey(key);
    
    await workshopCache.set(cacheKey, data, {
      storage: 'hybrid' as any,
      ttl: ttl || 10 * 60 * 1000 // 10 minutes default
    });
  }, [getCacheKey]);

  const getCachedData = useCallback(async <T>(key: string): Promise<T | null> => {
    const cacheKey = getCacheKey(key);
    
    return await workshopCache.get<T>(cacheKey, {
      storage: 'hybrid' as any
    });
  }, [getCacheKey]);

  const invalidateSection = useCallback(async () => {
    await workshopCache.invalidateByPattern(`workshop:${userId}:${section}:.*`);
  }, [userId, section]);

  return {
    cacheData,
    getCachedData,
    invalidateSection
  };
};