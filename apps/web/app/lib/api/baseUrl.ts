export function getServerApiBaseUrl(): string {
  const rawBaseUrl =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3003/api';
  const trimmed = rawBaseUrl.replace(/\/$/, '');

  if (trimmed.endsWith('/api')) {
    return trimmed.slice(0, -4);
  }

  return trimmed;
}
