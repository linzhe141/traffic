import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runBoundedCommand } from "./runBoundedCommand";
import type { EnginePaths } from "@local-traffic/core";

export async function checkFileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveEnginePaths(
  resourceRoot: string,
  dataDir: string,
): Promise<EnginePaths> {
  const executableName = process.platform === "win32" ? "mitmdump.exe" : "mitmdump";
  let executablePath = process.env.MITMDUMP_PATH ? resolve(process.env.MITMDUMP_PATH) : "";
  if (!executablePath) {
    const bundledPath = join(
      resourceRoot,
      "engine",
      `${process.platform}-${process.arch}`,
      executableName,
    );
    if (await checkFileExists(bundledPath)) executablePath = bundledPath;
  }
  if (!executablePath) {
    try {
      const output = await runBoundedCommand(process.platform === "win32" ? "where.exe" : "which", [
        executableName,
      ]);
      executablePath = output.split(/\r?\n/)[0] ?? "";
    } catch {
      /* Setup UI provides actionable installation guidance. */
    }
  }
  return {
    executablePath,
    addonPath: join(resourceRoot, "mitm-addon", "addon.py"),
    confdir: join(dataDir, "mitmproxy"),
  };
}
