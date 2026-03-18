/**
 * Custom hook for search logic
 * Extend with debouncing, filters, etc. as needed
 */
import { useState, useCallback } from 'react';

export function useSearch<T>(
  items: T[],
  searchKey: keyof T | ((item: T) => string)
) {
  const [query, setQuery] = useState('');

  const filteredItems = items.filter((item) => {
    const value =
      typeof searchKey === 'function'
        ? searchKey(item)
        : String(item[searchKey] ?? '');
    return value.toLowerCase().includes(query.toLowerCase());
  });

  const setSearchQuery = useCallback((q: string) => setQuery(q), []);

  return { query, setSearchQuery, filteredItems };
}
