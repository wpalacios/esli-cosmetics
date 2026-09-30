/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@esli-cosmetics/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@esli-cosmetics/utils": path.resolve(
        __dirname,
        "../../packages/utils/src"
      ),
      "@esli-cosmetics/types": path.resolve(
        __dirname,
        "../../packages/types/src"
      ),
    },
  },
});
