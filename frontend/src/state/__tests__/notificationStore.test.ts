import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '../notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it('adds notification with generated id and defaults', () => {
    const id = useNotificationStore.getState().addNotification({
      type: 'success',
      title: 'Action Completed',
      message: 'All tasks succeeded',
    });

    const notifs = useNotificationStore.getState().notifications;
    expect(notifs.length).toBe(1);
    expect(notifs[0]?.id).toBe(id);
    expect(notifs[0]?.title).toBe('Action Completed');
  });

  it('dismisses notification by id', () => {
    const id = useNotificationStore.getState().addNotification({
      type: 'warning',
      title: 'Notice',
    });

    expect(useNotificationStore.getState().notifications.length).toBe(1);
    useNotificationStore.getState().dismissNotification(id);
    expect(useNotificationStore.getState().notifications.length).toBe(0);
  });
});
