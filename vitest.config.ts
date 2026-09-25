import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // OpenPencil and Chrome saturate small CI runners when test files run in parallel.
    fileParallelism: !process.env.CI,
  },
});
