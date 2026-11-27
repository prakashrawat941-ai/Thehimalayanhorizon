'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { normalizeTheme } from './theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children, initialTheme = 'system' }) {
  const [theme, setTheme] = useState(() => normalizeTheme(initialTheme));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = `thh_theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [theme]);
  const value = useMemo(() => ({ theme, setTheme: (next) => setTheme(normalizeTheme(next)) }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('Theme control must be inside ThemeProvider');
  return context;
}
