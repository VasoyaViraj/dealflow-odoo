import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the pure domain modules are unit tested here. They import no
    // database and no HTTP layer, so the suite runs with no DATABASE_URL and
    // no running Postgres — `npm test` is safe in CI and on a clean checkout.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
