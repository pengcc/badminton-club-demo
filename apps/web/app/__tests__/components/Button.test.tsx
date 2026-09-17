import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@app/components/ui/button';

describe('Button persistent-state geometry', () => {
  it.each([
    ['default', true],
    ['default', false],
    ['secondary', true],
    ['secondary', false],
  ] as const)('reserves transparent border geometry for %s with aria-pressed=%s', (variant, ariaPressed) => {
    render(
      <Button variant={variant} aria-pressed={ariaPressed}>
        Filter
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Filter' })).toHaveClass(
      'border',
      'border-transparent'
    );
  });

  it('does not opt ordinary buttons into persistent-state geometry', () => {
    render(<Button aria-pressed={undefined}>Action</Button>);

    const button = screen.getByRole('button', { name: 'Action' });
    expect(button).not.toHaveClass('border', 'border-transparent');
    expect(button).not.toHaveAttribute('aria-pressed');
  });

  it('keeps the visible outline border for pressed-state outline buttons', () => {
    render(
      <Button variant="outline" aria-pressed={false}>
        Filter
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Filter' });
    expect(button).toHaveClass('border');
    expect(button).not.toHaveClass('border-transparent');
  });

  it('lets an explicit caller border color override the transparent reservation', () => {
    render(
      <Button aria-pressed={true} className="border-red-500">
        Filter
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Filter' });
    expect(button).toHaveClass('border', 'border-red-500');
    expect(button).not.toHaveClass('border-transparent');
  });
});
