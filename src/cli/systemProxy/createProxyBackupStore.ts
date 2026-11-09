import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { proxyValueNames, type ProxyBackup, type ProxyBackupStore } from "./types";

export function createProxyBackupStore(path: string): ProxyBackupStore {
  return {
    async read() {
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      const backup = JSON.parse(text) as ProxyBackup;
      if (
        backup.version !== 1 ||
        !Number.isSafeInteger(backup.ownerPid) ||
        backup.ownerPid <= 0 ||
        !/^127\.0\.0\.1:\d{1,5}$/.test(backup.owner) ||
        !backup.settings ||
        proxyValueNames.some((name) => !(name in backup.settings))
      ) {
        throw new Error("系统代理恢复文件无效，请手动检查系统代理设置。");
      }
      return backup;
    },
    async write(backup) {
      await mkdir(dirname(path), { recursive: true });
      // Exclusive creation prevents two app instances from acquiring the system proxy.
      const handle = await open(path, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(backup), "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
    },
    async remove() {
      await rm(path, { force: true });
    },
  };
}
