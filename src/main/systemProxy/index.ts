import { app } from "electron";
import { join } from "node:path";
import { createSystemProxyLease } from "./createSystemProxyLease";
import { createProxyBackupStore } from "./createProxyBackupStore";
import { createWindowsProxyAdapter } from "./createWindowsProxyAdapter";

export function createApplicationProxyLease() {
  return createSystemProxyLease(
    createWindowsProxyAdapter(),
    createProxyBackupStore(join(app.getPath("userData"), "system-proxy-recovery.json")),
  );
}

export async function getSystemProxyUpstream(): Promise<string | undefined> {
  if (process.platform !== "win32") return undefined;
  return createApplicationProxyLease().getUpstream();
}
