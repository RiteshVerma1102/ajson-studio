import React from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, ...props }) => {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${styles.spinner} ${styles[`size-${size}`]} ${className || ''}`}
      {...props}
    />
  );
};
