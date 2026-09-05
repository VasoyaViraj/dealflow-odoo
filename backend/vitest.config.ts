import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default suite: the pure domain modules only. They import no database and
    // no HTTP layer, so `npm test` runs with no DATABASE_URL and no running
    // Postgres — safe in CI and on a clean checkout.
    //
    // Phase 4's approval/risk suites under src/services/__tests__ talk to a
    // real database, so they live in vitest.integration.config.ts and run via
    // `npm run test:integration`.
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'src/services/__tests__/**'],
    environment: 'node',
  },
});
