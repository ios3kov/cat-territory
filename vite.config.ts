import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { buildOfflineWorker } from "./scripts/build-offline-worker.mjs";
let outputDirectory: string;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "offline-release",
      apply: "build",
      configResolved(config) {
        outputDirectory = resolve(config.root, config.build.outDir);
      },
      async closeBundle() {
        await buildOfflineWorker(outputDirectory);
      },
    },
  ],
  base: "./",
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || "dist",
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === "hidden" ? "hidden" : false,
    rollupOptions: { maxParallelFileOps: 128 },
  },
});
