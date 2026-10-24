import React, { useEffect } from 'react';
import { AppShell } from './layouts/AppShell';
import { useLayoutStore } from './state/layoutStore';

export const App: React.FC = () => {
  const theme = useLayoutStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <AppShell />;
};

export default App;
