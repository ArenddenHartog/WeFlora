import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.VITE_BUILD_SHA ?? 'dev'),
    __BUILD_TIME__: JSON.stringify(process.env.VITE_BUILD_TIME ?? new Date().toISOString())
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
  },
});
