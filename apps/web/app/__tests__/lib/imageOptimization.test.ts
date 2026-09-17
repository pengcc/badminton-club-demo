import { describe, expect, it } from 'vitest';
import { shouldBypassImageOptimization } from '@app/lib/imageOptimization';

describe('public image optimization boundary', () => {
  it.each([
    '/images/location-tu.jpeg',
    '/uploads/activities/training.webp',
    '/uploads/contact/qr.png?version=2',
  ])('optimizes repository-owned source %s', (src) => {
    expect(shouldBypassImageOptimization(src)).toBe(false);
  });

  it.each([
    '/uploads/activities/animation.gif',
    '/uploads/activities/animation.GIF?version=2',
    'blob:http://localhost/preview',
    'data:image/png;base64,preview',
    'https://images.example.com/location.jpg',
  ])('keeps unsupported or non-owned source %s as pass-through', (src) => {
    expect(shouldBypassImageOptimization(src)).toBe(true);
  });
});
