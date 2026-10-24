import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tabs } from '../Tabs/Tabs';

describe('Tabs component', () => {
  const items = [
    { id: 'tab1', label: 'First Tab' },
    { id: 'tab2', label: 'Second Tab', badge: 3 },
  ];

  it('renders tab list with proper ARIA attributes', () => {
    render(<Tabs items={items} activeId="tab1" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();

    const tab1 = screen.getByRole('tab', { name: /first tab/i });
    const tab2 = screen.getByRole('tab', { name: /second tab/i });

    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(tab2).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange when clicking an inactive tab', () => {
    const handleChange = vi.fn();
    render(<Tabs items={items} activeId="tab1" onChange={handleChange} />);

    fireEvent.click(screen.getByRole('tab', { name: /second tab/i }));
    expect(handleChange).toHaveBeenCalledWith('tab2');
  });
});
