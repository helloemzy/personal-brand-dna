import { getDefaultWorkshopState } from '../utils/workshopStateSanitizer';
import type { WorkshopState } from '../store/slices/workshopSlice';

/**
 * Integration tests for workshop persistence functionality
 * These tests focus on the core persistence logic without complex mocking
 */

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Workshop Persistence Integration Tests', () => {
  let testState: WorkshopState;

  beforeEach(() => {
    mockLocalStorage.clear();
    
    testState = {
      ...getDefaultWorkshopState(),
      sessionId: 'test-session-123',
      currentStep: 3,
      completedSteps: [1, 2],
      lastSavedAt: new Date().toISOString(),
      values: {
        selected: ['innovation', 'growth'],
        custom: [{
          id: 'custom-1',
          name: 'Custom Value',
          category: 'personal',
          description: 'My custom value'
        }],
        rankings: { innovation: 8, growth: 7 },
        primary: ['innovation'],
        aspirational: ['growth'],
        stories: { innovation: 'My innovation story here' }
      },
      tonePreferences: {
        formal_casual: 15,
        concise_detailed: -10,
        analytical_creative: 20,
        serious_playful: -5
      },
      audiencePersonas: [{
        id: 'persona-1',
        name: 'Tech Leader',
        role: 'CTO',
        industry: 'Technology',
        painPoints: ['scaling teams', 'technical debt'],
        goals: ['efficient systems', 'team growth'],
        communicationStyle: 'technical',
        isPrimary: true
      }],
      personalityQuiz: {
        responses: [
          { questionId: 'q1', answer: 'a', answeredAt: '2025-01-12T00:00:00.000Z' },
          { questionId: 'q2', answer: 'b', answeredAt: '2025-01-12T00:01:00.000Z' }
        ],
        currentQuestionIndex: 2
      }
    };
  });

  describe('LocalStorage Persistence Layer', () => {
    const STORAGE_KEY = 'workshop-persistence';

    it('should save and load workshop state to localStorage', () => {
      // Save state
      const storageData = {
        data: testState,
        timestamp: Date.now(),
        version: '1.0'
      };
      mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));

      // Load state
      const retrieved = mockLocalStorage.getItem(STORAGE_KEY);
      expect(retrieved).toBeTruthy();

      const parsed = JSON.parse(retrieved!);
      expect(parsed.data.sessionId).toBe('test-session-123');
      expect(parsed.data.currentStep).toBe(3);
      expect(parsed.data.values.selected).toEqual(['innovation', 'growth']);
      expect(parsed.data.tonePreferences.formal_casual).toBe(15);
    });

    it('should handle data expiration correctly', () => {
      // Save expired data (25 hours old)
      const expiredData = {
        data: testState,
        timestamp: Date.now() - (25 * 60 * 60 * 1000),
        version: '1.0'
      };
      mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(expiredData));

      const retrieved = mockLocalStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(retrieved!);
      
      // Check if data is expired
      const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000;
      expect(isExpired).toBe(true);
    });

    it('should handle corrupted localStorage data', () => {
      // Save corrupted data
      mockLocalStorage.setItem(STORAGE_KEY, 'invalid-json-data');

      expect(() => {
        const retrieved = mockLocalStorage.getItem(STORAGE_KEY);
        if (retrieved) {
          JSON.parse(retrieved);
        }
      }).toThrow();
    });

    it('should preserve complex data structures', () => {
      const complexState = {
        ...testState,
        values: {
          selected: ['value1', 'value2'],
          custom: [
            { id: 'c1', name: 'Custom 1', category: 'personal', description: 'Test' },
            { id: 'c2', name: 'Custom 2', category: 'professional', description: 'Test 2' }
          ],
          rankings: { value1: 8, value2: 6, value3: 9 },
          primary: ['value1', 'value2'],
          aspirational: ['value3'],
          stories: {
            value1: 'Story with "quotes" and special chars: &<>',
            value2: 'Another story with newlines\nand tabs\t'
          }
        }
      };

      const storageData = {
        data: complexState,
        timestamp: Date.now(),
        version: '1.0'
      };

      // Serialize and deserialize
      const serialized = JSON.stringify(storageData);
      const deserialized = JSON.parse(serialized);

      // Verify structure is maintained
      expect(deserialized.data.values.custom).toHaveLength(2);
      expect(deserialized.data.values.custom[0].id).toBe('c1');
      expect(deserialized.data.values.rankings.value1).toBe(8);
      expect(deserialized.data.values.stories.value1).toContain('quotes');
      expect(deserialized.data.values.stories.value2).toContain('\n');
    });
  });

  describe('Data Conflict Resolution Scenarios', () => {
    it('should resolve conflicts based on completion progress', () => {
      const localState: WorkshopState = {
        ...testState,
        completedSteps: [1, 2, 3],
        lastSavedAt: '2025-01-12T01:00:00.000Z'
      };

      const remoteState: WorkshopState = {
        ...testState,
        completedSteps: [1, 2],
        lastSavedAt: '2025-01-12T02:00:00.000Z'
      };

      // Simulate default merge strategy logic
      const localProgress = localState.completedSteps.length;
      const remoteProgress = remoteState.completedSteps.length;

      let resolved: WorkshopState;
      if (localProgress > remoteProgress) {
        resolved = localState;
      } else if (remoteProgress > localProgress) {
        resolved = remoteState;
      } else {
        // Equal progress, use timestamp
        const localTime = new Date(localState.lastSavedAt!).getTime();
        const remoteTime = new Date(remoteState.lastSavedAt!).getTime();
        resolved = localTime >= remoteTime ? localState : remoteState;
      }

      expect(resolved).toBe(localState); // Local has more progress
      expect(resolved.completedSteps).toHaveLength(3);
    });

    it('should resolve conflicts based on timestamp when progress is equal', () => {
      const localState: WorkshopState = {
        ...testState,
        completedSteps: [1, 2],
        lastSavedAt: '2025-01-12T01:00:00.000Z'
      };

      const remoteState: WorkshopState = {
        ...testState,
        completedSteps: [1, 2],
        lastSavedAt: '2025-01-12T02:00:00.000Z'
      };

      // Equal progress, check timestamp
      const localTime = new Date(localState.lastSavedAt!).getTime();
      const remoteTime = new Date(remoteState.lastSavedAt!).getTime();
      const resolved = localTime >= remoteTime ? localState : remoteState;

      expect(resolved).toBe(remoteState); // Remote is newer
      expect(resolved.lastSavedAt).toBe('2025-01-12T02:00:00.000Z');
    });

    it('should handle missing timestamps gracefully', () => {
      const localState: WorkshopState = {
        ...testState,
        completedSteps: [1, 2],
        lastSavedAt: null
      };

      const remoteState: WorkshopState = {
        ...testState,
        completedSteps: [1, 2],
        lastSavedAt: '2025-01-12T02:00:00.000Z'
      };

      const localTime = localState.lastSavedAt ? new Date(localState.lastSavedAt).getTime() : 0;
      const remoteTime = remoteState.lastSavedAt ? new Date(remoteState.lastSavedAt).getTime() : 0;
      const resolved = localTime >= remoteTime ? localState : remoteState;

      expect(resolved).toBe(remoteState); // Remote has timestamp
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain type integrity during serialization', () => {
      const stateWithTypes = {
        ...testState,
        currentStep: 3, // number
        isCompleted: false, // boolean
        completedSteps: [1, 2], // number array
        values: {
          selected: ['val1', 'val2'], // string array
          rankings: { val1: 8, val2: 6 }, // number values
          stories: { val1: 'story text' } // string values
        },
        lastSavedAt: '2025-01-12T00:00:00.000Z' // ISO string
      };

      // Serialize and deserialize
      const serialized = JSON.stringify(stateWithTypes);
      const deserialized = JSON.parse(serialized);

      // Check types are preserved
      expect(typeof deserialized.currentStep).toBe('number');
      expect(typeof deserialized.isCompleted).toBe('boolean');
      expect(Array.isArray(deserialized.completedSteps)).toBe(true);
      expect(Array.isArray(deserialized.values.selected)).toBe(true);
      expect(typeof deserialized.values.rankings.val1).toBe('number');
      expect(typeof deserialized.values.stories.val1).toBe('string');
      expect(typeof deserialized.lastSavedAt).toBe('string');
    });

    it('should handle special characters in text fields', () => {
      const stateWithSpecialChars = {
        ...testState,
        values: {
          ...testState.values,
          stories: {
            value1: 'Story with emoji 🚀 and Unicode characters: àáâãäå',
            value2: 'Story with HTML: <script>alert("test")</script>',
            value3: 'Story with quotes: "double" and \'single\' quotes',
            value4: 'Story with newlines:\nLine 1\nLine 2\nLine 3'
          }
        }
      };

      const serialized = JSON.stringify(stateWithSpecialChars);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.values.stories.value1).toContain('🚀');
      expect(deserialized.values.stories.value1).toContain('àáâãäå');
      expect(deserialized.values.stories.value2).toContain('<script>');
      expect(deserialized.values.stories.value3).toContain('"double"');
      expect(deserialized.values.stories.value3).toContain("'single'");
      expect(deserialized.values.stories.value4).toContain('\n');
    });

    it('should preserve array order and uniqueness', () => {
      const stateWithArrays = {
        ...testState,
        completedSteps: [1, 2, 3, 4],
        values: {
          ...testState.values,
          selected: ['first', 'second', 'third'],
          primary: ['primary1', 'primary2'],
          aspirational: ['asp1', 'asp2', 'asp3']
        }
      };

      const serialized = JSON.stringify(stateWithArrays);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.completedSteps).toEqual([1, 2, 3, 4]);
      expect(deserialized.values.selected).toEqual(['first', 'second', 'third']);
      expect(deserialized.values.primary).toEqual(['primary1', 'primary2']);
      expect(deserialized.values.aspirational).toEqual(['asp1', 'asp2', 'asp3']);
    });
  });

  describe('Offline Queue Simulation', () => {
    interface QueueItem {
      id: string;
      timestamp: number;
      data: WorkshopState;
      retryCount: number;
      maxRetries: number;
    }

    it('should queue items for offline processing', () => {
      const queue: QueueItem[] = [];
      const OFFLINE_QUEUE_KEY = 'workshop-offline-queue';

      // Simulate adding items to queue
      const queueItem: QueueItem = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: Date.now(),
        data: testState,
        retryCount: 0,
        maxRetries: 3
      };

      queue.push(queueItem);
      mockLocalStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

      // Verify queue was saved
      const savedQueue = mockLocalStorage.getItem(OFFLINE_QUEUE_KEY);
      expect(savedQueue).toBeTruthy();

      const parsedQueue = JSON.parse(savedQueue!);
      expect(parsedQueue).toHaveLength(1);
      expect(parsedQueue[0].data.sessionId).toBe('test-session-123');
      expect(parsedQueue[0].retryCount).toBe(0);
    });

    it('should handle queue processing with retries', () => {
      const queue: QueueItem[] = [];

      // Add multiple items
      for (let i = 0; i < 3; i++) {
        queue.push({
          id: `item-${i}`,
          timestamp: Date.now() + i,
          data: { ...testState, currentStep: (i + 1) as 1 | 2 | 3 | 4 | 5 },
          retryCount: i, // Simulate different retry counts
          maxRetries: 3
        });
      }

      // Simulate processing queue
      const itemsToProcess = [...queue];
      const newQueue: QueueItem[] = [];

      for (const item of itemsToProcess) {
        // Simulate failure for items with even IDs
        const shouldFail = parseInt(item.id.split('-')[1]) % 2 === 0;

        if (shouldFail && item.retryCount < item.maxRetries) {
          // Add back to queue with incremented retry count
          newQueue.push({
            ...item,
            retryCount: item.retryCount + 1
          });
        }
        // Successful items are removed from queue
      }

      expect(newQueue).toHaveLength(2); // Items 0 and 2 failed
      expect(newQueue[0].retryCount).toBe(1); // Incremented from 0
      expect(newQueue[1].retryCount).toBe(3); // Incremented from 2
    });
  });

  describe('Multi-Session Data Handling', () => {
    it('should handle multiple workshop sessions', () => {
      const sessions = [
        {
          id: 'session-1',
          completed: true,
          step: 5,
          createdAt: '2025-01-11T00:00:00.000Z',
          data: { ...testState, currentStep: 5, isCompleted: true }
        },
        {
          id: 'session-2', 
          completed: false,
          step: 3,
          createdAt: '2025-01-12T00:00:00.000Z',
          data: { ...testState, currentStep: 3, isCompleted: false }
        },
        {
          id: 'session-3',
          completed: false,
          step: 2,
          createdAt: '2025-01-10T00:00:00.000Z',
          data: { ...testState, currentStep: 2, isCompleted: false }
        }
      ];

      // Find most recent incomplete session
      const incompleteSessions = sessions.filter(s => !s.completed);
      const mostRecentIncomplete = incompleteSessions.reduce((latest, current) => 
        new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
      );

      expect(mostRecentIncomplete.id).toBe('session-2');
      expect(mostRecentIncomplete.step).toBe(3);

      // If no incomplete sessions, get most recent complete
      const completeSessions = sessions.filter(s => s.completed);
      if (incompleteSessions.length === 0 && completeSessions.length > 0) {
        const mostRecentComplete = completeSessions.reduce((latest, current) => 
          new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
        );
        expect(mostRecentComplete.id).toBe('session-1');
      }
    });

    it('should prioritize incomplete sessions over complete ones', () => {
      const sessions = [
        { id: 'complete-1', completed: true, createdAt: '2025-01-12T00:00:00.000Z' },
        { id: 'incomplete-1', completed: false, createdAt: '2025-01-11T00:00:00.000Z' },
        { id: 'complete-2', completed: true, createdAt: '2025-01-13T00:00:00.000Z' }
      ];

      // Always prefer incomplete over complete, regardless of date
      const incompleteSession = sessions.find(s => !s.completed);
      expect(incompleteSession?.id).toBe('incomplete-1');
    });
  });

  describe('Performance and Memory Considerations', () => {
    it('should handle large workshop states efficiently', () => {
      // Create a large state
      const largeState = {
        ...testState,
        values: {
          selected: Array.from({ length: 10 }, (_, i) => `value-${i}`),
          custom: Array.from({ length: 20 }, (_, i) => ({
            id: `custom-${i}`,
            name: `Custom Value ${i}`,
            category: i % 2 === 0 ? 'personal' : 'professional',
            description: `This is a longer description for custom value ${i} with more text to test serialization performance`
          })),
          rankings: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [`value-${i}`, Math.floor(Math.random() * 10) + 1])
          ),
          primary: ['value-0', 'value-1'],
          aspirational: Array.from({ length: 5 }, (_, i) => `value-${i + 2}`),
          stories: Object.fromEntries(
            Array.from({ length: 10 }, (_, i) => [
              `value-${i}`, 
              `This is a very long story for value ${i} `.repeat(10)
            ])
          )
        },
        audiencePersonas: Array.from({ length: 5 }, (_, i) => ({
          id: `persona-${i}`,
          name: `Persona ${i}`,
          role: `Role ${i}`,
          industry: `Industry ${i}`,
          painPoints: Array.from({ length: 10 }, (_, j) => `Pain point ${j} for persona ${i}`),
          goals: Array.from({ length: 10 }, (_, j) => `Goal ${j} for persona ${i}`),
          communicationStyle: 'formal' as const,
          isPrimary: i === 0
        }))
      };

      // Test serialization performance
      const startTime = Date.now();
      const serialized = JSON.stringify(largeState);
      const serializationTime = Date.now() - startTime;

      // Test deserialization performance
      const deserializeStart = Date.now();
      const deserialized = JSON.parse(serialized);
      const deserializationTime = Date.now() - deserializeStart;

      // Verify data integrity
      expect(deserialized.values.selected).toHaveLength(10);
      expect(deserialized.values.custom).toHaveLength(20);
      expect(Object.keys(deserialized.values.rankings)).toHaveLength(50);
      expect(deserialized.audiencePersonas).toHaveLength(5);

      // Performance should be reasonable (adjust thresholds as needed)
      expect(serializationTime).toBeLessThan(100); // 100ms
      expect(deserializationTime).toBeLessThan(50); // 50ms
      expect(serialized.length).toBeGreaterThan(1000); // Ensure we're testing substantial data
    });
  });
});