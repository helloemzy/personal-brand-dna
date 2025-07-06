# Workshop Persistence Fix Plan

## Current Status
Workshop persistence is **temporarily disabled** to prevent crashes. The workshop works but doesn't save progress across refreshes.

## Root Cause
The workshop state was being persisted at multiple levels, causing serialization conflicts and corrupted state with nested `_persist` metadata.

## Permanent Fix Implementation

### Step 1: Update Workshop Slice
In `src/store/slices/workshopSlice.ts`, add state migrations:

```typescript
// Add migrations to handle corrupted state
const migrations = {
  0: (state: any) => {
    // Clean up any corrupted state from version 0
    return {
      ...initialState,
      values: {
        selected: Array.isArray(state?.values?.selected) ? state.values.selected : [],
        custom: Array.isArray(state?.values?.custom) ? state.values.custom : [],
        rankings: state?.values?.rankings || {}
      },
      completedSteps: Array.isArray(state?.completedSteps) ? state.completedSteps : [],
      currentStep: state?.currentStep || 1
    };
  }
};

// Update the persist config to include migrations
export const workshopPersistConfig = {
  key: 'workshop',
  storage,
  version: 1, // Increment this to trigger migration
  migrate: createMigrate(migrations, { debug: true }),
  whitelist: ['values', 'tonePreferences', 'audiencePersonas', 'completedSteps', 'currentStep'],
  blacklist: ['isSaving', 'lastError']
};
```

### Step 2: Fix Store Configuration
In `src/store/index.ts`, ensure workshop is only persisted once:

```typescript
import { workshopPersistConfig } from './persistConfig';
import workshopSlice from './slices/workshopSlice';

// Apply persistence at slice level only
const persistedWorkshopReducer = persistReducer(workshopPersistConfig, workshopSlice);

const rootReducer = combineReducers({
  auth: authSlice,
  workshop: persistedWorkshopReducer, // Use persisted version
  // ... other reducers
});

// Update root persist config to exclude workshop
export const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'userPreferences', 'contentDrafts'],
  blacklist: ['workshop', 'ui', 'loading'], // Exclude workshop from root
};
```

### Step 3: Add State Validation Middleware
Create `src/store/middleware/stateValidator.ts`:

```typescript
export const workshopStateValidator: Middleware = store => next => action => {
  const result = next(action);
  
  if (action.type.startsWith('workshop/')) {
    const state = store.getState();
    const workshop = state.workshop;
    
    // Validate state structure
    if (workshop && typeof workshop === 'object') {
      const isValid = 
        Array.isArray(workshop.values?.selected) &&
        Array.isArray(workshop.values?.custom) &&
        typeof workshop.values?.rankings === 'object' &&
        typeof workshop.currentStep === 'number';
      
      if (!isValid) {
        console.error('Invalid workshop state detected:', workshop);
        // Dispatch action to reset state if needed
        store.dispatch(resetWorkshop());
      }
    }
  }
  
  return result;
};
```

### Step 4: Re-enable Persistence
In `src/config/performance.ts`:

```typescript
export const REDUX_PERSIST_CONFIG = {
  persistKeys: [
    'auth',
    'workshop', // Re-enable after fixes
    'userPreferences',
    'contentDrafts',
  ],
  // ...
};
```

### Step 5: Add E2E Tests
Create `tests/workshop.e2e.test.ts`:

```typescript
describe('Workshop Flow', () => {
  beforeEach(() => {
    cy.visit('/?reset=true'); // Start fresh
    cy.login(); // Custom command to login
  });

  it('should handle value selection without crashing', () => {
    cy.visit('/brand-house');
    
    // Select 10 values
    for (let i = 0; i < 10; i++) {
      cy.get('[data-testid="value-card"]').eq(i).click();
      cy.wait(100); // Small delay between selections
    }
    
    // Should not crash
    cy.get('[data-testid="selected-count"]').should('contain', '10');
    
    // Try to select 11th value (should be prevented)
    cy.get('[data-testid="value-card"]').eq(10).click();
    cy.get('[data-testid="selected-count"]').should('contain', '10');
  });

  it('should persist values across refreshes', () => {
    cy.visit('/brand-house');
    
    // Select some values
    cy.get('[data-testid="value-card"]').first().click();
    cy.get('[data-testid="value-card"]').eq(1).click();
    
    // Refresh page
    cy.reload();
    
    // Values should still be selected
    cy.get('[data-testid="selected-count"]').should('contain', '2');
  });
});
```

## Testing Plan

1. **Local Testing**
   - Clear all localStorage
   - Apply the fixes above
   - Test workshop flow thoroughly
   - Verify persistence works

2. **Staging Testing**
   - Deploy to staging environment
   - Test with multiple browsers
   - Test with slow connections
   - Test with large amounts of data

3. **Production Rollout**
   - Enable for 10% of users first
   - Monitor error rates
   - Gradually increase to 100%

## Monitoring

Add these metrics to track:
- Workshop completion rate
- Error rate by step
- State corruption incidents
- localStorage size distribution

## Rollback Plan

If issues occur after re-enabling persistence:
1. Set `REDUX_PERSIST_CONFIG.persistKeys` to exclude 'workshop'
2. Deploy immediately
3. Users will lose saved progress but can continue working