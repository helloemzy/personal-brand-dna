import CryptoJS from 'crypto-js';

// Configuration
const SIGNATURE_HEADER = 'x-signature';
const TIMESTAMP_HEADER = 'x-timestamp';

interface SignedHeaders {
  [SIGNATURE_HEADER]: string;
  [TIMESTAMP_HEADER]: string;
}

/**
 * Generate HMAC signature for API requests
 */
export const generateSignature = (
  method: string,
  path: string,
  timestamp: string,
  body: any,
  secret: string
): string => {
  const payload = [
    method.toUpperCase(),
    path,
    timestamp,
    body ? JSON.stringify(body) : ''
  ].join('\n');
  
  return CryptoJS.HmacSHA256(payload, secret).toString();
};

/**
 * Sign a request with HMAC signature
 */
export const signRequest = (
  method: string,
  path: string,
  body: any,
  secret: string
): SignedHeaders => {
  const timestamp = Date.now().toString();
  const signature = generateSignature(method, path, timestamp, body, secret);
  
  return {
    [SIGNATURE_HEADER]: signature,
    [TIMESTAMP_HEADER]: timestamp
  };
};

/**
 * Axios request interceptor to automatically sign requests
 */
export const createSigningInterceptor = (secret: string, paths: string[] = []) => {
  return (config: any) => {
    // Only sign requests to specified paths
    if (paths.length > 0 && !paths.some(path => config.url?.startsWith(path))) {
      return config;
    }
    
    // Extract method and path
    const method = config.method || 'GET';
    const url = new URL(config.url, window.location.origin);
    const path = url.pathname + url.search;
    
    // Sign the request
    const signedHeaders = signRequest(
      method,
      path,
      config.data,
      secret
    );
    
    // Add signed headers
    config.headers = {
      ...config.headers,
      ...signedHeaders
    };
    
    return config;
  };
};

/**
 * Hook to use request signing in React components
 */
export const useRequestSigning = (secret?: string) => {
  const signingSecret = secret || process.env.REACT_APP_API_SIGNING_SECRET || '';
  
  const signApiRequest = (method: string, path: string, body?: any) => {
    if (!signingSecret) {
      console.warn('No API signing secret configured');
      return {};
    }
    
    return signRequest(method, path, body, signingSecret);
  };
  
  return { signApiRequest, signRequest };
};

// Critical endpoints that should always be signed
export const CRITICAL_ENDPOINTS = [
  '/api/auth/change-password',
  '/api/auth/delete-account',
  '/api/payments',
  '/api/workshop/delete',
  '/api/user/delete',
  '/api/admin'
];

/**
 * Check if an endpoint is critical and requires signing
 */
export const isCriticalEndpoint = (path: string): boolean => {
  return CRITICAL_ENDPOINTS.some(endpoint => path.startsWith(endpoint));
};

export default {
  generateSignature,
  signRequest,
  createSigningInterceptor,
  useRequestSigning,
  isCriticalEndpoint,
  CRITICAL_ENDPOINTS
};