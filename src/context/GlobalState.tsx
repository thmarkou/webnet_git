/**
 * GlobalState - app-wide state beyond auth
 * Extend with theme, preferences, etc. as needed
 */
import React, { createContext, useContext } from 'react';

interface GlobalStateValue {
  // Add global state as needed
  // theme: 'light' | 'dark';
  // setTheme: (theme: 'light' | 'dark') => void;
}

const GlobalStateContext = createContext<GlobalStateValue | undefined>(undefined);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
  const value: GlobalStateValue = {
    // Initialize global state
  };

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState() {
  const context = useContext(GlobalStateContext);
  if (context === undefined) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
}
