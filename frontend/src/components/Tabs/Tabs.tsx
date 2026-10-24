import React from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeId, onChange, className }) => {
  return (
    <div role="tablist" className={`${styles.tablist} ${className || ''}`}>
      {items.map((item) => {
        const isSelected = item.id === activeId;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`${styles.tab} ${isSelected ? styles.selected : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && <span className={styles.badge}>{item.badge}</span>}
          </button>
        );
      })}
    </div>
  );
};
