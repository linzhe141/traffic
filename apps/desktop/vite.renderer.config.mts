import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: resolve("src/renderer"),
  base: "./",
  build: { outDir: resolve(".vite/renderer/main_window"), emptyOutDir: true },
  plugins: [vue(), tailwindcss()],
});
