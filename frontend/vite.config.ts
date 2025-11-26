import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
// Note: When used with Electron Forge Vite plugin, the build output directory
// is controlled by the plugin - don't override it here
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./", // Use relative paths for Electron
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Let Electron Forge Vite plugin control output directory
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
