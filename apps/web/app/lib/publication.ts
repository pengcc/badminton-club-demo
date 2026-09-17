import type { PublicationTarget } from '@club/shared-types/api/publication';

export class PublicationRefreshError extends Error {
  constructor() {
    super('The content was saved, but the public page could not be refreshed.');
    this.name = 'PublicationRefreshError';
  }
}

export async function requestPublication(
  target: PublicationTarget
): Promise<void> {
  const response = await fetch('/publication/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });

  if (!response.ok) throw new PublicationRefreshError();
}
