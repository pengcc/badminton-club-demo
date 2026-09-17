const OWNED_IMAGE_PREFIXES = ['/images/', '/uploads/'] as const;

export function shouldBypassImageOptimization(src: string): boolean {
  const normalized = src.trim();
  const pathname = normalized.split(/[?#]/, 1)[0].toLowerCase();
  const isOwnedSource = OWNED_IMAGE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix)
  );

  return !isOwnedSource || pathname.endsWith('.gif');
}
