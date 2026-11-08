import { create } from 'zustand';
import { safeStorage } from './storage';

export type PhysicsNodeType = 'file' | 'git' | 'terminal' | 'ai' | 'custom';

export interface PhysicsNodePayload {
  id: string;
  label: string;
  sublabel?: string;
  color?: string;
  type?: PhysicsNodeType;
  meta?: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface PhysicsState {
  customNodes: PhysicsNodePayload[];
  savedPositions: Record<string, { x: number; y: number }>;
  antiGravity: boolean;
  buoyancy: boolean;

  // Actions
  spawnNode: (node: Omit<PhysicsNodePayload, 'id'> & { id?: string }) => string;
  removeNode: (id: string) => void;
  clearCustomNodes: () => void;
  saveNodePosition: (id: string, pos: { x: number; y: number }) => void;
  saveAllPositions: (positions: Record<string, { x: number; y: number }>) => void;
  setAntiGravity: (enabled: boolean) => void;
  toggleAntiGravity: () => void;
  setBuoyancy: (enabled: boolean) => void;
  toggleBuoyancy: () => void;
}

const POSITIONS_STORAGE_KEY = 'ajson_physics_positions_v1';
const SETTINGS_STORAGE_KEY = 'ajson_physics_settings_v1';

function loadInitialState() {
  let savedPositions: Record<string, { x: number; y: number }> = {};
  let antiGravity = false;
  let buoyancy = true;

  try {
    const rawPos = safeStorage.getItem(POSITIONS_STORAGE_KEY);
    if (rawPos) {
      savedPositions = JSON.parse(rawPos);
    }
    const rawSettings = safeStorage.getItem(SETTINGS_STORAGE_KEY);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (typeof parsed.antiGravity === 'boolean') antiGravity = parsed.antiGravity;
      if (typeof parsed.buoyancy === 'boolean') buoyancy = parsed.buoyancy;
    }
  } catch {
    // Fallback to defaults
  }

  return { savedPositions, antiGravity, buoyancy };
}

export const usePhysicsStore = create<PhysicsState>((set, get) => {
  const initial = loadInitialState();

  const persistSettings = () => {
    try {
      safeStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          antiGravity: get().antiGravity,
          buoyancy: get().buoyancy,
        })
      );
    } catch {
      // Ignore
    }
  };

  const persistPositions = () => {
    try {
      safeStorage.setItem(
        POSITIONS_STORAGE_KEY,
        JSON.stringify(get().savedPositions)
      );
    } catch {
      // Ignore
    }
  };

  return {
    customNodes: [],
    savedPositions: initial.savedPositions,
    antiGravity: initial.antiGravity,
    buoyancy: initial.buoyancy,

    spawnNode: (node) => {
      const id = node.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const fullNode: PhysicsNodePayload = { ...node, id };
      set((state) => ({
        customNodes: [...state.customNodes.filter((n) => n.id !== id), fullNode],
      }));
      return id;
    },

    removeNode: (id) => {
      set((state) => ({
        customNodes: state.customNodes.filter((n) => n.id !== id),
      }));
    },

    clearCustomNodes: () => {
      set({ customNodes: [] });
    },

    saveNodePosition: (id, pos) => {
      set((state) => ({
        savedPositions: { ...state.savedPositions, [id]: pos },
      }));
      persistPositions();
    },

    saveAllPositions: (positions) => {
      set((state) => ({
        savedPositions: { ...state.savedPositions, ...positions },
      }));
      persistPositions();
    },

    setAntiGravity: (enabled) => {
      set({ antiGravity: enabled });
      persistSettings();
    },

    toggleAntiGravity: () => {
      set((state) => ({ antiGravity: !state.antiGravity }));
      persistSettings();
    },

    setBuoyancy: (enabled) => {
      set({ buoyancy: enabled });
      persistSettings();
    },

    toggleBuoyancy: () => {
      set((state) => ({ buoyancy: !state.buoyancy }));
      persistSettings();
    },
  };
});
