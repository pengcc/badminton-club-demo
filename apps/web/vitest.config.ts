import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  oxc: false,
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': root,
      '@app': `${root}app`,
      '@messages': `${root}messages`,
      '@ui': `${root}app/components/ui`,
      '@club/shared-types': `${root}../../shared/types/src`,
      'next/server': fileURLToPath(
        new URL('./node_modules/next/server.js', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/__tests__/**/*.test.{ts,tsx}'],
    server: { deps: { inline: ['next-intl'] } },
  },
});
