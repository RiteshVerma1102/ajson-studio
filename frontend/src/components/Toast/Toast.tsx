import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { useNotificationStore, NotificationType } from '../../state/notificationStore';
import { IconButton } from '../IconButton/IconButton';
import styles from './Toast.module.css';

const ICONS: Record<NotificationType, React.ReactNode> = {
  info: <Info size={16} color="var(--color-info)" />,
  success: <CheckCircle2 size={16} color="var(--color-success)" />,
  warning: <AlertTriangle size={16} color="var(--color-warning)" />,
  error: <AlertCircle size={16} color="var(--color-danger)" />,
};

export const ToastContainer: React.FC = () => {
  const { notifications, dismissNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div className={styles.container} role="region" aria-label="Notifications">
      {notifications.map((n) => (
        <div key={n.id} className={`${styles.toast} ${styles[`type-${n.type}`]}`}>
          {ICONS[n.type]}
          <div className={styles.content}>
            <div className={styles.title}>{n.title}</div>
            {n.message && <div className={styles.message}>{n.message}</div>}
          </div>
          <IconButton
            label="Dismiss notification"
            size="sm"
            onClick={() => dismissNotification(n.id)}
          >
            <X size={14} />
          </IconButton>
        </div>
      ))}
    </div>
  );
};
