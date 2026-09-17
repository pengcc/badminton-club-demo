import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Modal } from '@app/components/ui/modal';

function Harness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open legacy modal
      </button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        ariaLabel="Legacy modal"
      >
        <div>
          <button type="button">First action</button>
          <button type="button">Second action</button>
        </div>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('contains focus, closes with Escape, and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open legacy modal' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Legacy modal' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    for (let step = 0; step < 4; step += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: 'Legacy modal' })
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
