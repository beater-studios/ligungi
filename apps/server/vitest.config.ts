import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Server tests hash passwords with scrypt and replay whole games, and the test files run side by side: on a busy
    // machine a correct test can take several times its usual second, past vitest's default of 5 seconds.
    testTimeout: 20_000,
  },
});
