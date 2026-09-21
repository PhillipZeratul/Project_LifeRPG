import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "bundle.js"
    },
    rollupOptions: {
      // Do not bundle the SDK into the plugin; the host provides it
      external: ["@liferpg/sdk"]
    },
    outDir: "dist",
    emptyOutDir: true
  }
});