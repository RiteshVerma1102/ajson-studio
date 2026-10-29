import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppShell } from '../AppShell';
import { useLayoutStore } from '../../state/layoutStore';

describe('AppShell layout', () => {
  beforeEach(() => {
    useLayoutStore.getState().resetPanelSizes();
    useLayoutStore.getState().setActiveView('editor');
  });

  it('renders title bar, activity bar, editor area, and status bar', () => {
    render(<AppShell />);

    expect(screen.getAllByText('Ajson Studio')[0]).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /activity bar/i })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: /status bar/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /bottom panel/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /ai assistant panel/i })).toBeInTheDocument();
  });

  it('renders Mission Control when activeView is manager', () => {
    useLayoutStore.getState().setActiveView('manager');
    render(<AppShell />);

    expect(
      screen.getByText(/mission control/i)
    ).toBeInTheDocument();
  });
});
