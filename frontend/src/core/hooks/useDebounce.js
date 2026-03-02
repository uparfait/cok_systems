// useDebounce Hook - Debounce value changes
// Delays updating a value until after a specified delay has passed
// Useful for reducing API calls or expensive operations

import { useState, useEffect } from 'react';

/**
 * Hook to debounce a value
 * @param {*} value - The value to debounce
 * @param {number} delay - The delay in milliseconds (default: 500ms)
 * @returns {*} The debounced value
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function - cancels the timeout if value changes
    // before the delay has passed
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
