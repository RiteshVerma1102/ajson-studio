import React from 'react';
import styles from './Kbd.module.css';

export type KbdProps = React.HTMLAttributes<HTMLElement>;

export const Kbd: React.FC<KbdProps> = ({ children, className, ...props }) => {
  return (
    <kbd className={`${styles.kbd} ${className || ''}`} {...props}>
      {children}
    </kbd>
  );
};
