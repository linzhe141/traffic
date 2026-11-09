import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("./src/main.ts", import.meta.url)),
      formats: ["cjs"],
      fileName: () => "capture-cli.cjs",
    },
    rollupOptions: {
      external: [...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
      output: { entryFileNames: "capture-cli.cjs" },
    },
  },
});
