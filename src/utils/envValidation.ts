/**
 * Environment variable validation utility
 * Ensures all required environment variables are set before app startup
 */

import { logger } from './logger';

interface RequiredEnvVar {
  name: string;
  description: string;
  required: boolean;
  productionOnly?: boolean;
  defaultValue?: string;
}

const REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  {
    name: 'REACT_APP_SUPABASE_URL',
    description: 'Supabase project URL',
    required: true,
  },
  {
    name: 'REACT_APP_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key',
    required: true,
  },
  {
    name: 'REACT_APP_GOOGLE_CLIENT_ID',
    description: 'Google OAuth client ID',
    required: true,
  },
  {
    name: 'REACT_APP_API_URL',
    description: 'Backend API URL',
    required: true,
    defaultValue: process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : undefined,
  },
  {
    name: 'REACT_APP_WEBSOCKET_URL',
    description: 'WebSocket server URL',
    required: false,
    productionOnly: true,
  },
  {
    name: 'REACT_APP_SENTRY_DSN',
    description: 'Sentry error tracking DSN',
    required: false,
    productionOnly: true,
  },
  {
    name: 'REACT_APP_GA_MEASUREMENT_ID',
    description: 'Google Analytics measurement ID',
    required: false,
    productionOnly: true,
  },
];

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

/**
 * Validates that all required environment variables are set
 * @throws {EnvironmentError} if required variables are missing
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  REQUIRED_ENV_VARS.forEach((envVar) => {
    const value = process.env[envVar.name];
    
    // Skip production-only checks in development
    if (envVar.productionOnly && !isProduction) {
      return;
    }
    
    // Check if required variable is missing
    if (envVar.required && !value && !envVar.defaultValue) {
      errors.push(`Missing required environment variable: ${envVar.name} - ${envVar.description}`);
    }
    
    // Warn about missing optional variables in production
    if (!envVar.required && !value && isProduction) {
      warnings.push(`Missing optional environment variable: ${envVar.name} - ${envVar.description}`);
    }
    
    // Validate format of certain variables
    if (value) {
      validateFormat(envVar.name, value, errors);
    }
  });

  // Log warnings
  warnings.forEach(warning => logger.warn(warning));

  // Throw error if any required variables are missing
  if (errors.length > 0) {
    const errorMessage = `
Environment Configuration Error:

${errors.join('\n')}

Please set these environment variables in your .env file or deployment configuration.
    `.trim();
    
    throw new EnvironmentError(errorMessage);
  }

  logger.info('Environment validation passed');
}

/**
 * Validates the format of specific environment variables
 */
function validateFormat(name: string, value: string, errors: string[]): void {
  switch (name) {
    case 'REACT_APP_SUPABASE_URL':
      if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
        errors.push(`Invalid Supabase URL format: ${name}`);
      }
      break;
      
    case 'REACT_APP_API_URL':
    case 'REACT_APP_WEBSOCKET_URL':
      try {
        new URL(value);
      } catch {
        errors.push(`Invalid URL format for ${name}: ${value}`);
      }
      break;
      
    case 'REACT_APP_GOOGLE_CLIENT_ID':
      if (!value.endsWith('.apps.googleusercontent.com')) {
        errors.push(`Invalid Google Client ID format: ${name}`);
      }
      break;
  }
}

/**
 * Gets an environment variable with optional default value
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  
  if (!value && !defaultValue) {
    throw new EnvironmentError(`Environment variable ${name} is not set`);
  }
  
  return value || defaultValue || '';
}

/**
 * Gets a required environment variable
 * @throws {EnvironmentError} if variable is not set
 */
export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  
  if (!value) {
    throw new EnvironmentError(`Required environment variable ${name} is not set`);
  }
  
  return value;
}

/**
 * Checks if app is running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Checks if app is running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Gets the current environment name
 */
export function getEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}