import { join } from "node:path";
import { createSystemProxyLease } from "./createSystemProxyLease";
import { createProxyBackupStore } from "./createProxyBackupStore";
import { createWindowsProxyAdapter } from "./createWindowsProxyAdapter";

export function createApplicationProxyLease(dataDir: string) {
  return createSystemProxyLease(
    createWindowsProxyAdapter(),
    createProxyBackupStore(join(dataDir, "system-proxy-recovery.json")),
  );
}
