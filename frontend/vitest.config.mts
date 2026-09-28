import { defineConfig } from "vitest/config";

// Deliberately narrow: only pure TS modules with no react-native/expo
// imports are tested here (vitest runs in Node, not a RN runtime). Scoping
// `include` this tightly means it can never accidentally pick up a
// component file and fail trying to load native modules.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
