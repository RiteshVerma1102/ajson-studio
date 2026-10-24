import React, { useState } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactElement;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  children,
  delay = 200,
}) => {
  const [visible, setVisible] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);

  const show = () => {
    const t = window.setTimeout(() => setVisible(true), delay);
    setTimer(t);
  };

  const hide = () => {
    if (timer) clearTimeout(timer);
    setVisible(false);
  };

  return (
    <div
      className={styles.container}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`${styles.tooltip} ${styles[`pos-${position}`]} ${styles.visible}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
