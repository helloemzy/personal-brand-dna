import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  activeModal: string | null;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    duration?: number;
    timestamp: string;
  }>;
  loading: {
    global: boolean;
    components: Record<string, boolean>;
  };
  preferences: {
    autoSave: boolean;
    emailNotifications: boolean;
    desktopNotifications: boolean;
    analyticsSharing: boolean;
  };
}

const initialState: UIState = {
  theme: 'light',
  sidebarCollapsed: false,
  activeModal: null,
  notifications: [],
  loading: {
    global: false,
    components: {},
  },
  preferences: {
    autoSave: true,
    emailNotifications: true,
    desktopNotifications: false,
    analyticsSharing: true,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<UIState['theme']>) => {
      state.theme = action.payload;
    },
    
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    
    openModal: (state, action: PayloadAction<string>) => {
      state.activeModal = action.payload;
    },
    
    closeModal: (state) => {
      state.activeModal = null;
    },
    
    addNotification: (state, action: PayloadAction<Omit<UIState['notifications'][0], 'id' | 'timestamp'>>) => {
      const notification = {
        ...action.payload,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
      };
      state.notifications.push(notification);
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    
    clearNotifications: (state) => {
      state.notifications = [];
    },
    
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    
    setComponentLoading: (state, action: PayloadAction<{ component: string; loading: boolean }>) => {
      state.loading.components[action.payload.component] = action.payload.loading;
    },
    
    clearComponentLoading: (state, action: PayloadAction<string>) => {
      delete state.loading.components[action.payload];
    },
    
    updatePreferences: (state, action: PayloadAction<Partial<UIState['preferences']>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
    },
    
    resetUI: (state) => {
      return {
        ...initialState,
        theme: state.theme, // Preserve theme setting
        preferences: state.preferences, // Preserve user preferences
      };
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebarCollapsed,
  openModal,
  closeModal,
  addNotification,
  removeNotification,
  clearNotifications,
  setGlobalLoading,
  setComponentLoading,
  clearComponentLoading,
  updatePreferences,
  resetUI,
} = uiSlice.actions;

// Selectors
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectSidebarCollapsed = (state: { ui: UIState }) => state.ui.sidebarCollapsed;
export const selectActiveModal = (state: { ui: UIState }) => state.ui.activeModal;
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;
export const selectGlobalLoading = (state: { ui: UIState }) => state.ui.loading.global;
export const selectComponentLoading = (component: string) => (state: { ui: UIState }) => 
  state.ui.loading.components[component] || false;
export const selectPreferences = (state: { ui: UIState }) => state.ui.preferences;

export default uiSlice.reducer;