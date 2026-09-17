import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Logo from '@app/components/Logo';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) =>
    key === 'club_name' ? 'Badminton Club Demo' : key,
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    priority,
    sizes,
    src,
  }: {
    alt: string;
    priority?: boolean;
    sizes?: string;
    src: string;
  }) => (
    <img
      alt={alt}
      data-priority={String(Boolean(priority))}
      data-sizes={sizes}
      src={src}
    />
  ),
}));

describe('Logo image delivery', () => {
  it('renders one responsive priority image in the Header', () => {
    render(<Logo />);

    const images = screen.getAllByRole('img', {
      name: 'Badminton Club Demo',
    });
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', '/images/badminton-logo-256.png');
    expect(images[0]).toHaveAttribute('data-priority', 'true');
    expect(images[0]).toHaveAttribute(
      'data-sizes',
      '(max-width: 639px) 32px, 40px'
    );
  });

  it('keeps the Footer logo responsive without another priority preload', () => {
    render(<Logo isInHeader={false} />);

    const image = screen.getByRole('img', { name: 'Badminton Club Demo' });
    expect(image).toHaveAttribute('src', '/images/badminton-logo-256.png');
    expect(image).toHaveAttribute('data-priority', 'false');
  });
});
