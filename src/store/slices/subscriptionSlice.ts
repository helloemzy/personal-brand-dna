import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SubscriptionPlan {
  id: string;
  name: 'free' | 'professional' | 'executive' | 'enterprise';
  displayName: string;
  price: number;
  currency: 'USD';
  interval: 'month' | 'year';
  features: string[];
  limits: {
    postsPerMonth: number | 'unlimited';
    voiceProfiles: number;
    analyticsRetention: number; // days
    supportLevel: 'email' | 'priority' | 'dedicated';
  };
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  metadata?: Record<string, any>;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: 'USD';
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  invoiceDate: string;
  dueDate: string;
  paidAt?: string;
  invoiceUrl: string;
  description: string;
}

export interface UsageStats {
  postsGenerated: number;
  postsLimit: number | 'unlimited';
  voiceProfilesUsed: number;
  voiceProfilesLimit: number;
  analyticsDataRetention: number;
  resetDate: string;
}

export interface SubscriptionState {
  currentSubscription: Subscription | null;
  currentPlan: SubscriptionPlan | null;
  availablePlans: SubscriptionPlan[];
  invoices: Invoice[];
  usageStats: UsageStats | null;
  paymentMethods: any[];
  isLoading: boolean;
  error: string | null;
  billingPortalUrl: string | null;
}

const initialState: SubscriptionState = {
  currentSubscription: null,
  currentPlan: null,
  availablePlans: [],
  invoices: [],
  usageStats: null,
  paymentMethods: [],
  isLoading: false,
  error: null,
  billingPortalUrl: null,
};

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    setSubscriptionLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setSubscriptionError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    setCurrentSubscription: (state, action: PayloadAction<Subscription | null>) => {
      state.currentSubscription = action.payload;
    },
    
    setCurrentPlan: (state, action: PayloadAction<SubscriptionPlan | null>) => {
      state.currentPlan = action.payload;
    },
    
    setAvailablePlans: (state, action: PayloadAction<SubscriptionPlan[]>) => {
      state.availablePlans = action.payload;
    },
    
    setInvoices: (state, action: PayloadAction<Invoice[]>) => {
      state.invoices = action.payload;
    },
    
    addInvoice: (state, action: PayloadAction<Invoice>) => {
      state.invoices.unshift(action.payload);
    },
    
    updateInvoice: (state, action: PayloadAction<{ id: string; updates: Partial<Invoice> }>) => {
      const index = state.invoices.findIndex(invoice => invoice.id === action.payload.id);
      if (index !== -1 && state.invoices[index]) {
        Object.assign(state.invoices[index], action.payload.updates);
      }
    },
    
    setUsageStats: (state, action: PayloadAction<UsageStats>) => {
      state.usageStats = action.payload;
    },
    
    updateUsageStats: (state, action: PayloadAction<Partial<UsageStats>>) => {
      if (state.usageStats) {
        state.usageStats = { ...state.usageStats, ...action.payload };
      }
    },
    
    incrementPostsGenerated: (state) => {
      if (state.usageStats) {
        state.usageStats.postsGenerated += 1;
      }
    },
    
    setPaymentMethods: (state, action: PayloadAction<any[]>) => {
      state.paymentMethods = action.payload;
    },
    
    addPaymentMethod: (state, action: PayloadAction<any>) => {
      state.paymentMethods.push(action.payload);
    },
    
    removePaymentMethod: (state, action: PayloadAction<string>) => {
      state.paymentMethods = state.paymentMethods.filter(
        method => method.id !== action.payload
      );
    },
    
    setBillingPortalUrl: (state, action: PayloadAction<string | null>) => {
      state.billingPortalUrl = action.payload;
    },
    
    updateSubscriptionStatus: (state, action: PayloadAction<Subscription['status']>) => {
      if (state.currentSubscription) {
        state.currentSubscription.status = action.payload;
      }
    },
    
    scheduleCancellation: (state) => {
      if (state.currentSubscription) {
        state.currentSubscription.cancelAtPeriodEnd = true;
      }
    },
    
    reactivateSubscription: (state) => {
      if (state.currentSubscription) {
        state.currentSubscription.cancelAtPeriodEnd = false;
      }
    },
    
    clearSubscriptionData: () => {
      return initialState;
    },
  },
});

export const {
  setSubscriptionLoading,
  setSubscriptionError,
  setCurrentSubscription,
  setCurrentPlan,
  setAvailablePlans,
  setInvoices,
  addInvoice,
  updateInvoice,
  setUsageStats,
  updateUsageStats,
  incrementPostsGenerated,
  setPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setBillingPortalUrl,
  updateSubscriptionStatus,
  scheduleCancellation,
  reactivateSubscription,
  clearSubscriptionData,
} = subscriptionSlice.actions;

// Selectors
export const selectCurrentSubscription = (state: { subscription: SubscriptionState }) => 
  state.subscription.currentSubscription;
export const selectCurrentPlan = (state: { subscription: SubscriptionState }) => 
  state.subscription.currentPlan;
export const selectAvailablePlans = (state: { subscription: SubscriptionState }) => 
  state.subscription.availablePlans;
export const selectInvoices = (state: { subscription: SubscriptionState }) => 
  state.subscription.invoices;
export const selectUsageStats = (state: { subscription: SubscriptionState }) => 
  state.subscription.usageStats;
export const selectPaymentMethods = (state: { subscription: SubscriptionState }) => 
  state.subscription.paymentMethods;
export const selectSubscriptionLoading = (state: { subscription: SubscriptionState }) => 
  state.subscription.isLoading;
export const selectSubscriptionError = (state: { subscription: SubscriptionState }) => 
  state.subscription.error;
export const selectBillingPortalUrl = (state: { subscription: SubscriptionState }) => 
  state.subscription.billingPortalUrl;

export default subscriptionSlice.reducer;