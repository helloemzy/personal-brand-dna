import authReducer, {
  AuthState,
  User,
  clearError,
  updateUser,
  setCredentials,
  clearAuth,
} from './authSlice';

describe('authSlice', () => {
  const initialState: AuthState = {
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };

  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    industry: 'Technology',
    role: 'Software Engineer',
    company: 'Test Co',
    subscriptionTier: 'professional',
    subscriptionStatus: 'active',
    isVerified: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  const mockCredentials = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: mockUser,
  };

  test('should handle initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('authentication actions', () => {
    test('should handle setCredentials', () => {
      const actual = authReducer(
        initialState,
        setCredentials(mockCredentials)
      );
      expect(actual.isAuthenticated).toBe(true);
      expect(actual.user).toEqual(mockUser);
      expect(actual.token).toEqual('mock-access-token');
      expect(actual.refreshToken).toEqual('mock-refresh-token');
      expect(actual.isLoading).toBe(false);
      expect(actual.error).toBeNull();
    });

    test('should handle clearAuth', () => {
      const authenticatedState = {
        ...initialState,
        user: mockUser,
        token: 'mock-token',
        refreshToken: 'mock-refresh',
        isAuthenticated: true,
      };
      const actual = authReducer(authenticatedState, clearAuth());
      expect(actual.isAuthenticated).toBe(false);
      expect(actual.user).toBeNull();
      expect(actual.token).toBeNull();
      expect(actual.refreshToken).toBeNull();
    });
  });

  describe('error actions', () => {
    test('should handle clearError', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error',
      };
      const actual = authReducer(stateWithError, clearError());
      expect(actual.error).toBeNull();
    });
  });

  describe('user actions', () => {
    test('should handle updateUser', () => {
      const authenticatedState = {
        ...initialState,
        user: mockUser,
        isAuthenticated: true,
      };
      const updates = { name: 'Updated Name', email: 'new@example.com' };
      const actual = authReducer(authenticatedState, updateUser(updates));
      expect(actual.user).toEqual({
        ...mockUser,
        ...updates,
      });
    });

    test('should not update user when not authenticated', () => {
      const updates = { name: 'Updated Name' };
      const actual = authReducer(initialState, updateUser(updates));
      expect(actual.user).toBeNull();
    });
  });

  // Note: Async thunks like loginUser, registerUser, etc. would need
  // to be tested with mock store and async testing utilities
});