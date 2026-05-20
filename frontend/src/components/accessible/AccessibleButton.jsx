/**
 * =============================================================================
 * components/accessible/AccessibleButton.jsx — EXAMPLE ACCESSIBLE COMPONENT
 * =============================================================================
 * PERFORMANCE FIX 3.4: Accessible button with ARIA labels and semantic HTML
 * =============================================================================
 */

import React from 'react';

/**
 * Accessible button component
 * @param {string} label - Button label (visible text)
 * @param {string} ariaLabel - ARIA label for screen readers (if different from visible text)
 * @param {string} ariaDescribedBy - ID of element describing the button
 * @param {boolean} disabled - Disabled state
 * @param {string} type - Button type (button, submit, reset)
 * @param {function} onClick - Click handler
 */
export const AccessibleButton = ({
  label,
  ariaLabel,
  ariaDescribedBy,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  children,
  ...props
}) => {
  return (
    <>
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel || label}
        aria-describedby={ariaDescribedBy}
        className={`
          inline-flex items-center justify-center
          px-4 py-2 sm:px-6 sm:py-3
          min-h-12 min-w-12
          font-medium text-base
          rounded-lg
          transition-colors duration-200
          focus-visible:outline-2 focus-visible:outline-offset-2
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-blue-700 active:bg-blue-800'
          }
          ${className}
        `}
        {...props}
      >
        {children || label}
      </button>
    </>
  );
};

export default AccessibleButton;
