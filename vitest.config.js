import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Exported QA apps have their own runner and dependencies, not Vilsem's.
    exclude: [...configDefaults.exclude, 'cache/**'],
  },
});
