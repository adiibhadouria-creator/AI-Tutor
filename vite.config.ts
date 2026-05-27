import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import path from "node:path";

export default defineConfig({
  plugins: [cloudflare(), vinext()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    port: 3000,
  },
});
