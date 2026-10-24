import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from '../Modal/Modal';

describe('Modal component', () => {
  it('renders modal dialog when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Dialog">
        <div>Modal content body</div>
      </Modal>
    );

    expect(screen.getByRole('dialog', { name: 'Test Dialog' })).toBeInTheDocument();
    expect(screen.getByText('Modal content body')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden Dialog">
        <div>Hidden body</div>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('triggers onClose when close icon button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Dismissible Dialog">
        <div>Content</div>
      </Modal>
    );

    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
