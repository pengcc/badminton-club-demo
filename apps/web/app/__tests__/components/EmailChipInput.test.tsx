import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmailChipInput } from '@app/components/ui/email-chip-input';

describe('EmailChipInput form-control state ownership', () => {
  it('keeps one outer invalid and focus boundary around the unboxed input', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EmailChipInput
        id="recipients"
        emails={[]}
        onChange={vi.fn()}
        placeholder="Add email"
        invalidEmailMessage="Enter a valid email"
        duplicateEmailMessage="Email already added"
        instructions="Press Enter to add an email"
        getRemoveEmailLabel={(email) => `Remove ${email}`}
      />
    );

    const input = screen.getByPlaceholderText('Add email');
    const control = container.querySelector(
      '[data-slot="email-chip-input-control"]'
    );
    if (!control) throw new Error('Email chip input control not found');

    expect(control).toHaveClass(
      'border-input',
      'focus-within:ring-2',
      'focus-within:ring-ring'
    );
    expect(control.className).not.toContain('ring-offset');

    await user.type(input, 'invalid{Enter}');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute(
      'aria-describedby',
      'recipients-instructions recipients-error'
    );
    expect(control).toHaveClass(
      'border-destructive',
      'focus-within:ring-destructive'
    );
    expect(input).toHaveClass(
      'border-0',
      'focus-visible:ring-0',
      'aria-[invalid=true]:border-0',
      'aria-[invalid=true]:focus-visible:ring-0'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
  });
});
