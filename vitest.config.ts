import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      obsidian: '/Users/eohjun/projects/obsidian-vault-chat/tests/__mocks__/obsidian.ts',
    },
  },
});
