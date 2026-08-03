import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "three/examples/jsm/controls/OrbitControls.js"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4310",
      "/llms.txt": "http://127.0.0.1:4310",
      "/capabilities.json": "http://127.0.0.1:4310",
      "/docs": "http://127.0.0.1:4310",
    },
  },
});
