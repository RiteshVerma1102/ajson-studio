import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  durationMs?: number;
  timestamp: number;
}

export interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (
    item: Omit<NotificationItem, 'id' | 'timestamp'> & { id?: string }
  ) => string;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (item) => {
    const id = item.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fullItem: NotificationItem = {
      ...item,
      id,
      timestamp: Date.now(),
      durationMs: item.durationMs ?? 4000,
    };

    set((state) => ({
      notifications: [fullItem, ...state.notifications].slice(0, 10),
    }));

    if (fullItem.durationMs && fullItem.durationMs > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, fullItem.durationMs);
    }

    return id;
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => set({ notifications: [] }),
}));
