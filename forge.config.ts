import type { ForgeConfig } from "@electron-forge/shared-types";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { MakerZIP } from "@electron-forge/maker-zip";
import { resolve } from "node:path";
import electronChecksums from "electron/checksums.json";
import { setTimeout as delay } from "node:timers/promises";
import { prepareBundledEngine } from "./scripts/prepareBundledEngine";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    ...(process.platform === "win32" ? { icon: resolve("local-traffic.ico") } : {}),
    // Avoid a final rename of freshly edited EXEs while Windows scans them.
    tmpdir: process.platform === "win32" ? false : resolve(".forge-tmp"),
    download: { checksums: electronChecksums },
    extraResource: [
      resolve("resources/mitm-addon"),
      resolve("resources/engine"),
      resolve("local-traffic.png"),
    ],
  },
  rebuildConfig: {},
  hooks: {
    async generateAssets() {
      await prepareBundledEngine(resolve());
    },
    async packageAfterExtract(_config, _buildPath, _electronVersion, platform) {
      // Windows can briefly lock extracted Electron binaries during antivirus scanning.
      if (platform === "win32") await delay(1000);
    },
  },
  makers: [new MakerZIP({}, ["win32", "darwin", "linux"])],
  plugins: [
    new VitePlugin({
      build: [
        { entry: "src/main/index.ts", config: "vite.main.config.mts", target: "main" },
        { entry: "src/preload/index.ts", config: "vite.preload.config.mts", target: "preload" },
      ],
      renderer: [{ name: "main_window", config: "vite.renderer.config.mts" }],
    }),
  ],
};
export default config;
