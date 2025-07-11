# Secure Token Storage Implementation Plan

## Overview
This document outlines the plan to migrate from localStorage-based JWT storage to httpOnly cookies, addressing the current XSS vulnerability where tokens can be stolen if an XSS attack occurs.

## Current Implementation Issues
- **Location**: `src/store/slices/authSlice.ts` (lines 47-48)
- **Issue**: JWT tokens stored in localStorage
- **Risk**: Tokens accessible via JavaScript, vulnerable to XSS attacks
- **Current Code**:
```typescript
localStorage.setItem('token', response.data.accessToken);
localStorage.setItem('refreshToken', response.data.refreshToken);
```

## Proposed Solution: HttpOnly Cookies

### Benefits
1. **XSS Protection**: Cookies with httpOnly flag cannot be accessed via JavaScript
2. **CSRF Protection**: Can be combined with SameSite attribute
3. **Automatic Handling**: Browser automatically includes cookies in requests
4. **Secure Flag**: Ensures cookies only sent over HTTPS

### Implementation Requirements

## Phase 1: Backend Changes

### 1.1 API Endpoint Modifications
```typescript
// backend/src/api/auth.js modifications needed

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  // ... authentication logic ...
  
  // Set access token as httpOnly cookie
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/'
  });
  
  // Set refresh token as httpOnly cookie
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh'
  });
  
  // Return success without tokens in body
  res.json({ 
    success: true,
    user: userData // user info without sensitive tokens
  });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ success: true });
});

// Refresh endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }
  
  // Verify and generate new tokens
  // Set new cookies...
});
```

### 1.2 Middleware Updates
```typescript
// backend/src/middleware/auth.js
export const authenticateToken = (req, res, next) => {
  const token = req.cookies.access_token;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

### 1.3 CORS Configuration
```typescript
// backend/src/index.js
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Cookie parser middleware
app.use(cookieParser());
```

## Phase 2: Frontend Changes

### 2.1 Axios Configuration
```typescript
// src/services/axiosConfig.ts
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true, // Include cookies in requests
  headers: {
    'Content-Type': 'application/json'
  }
});

// Remove Authorization header logic since cookies handle auth
export default axiosInstance;
```

### 2.2 Auth Slice Updates
```typescript
// src/store/slices/authSlice.ts
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      // Only store user info, not tokens
      state.user = action.payload.user;
      state.isAuthenticated = true;
      // Remove localStorage token storage
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      // Remove localStorage token clearing
    }
  }
});

// Update login thunk
export const login = createAsyncThunk(
  'auth/login',
  async (credentials) => {
    const response = await axiosInstance.post('/api/auth/login', credentials);
    // Cookies are automatically set by browser
    return response.data;
  }
);

// Update logout thunk
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    await axiosInstance.post('/api/auth/logout');
    // Cookies are automatically cleared
  }
);
```

### 2.3 API Service Updates
Remove token from headers in all API calls:
```typescript
// Before
const config = {
  headers: { Authorization: `Bearer ${token}` }
};

// After - cookies automatically included
const response = await axiosInstance.get('/api/protected-route');
```

### 2.4 Token Refresh Logic
```typescript
// src/services/authService.ts
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Refresh token via cookie
        await axiosInstance.post('/api/auth/refresh');
        // Retry original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Redirect to login
        store.dispatch(clearAuth());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

## Phase 3: Supabase Integration Considerations

### 3.1 Hybrid Approach
Since Supabase uses its own auth system, we need a hybrid approach:

1. **Supabase Auth**: Continue using for OAuth providers
2. **Custom Cookies**: For our JWT tokens after Supabase auth

```typescript
// src/pages/auth/AuthCallbackPage.tsx
const handleSupabaseCallback = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    // Exchange Supabase session for our httpOnly cookies
    await axiosInstance.post('/api/auth/supabase-exchange', {
      supabaseToken: session.access_token
    });
    // Our backend sets httpOnly cookies
  }
};
```

### 3.2 Backend Supabase Verification
```typescript
// backend/src/api/auth.js
app.post('/api/auth/supabase-exchange', async (req, res) => {
  const { supabaseToken } = req.body;
  
  // Verify Supabase token
  const { data: user, error } = await supabase.auth.getUser(supabaseToken);
  
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid Supabase token' });
  }
  
  // Generate our JWT tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  // Set httpOnly cookies
  res.cookie('access_token', accessToken, cookieOptions);
  res.cookie('refresh_token', refreshToken, refreshCookieOptions);
  
  res.json({ success: true, user });
});
```

## Phase 4: Security Enhancements

### 4.1 CSRF Protection
```typescript
// backend/src/middleware/csrf.js
import csrf from 'csurf';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Apply to state-changing routes
app.post('/api/*', csrfProtection);
app.put('/api/*', csrfProtection);
app.delete('/api/*', csrfProtection);
```

### 4.2 Additional Security Headers
```typescript
// backend/src/middleware/security.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Phase 5: Testing & Migration

### 5.1 Testing Strategy
1. **Unit Tests**: Test cookie setting/clearing logic
2. **Integration Tests**: Test full auth flow with cookies
3. **Security Tests**: Verify XSS protection and CSRF protection
4. **Browser Tests**: Test across different browsers

### 5.2 Migration Steps
1. **Deploy Backend Changes**: With backward compatibility
2. **Feature Flag**: Toggle between localStorage and cookie auth
3. **Gradual Rollout**: Test with internal users first
4. **Monitor**: Watch for auth issues
5. **Complete Migration**: Remove localStorage code

### 5.3 Rollback Plan
1. Keep localStorage code behind feature flag
2. Quick toggle if issues arise
3. Dual support during transition period

## Implementation Checklist

### Backend Tasks
- [ ] Install cookie-parser middleware
- [ ] Update CORS configuration for credentials
- [ ] Modify login endpoint to set httpOnly cookies
- [ ] Modify logout endpoint to clear cookies
- [ ] Create token refresh endpoint
- [ ] Update auth middleware to read from cookies
- [ ] Add CSRF protection
- [ ] Add security headers
- [ ] Create Supabase token exchange endpoint
- [ ] Test all auth endpoints

### Frontend Tasks
- [ ] Configure axios for credentials
- [ ] Remove localStorage token storage
- [ ] Update auth slice reducers
- [ ] Update login/logout thunks
- [ ] Remove Authorization headers from API calls
- [ ] Implement token refresh interceptor
- [ ] Update Supabase callback handling
- [ ] Test all authenticated routes
- [ ] Update error handling for 401s

### Testing Tasks
- [ ] Write unit tests for cookie auth
- [ ] Write integration tests for full flow
- [ ] Test XSS protection
- [ ] Test CSRF protection
- [ ] Cross-browser testing
- [ ] Load testing with cookies
- [ ] Security audit

### Deployment Tasks
- [ ] Create feature flag
- [ ] Deploy backend with backward compatibility
- [ ] Deploy frontend with feature flag
- [ ] Monitor auth metrics
- [ ] Gradual rollout
- [ ] Remove old localStorage code

## Estimated Timeline
- **Planning & Design**: 1 day ✅ (This document)
- **Backend Implementation**: 2-3 days
- **Frontend Implementation**: 2-3 days
- **Testing**: 2 days
- **Deployment & Migration**: 1-2 days
- **Total**: 8-12 days

## Risks & Mitigations
1. **Risk**: Cookie size limitations
   - **Mitigation**: Store only essential data in JWT
   
2. **Risk**: Browser compatibility issues
   - **Mitigation**: Test across browsers, provide fallback
   
3. **Risk**: Supabase integration complexity
   - **Mitigation**: Hybrid approach with token exchange
   
4. **Risk**: User sessions disrupted during migration
   - **Mitigation**: Dual support during transition

## Alternative Approaches Considered

### 1. Token Encryption in localStorage
- **Pros**: Easier to implement, no backend changes
- **Cons**: Still vulnerable to XSS if encryption key exposed

### 2. Session Storage
- **Pros**: Cleared on tab close
- **Cons**: Still accessible via JavaScript

### 3. Service Worker Storage
- **Pros**: More secure than localStorage
- **Cons**: Complex implementation, browser support

## Recommendation
Proceed with httpOnly cookie implementation despite complexity, as it provides the best security against XSS attacks. The investment in proper implementation will significantly improve the application's security posture.