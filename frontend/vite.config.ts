/**
 * =============================================================================
 * Module: frontend/vite.config.ts
 * Purpose: Vite development and production build configuration with API proxy
 *          and vendor chunking (rollup manualChunks) for optimal cacheability & bundle size.
 * Used by: Vite dev server, build pipeline.
 * Dependencies: vite, @vitejs/plugin-react
 * Public Members: default config
 * Side Effects: Configures dev server proxy on port 5173 to backend port 8000;
 *                splits vendor libraries (react, framer-motion, lucide-react) into isolated chunks.
 * =============================================================================
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
});
