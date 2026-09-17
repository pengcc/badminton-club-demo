import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '@app/components/ui/input';
import { Textarea } from '@app/components/ui/textarea';

describe('shared form-control state ownership', () => {
  it('keeps base and focus geometry while styling semantic invalid state', () => {
    render(
      <>
        <Input aria-label="Input" aria-invalid="true" />
        <Textarea aria-label="Textarea" aria-invalid="true" />
      </>
    );

    for (const control of [
      screen.getByRole('textbox', { name: 'Input' }),
      screen.getByRole('textbox', { name: 'Textarea' }),
    ]) {
      expect(control).toHaveClass(
        'border',
        'border-input',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
        'aria-[invalid=true]:border-destructive',
        'aria-[invalid=true]:focus-visible:ring-destructive'
      );
      expect(control.className).not.toContain('ring-offset-2');
    }
  });

  it('allows a composite owner to suppress the nested input boundary', () => {
    render(
      <Input
        aria-label="Composite input"
        aria-invalid="true"
        className="border-0 focus-visible:ring-0 aria-[invalid=true]:border-0 aria-[invalid=true]:focus-visible:ring-0"
      />
    );

    const input = screen.getByRole('textbox', { name: 'Composite input' });
    expect(input).toHaveClass(
      'border-0',
      'focus-visible:ring-0',
      'aria-[invalid=true]:border-0',
      'aria-[invalid=true]:focus-visible:ring-0'
    );
    expect(input).not.toHaveClass('border');
    expect(input).not.toHaveClass('focus-visible:ring-2');
  });
});
