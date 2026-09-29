import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

// Mirrors tsconfig.json's "@/*" -> "./src/*" path alias, which vitest doesn't
// pick up from tsconfig automatically without this. Needed once any test
// imports a module (like src/lib/api-config.ts) that itself uses the alias —
// the existing pure-function tests happened to only use relative imports.
const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src')
    }
  }
});
