import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Tests automatiques : `npm test`.
 * Ils portent sur le code partagé (schémas, règles des médias, galerie en blocs, API de /admin)
 * et lisent les VRAIS project.md du site, sans jamais les modifier (l'API est testée sur une copie temporaire).
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
