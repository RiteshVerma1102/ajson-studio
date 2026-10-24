import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
  inputSize?: 'sm' | 'md';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, rightIcon, error, inputSize = 'md', className, ...props }, ref) => {
    const wrapperClass = [
      styles.wrapper,
      styles[`size-${inputSize}`],
      error && styles.hasError,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClass}>
        {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
        <input ref={ref} className={styles.input} {...props} />
        {rightIcon && <span className={styles.icon}>{rightIcon}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
