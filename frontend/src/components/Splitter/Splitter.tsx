import React from 'react';
import { PanelResizeHandle } from 'react-resizable-panels';
import styles from './Splitter.module.css';

export interface SplitterProps {
  id?: string;
  className?: string;
  onDoubleClick?: () => void;
}

export const Splitter: React.FC<SplitterProps> = ({ id, className, onDoubleClick }) => {
  return (
    <PanelResizeHandle
      id={id}
      className={`${styles.splitter} ${className || ''}`}
      onDoubleClick={onDoubleClick}
    />
  );
};
