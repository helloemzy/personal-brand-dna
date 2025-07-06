/**
 * Redux DevTools configuration utilities
 */

// Disable Redux DevTools in production and when it causes issues
export const configureReduxDevTools = () => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Check if Redux DevTools Extension is available
  const devToolsExtension = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
  
  if (!devToolsExtension) {
    return false;
  }

  // Return configuration object for Redux DevTools
  return {
    // Limit the number of actions stored
    maxAge: 50,
    
    // Serialize options to handle non-serializable data
    serialize: {
      options: {
        undefined: true,
        function: false,
        symbol: false,
        date: true,
        error: true,
        regex: true,
        map: true,
        set: true,
      },
      // Custom replacer to handle complex objects
      replacer: (key: string, value: any) => {
        // Handle _persist from redux-persist
        if (key === '_persist') {
          return '[Redux Persist]';
        }
        
        // Handle functions
        if (typeof value === 'function') {
          return '[Function]';
        }
        
        // Handle undefined
        if (value === undefined) {
          return '[undefined]';
        }
        
        return value;
      },
    },
    
    // Actions to filter out from DevTools
    actionsBlacklist: [
      'persist/PERSIST',
      'persist/REHYDRATE',
      'persist/PURGE',
    ],
    
    // Features to enable
    features: {
      pause: true,
      lock: true,
      persist: true,
      export: true,
      import: 'custom',
      jump: true,
      skip: true,
      reorder: true,
      dispatch: true,
      test: true,
    },
    
    // Prevent DevTools from breaking the app
    shouldCatchErrors: true,
  };
};

// Helper to safely log Redux actions in development
export const logReduxAction = (action: any, prevState: any, nextState: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`Redux Action: ${action.type}`);
    console.log('Payload:', action.payload);
    console.log('Previous State:', prevState);
    console.log('Next State:', nextState);
    console.groupEnd();
  }
};