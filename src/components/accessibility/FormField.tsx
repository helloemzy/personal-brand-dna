/**
 * Accessible Form Field Components
 * Provides consistent accessible form patterns
 */

import React, { forwardRef } from 'react';
import { focusVisible } from '../../utils/accessibility';
import { useFieldAccessibility } from '../../hooks/useAccessibility';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  error,
  description,
  required,
  className = '',
  children
}) => {
  const { fieldProps, errorId, descriptionId } = useFieldAccessibility(id, {
    error,
    description,
    required
  });
  
  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={id} 
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span className="ml-1 text-red-500" aria-label="required">*</span>
        )}
      </label>
      
      {description && (
        <p id={descriptionId} className="text-sm text-gray-500">
          {description}
        </p>
      )}
      
      {React.cloneElement(children, {
        id,
        ...fieldProps,
        className: `${children.props.className || ''} ${focusVisible}`
      })}
      
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  description?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, description, id, required, className = '', ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <FormField
        id={inputId}
        label={label}
        error={error}
        description={description}
        required={required}
      >
        <input
          ref={ref}
          type="text"
          className={`block w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${
            error ? 'border-red-300' : ''
          } ${className}`}
          {...props}
        />
      </FormField>
    );
  }
);

TextInput.displayName = 'TextInput';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  description?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, description, id, required, className = '', ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <FormField
        id={textareaId}
        label={label}
        error={error}
        description={description}
        required={required}
      >
        <textarea
          ref={ref}
          className={`block w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${
            error ? 'border-red-300' : ''
          } ${className}`}
          {...props}
        />
      </FormField>
    );
  }
);

TextArea.displayName = 'TextArea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  description?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, description, id, required, options, className = '', ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <FormField
        id={selectId}
        label={label}
        error={error}
        description={description}
        required={required}
      >
        <select
          ref={ref}
          className={`block w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${
            error ? 'border-red-300' : ''
          } ${className}`}
          {...props}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
);

Select.displayName = 'Select';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, description, id, className = '', ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    const { fieldProps, errorId, descriptionId } = useFieldAccessibility(checkboxId, {
      error,
      description
    });
    
    return (
      <div className={`relative flex items-start ${className}`}>
        <div className="flex h-5 items-center">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className={`h-4 w-4 rounded border-gray-300 text-blue-600 ${focusVisible}`}
            {...fieldProps}
            {...props}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={checkboxId} className="font-medium text-gray-700">
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="text-gray-500">
              {description}
            </p>
          )}
          {error && (
            <p id={errorId} className="text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

interface RadioGroupProps {
  label: string;
  name: string;
  options: Array<{ value: string; label: string; description?: string }>;
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  name,
  options,
  value,
  onChange,
  error,
  description,
  required,
  className = ''
}) => {
  const groupId = `radio-group-${name}`;
  const { fieldProps, errorId, descriptionId } = useFieldAccessibility(groupId, {
    error,
    description,
    required
  });
  
  return (
    <fieldset className={className} {...fieldProps}>
      <legend className="text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500" aria-label="required">*</span>
        )}
      </legend>
      
      {description && (
        <p id={descriptionId} className="mt-1 text-sm text-gray-500">
          {description}
        </p>
      )}
      
      <div className="mt-2 space-y-2" role="radiogroup">
        {options.map((option) => (
          <div key={option.value} className="relative flex items-start">
            <div className="flex h-5 items-center">
              <input
                id={`${name}-${option.value}`}
                name={name}
                type="radio"
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(e.target.value)}
                className={`h-4 w-4 border-gray-300 text-blue-600 ${focusVisible}`}
              />
            </div>
            <div className="ml-3 text-sm">
              <label 
                htmlFor={`${name}-${option.value}`} 
                className="font-medium text-gray-700"
              >
                {option.label}
              </label>
              {option.description && (
                <p className="text-gray-500">{option.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {error && (
        <p id={errorId} className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
};