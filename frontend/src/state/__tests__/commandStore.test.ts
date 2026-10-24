import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCommandStore } from '../commandStore';

describe('commandStore', () => {
  beforeEach(() => {
    useCommandStore.setState({ commands: new Map(), paletteOpen: false });
  });

  it('registers and unregisters commands cleanly', () => {
    const action = vi.fn();
    const unregister = useCommandStore.getState().registerCommand({
      id: 'test.cmd',
      title: 'Test Command',
      category: 'Test',
      action,
    });

    const list = useCommandStore.getState().getCommandsList();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe('test.cmd');

    unregister();
    expect(useCommandStore.getState().getCommandsList().length).toBe(0);
  });

  it('executes command by id and closes palette', () => {
    const action = vi.fn();
    useCommandStore.getState().registerCommand({
      id: 'test.execute',
      title: 'Execute Command',
      category: 'Test',
      action,
    });

    useCommandStore.getState().openPalette();
    expect(useCommandStore.getState().paletteOpen).toBe(true);

    useCommandStore.getState().executeCommand('test.execute');
    expect(action).toHaveBeenCalledTimes(1);
    expect(useCommandStore.getState().paletteOpen).toBe(false);
  });
});
