/**
 * Form validation utilities for consistent validation across the app
 */

import { logger } from './logger';

// Validation rules
export const VALIDATION_RULES = {
  // Text length limits
  CUSTOM_VALUE_MAX_LENGTH: 50,
  WRITING_SAMPLE_MAX_WORDS: 500,
  WRITING_SAMPLE_MIN_WORDS: 50,
  AUDIENCE_PERSONA_NAME_MAX: 100,
  AUDIENCE_DESCRIPTION_MAX: 300,
  VALUE_STORY_MAX_LENGTH: 500,
  
  // Numeric limits
  MIN_VALUES_SELECTED: 3,
  MAX_VALUES_SELECTED: 10,
  MIN_PRIMARY_VALUES: 2,
  MAX_PRIMARY_VALUES: 3,
  MIN_ASPIRATIONAL_VALUES: 1,
  MAX_ASPIRATIONAL_VALUES: 2,
  MIN_AUDIENCE_PERSONAS: 1,
  MAX_AUDIENCE_PERSONAS: 3,
  
  // Patterns
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL_PATTERN: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  PHONE_PATTERN: /^\+?[\d\s-()]+$/,
};

// Validation error messages
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  TOO_SHORT: 'This field is too short',
  TOO_LONG: 'This field is too long',
  INVALID_FORMAT: 'Invalid format',
  MIN_SELECTION: 'Please select at least {min} items',
  MAX_SELECTION: 'You can select up to {max} items',
  WORD_COUNT: 'Please write between {min} and {max} words',
  CHAR_COUNT: 'Maximum {max} characters allowed',
};

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validates a custom value name
 */
export function validateCustomValue(value: string): ValidationResult {
  const trimmed = value.trim();
  
  if (!trimmed) {
    return {
      isValid: false,
      error: VALIDATION_MESSAGES.REQUIRED,
    };
  }
  
  if (trimmed.length > VALIDATION_RULES.CUSTOM_VALUE_MAX_LENGTH) {
    return {
      isValid: false,
      error: VALIDATION_MESSAGES.CHAR_COUNT.replace('{max}', VALIDATION_RULES.CUSTOM_VALUE_MAX_LENGTH.toString()),
    };
  }
  
  // Check for inappropriate content
  const inappropriate = /\b(hate|violence|discrimination)\b/i.test(trimmed);
  if (inappropriate) {
    return {
      isValid: false,
      error: 'Please use appropriate language',
    };
  }
  
  return { isValid: true };
}

/**
 * Validates writing sample word count
 */
export function validateWritingSample(text: string): ValidationResult {
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  
  if (wordCount < VALIDATION_RULES.WRITING_SAMPLE_MIN_WORDS) {
    return {
      isValid: false,
      error: VALIDATION_MESSAGES.WORD_COUNT
        .replace('{min}', VALIDATION_RULES.WRITING_SAMPLE_MIN_WORDS.toString())
        .replace('{max}', VALIDATION_RULES.WRITING_SAMPLE_MAX_WORDS.toString()),
    };
  }
  
  if (wordCount > VALIDATION_RULES.WRITING_SAMPLE_MAX_WORDS) {
    return {
      isValid: false,
      error: VALIDATION_MESSAGES.WORD_COUNT
        .replace('{min}', VALIDATION_RULES.WRITING_SAMPLE_MIN_WORDS.toString())
        .replace('{max}', VALIDATION_RULES.WRITING_SAMPLE_MAX_WORDS.toString()),
    };
  }
  
  return { isValid: true };
}

/**
 * Validates audience persona fields
 */
export function validateAudiencePersona(persona: {
  name: string;
  description: string;
  challenges?: string;
  transformation?: string;
}): ValidationResult {
  const errors: string[] = [];
  
  // Validate name
  if (!persona.name.trim()) {
    errors.push('Name is required');
  } else if (persona.name.length > VALIDATION_RULES.AUDIENCE_PERSONA_NAME_MAX) {
    errors.push(`Name must be less than ${VALIDATION_RULES.AUDIENCE_PERSONA_NAME_MAX} characters`);
  }
  
  // Validate description
  if (!persona.description.trim()) {
    errors.push('Description is required');
  } else if (persona.description.length > VALIDATION_RULES.AUDIENCE_DESCRIPTION_MAX) {
    errors.push(`Description must be less than ${VALIDATION_RULES.AUDIENCE_DESCRIPTION_MAX} characters`);
  }
  
  // Validate transformation (if provided)
  if (persona.transformation && persona.transformation.length > VALIDATION_RULES.AUDIENCE_DESCRIPTION_MAX) {
    errors.push(`Transformation must be less than ${VALIDATION_RULES.AUDIENCE_DESCRIPTION_MAX} characters`);
  }
  
  return {
    isValid: errors.length === 0,
    error: errors[0],
    warnings: errors.slice(1),
  };
}

/**
 * Validates value selection requirements
 */
export function validateValueSelection(selectedValues: string[], step: 'initial' | 'primary' | 'aspirational'): ValidationResult {
  const count = selectedValues.length;
  
  switch (step) {
    case 'initial':
      if (count < VALIDATION_RULES.MIN_VALUES_SELECTED) {
        return {
          isValid: false,
          error: VALIDATION_MESSAGES.MIN_SELECTION.replace('{min}', VALIDATION_RULES.MIN_VALUES_SELECTED.toString()),
        };
      }
      if (count > VALIDATION_RULES.MAX_VALUES_SELECTED) {
        return {
          isValid: false,
          error: VALIDATION_MESSAGES.MAX_SELECTION.replace('{max}', VALIDATION_RULES.MAX_VALUES_SELECTED.toString()),
        };
      }
      break;
      
    case 'primary':
      if (count < VALIDATION_RULES.MIN_PRIMARY_VALUES) {
        return {
          isValid: false,
          error: `Please select exactly ${VALIDATION_RULES.MIN_PRIMARY_VALUES} primary values`,
        };
      }
      if (count > VALIDATION_RULES.MAX_PRIMARY_VALUES) {
        return {
          isValid: false,
          error: `Please select exactly ${VALIDATION_RULES.MIN_PRIMARY_VALUES} primary values`,
        };
      }
      break;
      
    case 'aspirational':
      if (count < VALIDATION_RULES.MIN_ASPIRATIONAL_VALUES) {
        return {
          isValid: false,
          error: `Please select at least ${VALIDATION_RULES.MIN_ASPIRATIONAL_VALUES} aspirational value`,
        };
      }
      if (count > VALIDATION_RULES.MAX_ASPIRATIONAL_VALUES) {
        return {
          isValid: false,
          error: `Please select up to ${VALIDATION_RULES.MAX_ASPIRATIONAL_VALUES} aspirational values`,
        };
      }
      break;
  }
  
  return { isValid: true };
}

/**
 * Real-time validation hook helper
 */
export function createValidator<T>(
  validateFn: (value: T) => ValidationResult
): {
  validate: (value: T) => ValidationResult;
  validateWithDebounce: (value: T, callback: (result: ValidationResult) => void, delay?: number) => void;
} {
  let debounceTimer: NodeJS.Timeout;
  
  return {
    validate: validateFn,
    validateWithDebounce: (value: T, callback: (result: ValidationResult) => void, delay = 300) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const result = validateFn(value);
        callback(result);
      }, delay);
    },
  };
}

/**
 * Character/word counter utility
 */
export function getTextMetrics(text: string): {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
} {
  const trimmed = text.trim();
  
  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words: trimmed ? trimmed.split(/\s+/).filter(word => word.length > 0).length : 0,
    lines: trimmed ? trimmed.split(/\n/).length : 0,
  };
}

/**
 * Format validation error for display
 */
export function formatValidationError(error: string, fieldName?: string): string {
  if (fieldName) {
    return `${fieldName}: ${error}`;
  }
  return error;
}

/**
 * Validate all required fields in a form
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): ValidationResult {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return !value || (typeof value === 'string' && !value.trim());
  });
  
  if (missingFields.length > 0) {
    return {
      isValid: false,
      error: `Please fill in required fields: ${missingFields.join(', ')}`,
    };
  }
  
  return { isValid: true };
}

/**
 * Sanitize form input
 */
export function sanitizeInput(input: string, options?: {
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  removeExtraSpaces?: boolean;
  maxLength?: number;
}): string {
  let sanitized = input;
  
  const opts = {
    trim: true,
    removeExtraSpaces: true,
    ...options,
  };
  
  if (opts.trim) {
    sanitized = sanitized.trim();
  }
  
  if (opts.removeExtraSpaces) {
    sanitized = sanitized.replace(/\s+/g, ' ');
  }
  
  if (opts.lowercase) {
    sanitized = sanitized.toLowerCase();
  }
  
  if (opts.uppercase) {
    sanitized = sanitized.toUpperCase();
  }
  
  if (opts.maxLength && sanitized.length > opts.maxLength) {
    sanitized = sanitized.substring(0, opts.maxLength);
  }
  
  return sanitized;
}