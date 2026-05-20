/**
 * =============================================================================
 * components/accessible/AccessibleForm.jsx — EXAMPLE ACCESSIBLE FORM
 * =============================================================================
 * PERFORMANCE FIX 3.4: Form with proper labels, validation, and ARIA
 * =============================================================================
 */

import React from 'react';

/**
 * Accessible form field component
 */
export const FormField = ({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  helpText,
  required = false,
  disabled = false,
  ariaDescribedBy,
  ...props
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const helpId = helpText ? `${id}-help` : undefined;
  const describedBy = [ariaDescribedBy, errorId, helpId].filter(Boolean).join(' ');

  return (
    <div className="mb-4 sm:mb-6">
      <label
        htmlFor={id}
        className="block font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
        {required && <span aria-label="required" className="text-red-500 ml-1">*</span>}
      </label>

      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className={`
          w-full
          px-4 py-2 sm:py-3
          border-2 rounded-lg
          text-base
          transition-colors
          focus-visible:outline-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${
            error
              ? 'border-red-500 focus-visible:border-red-600 focus-visible:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus-visible:border-blue-500 focus-visible:ring-blue-500'
          }
        `}
        {...props}
      />

      {error && (
        <div
          id={errorId}
          role="alert"
          className="text-red-600 dark:text-red-400 text-sm mt-1"
        >
          ⚠️ {error}
        </div>
      )}

      {helpText && (
        <div
          id={helpId}
          className="text-gray-600 dark:text-gray-400 text-sm mt-1"
        >
          {helpText}
        </div>
      )}
    </div>
  );
};

/**
 * Accessible form wrapper
 */
export const AccessibleForm = ({
  onSubmit,
  children,
  ariaLabel,
  className = '',
}) => {
  return (
    <form
      onSubmit={onSubmit}
      aria-label={ariaLabel}
      className={`space-y-4 sm:space-y-6 ${className}`}
      noValidate
    >
      {children}
    </form>
  );
};

export default AccessibleForm;
