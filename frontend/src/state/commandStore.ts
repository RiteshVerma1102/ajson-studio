import { create } from 'zustand';

export interface Command {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  fallbackShortcut?: string;
  keywords?: string[];
  action: () => void;
}

export interface CommandState {
  commands: Map<string, Command>;
  paletteOpen: boolean;

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;

  registerCommand: (command: Command) => () => void;
  executeCommand: (id: string) => void;
  getCommandsList: () => Command[];
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commands: new Map<string, Command>(),
  paletteOpen: false,

  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  registerCommand: (command: Command) => {
    set((state) => {
      const next = new Map(state.commands);
      next.set(command.id, command);
      return { commands: next };
    });

    return () => {
      set((state) => {
        const next = new Map(state.commands);
        next.delete(command.id);
        return { commands: next };
      });
    };
  },

  executeCommand: (id: string) => {
    const cmd = get().commands.get(id);
    if (cmd) {
      set({ paletteOpen: false });
      cmd.action();
    }
  },

  getCommandsList: () => Array.from(get().commands.values()),
}));
