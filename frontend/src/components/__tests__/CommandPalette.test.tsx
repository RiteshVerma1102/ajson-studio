import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandPalette } from '../CommandPalette/CommandPalette';
import { useCommandStore } from '../../state/commandStore';

describe('CommandPalette component', () => {
  beforeEach(() => {
    useCommandStore.setState({ commands: new Map(), paletteOpen: false });
  });

  it('opens on F1 keyboard shortcut (Addition 7 fallback)', () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'F1' });
    expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
  });

  it('renders registered commands and executes on selection', () => {
    const action = vi.fn();
    useCommandStore.getState().registerCommand({
      id: 'cmd.format',
      title: 'Format Document',
      category: 'Editor',
      shortcut: 'Shift+Alt+F',
      action,
    });

    useCommandStore.getState().openPalette();
    render(<CommandPalette />);

    const item = screen.getByText('Format Document');
    expect(item).toBeInTheDocument();

    fireEvent.click(item);
    expect(action).toHaveBeenCalledTimes(1);
    expect(useCommandStore.getState().paletteOpen).toBe(false);
  });
});
