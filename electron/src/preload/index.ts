import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IpcChannels } from '@ajson/contracts';

// Explicit whitelist of approved IPC channels to prevent arbitrary channel injection
const ALLOWED_CHANNELS = new Set<string>(Object.values(IpcChannels));

/**
 * Preload context bridge exposed on window.ajson.
 * Adheres strictly to contextIsolation: true and nodeIntegration: false.
 */
const ajsonBridge = {
  /**
   * Dispatches a validated request across the IPC gateway and handles normalized AjsonError responses.
   */
  async invoke(channel: string, payload?: unknown): Promise<unknown> {
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new Error(`[Preload Security] Channel "${channel}" is not whitelisted.`);
    }
    return await ipcRenderer.invoke(channel, payload);
  },

  /**
   * Subscribes to events from Electron main. Returns an unsubscribe function.
   */
  on(channel: string, listener: (event: unknown, data: unknown) => void): () => void {
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new Error(`[Preload Security] Channel "${channel}" is not whitelisted.`);
    }
    const internalListener = (event: IpcRendererEvent, data: unknown) => {
      listener(event, data);
    };
    ipcRenderer.on(channel, internalListener);
    return () => {
      ipcRenderer.removeListener(channel, internalListener);
    };
  },

  /**
   * Sends one-way asynchronous IPC messages for whitelisted channels.
   */
  send(channel: string, payload?: unknown): void {
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new Error(`[Preload Security] Channel "${channel}" is not whitelisted.`);
    }
    ipcRenderer.send(channel, payload);
  },
};

// Expose on window.ajson
contextBridge.exposeInMainWorld('ajson', ajsonBridge);

export type AjsonBridge = typeof ajsonBridge;
