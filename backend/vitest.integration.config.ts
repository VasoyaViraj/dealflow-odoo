import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Phase 4's risk-engine and approval state-machine suites. Both query the
    // real `db` singleton rather than an injected client, so these require a
    // migrated, seeded Postgres reachable at DATABASE_URL.
    include: ['src/services/__tests__/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15000,
    // The fixtures share one database, so parallel files would race.
    fileParallelism: false,
  },
});
