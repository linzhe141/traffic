import { execFile } from "node:child_process";
import type { DetectedProcess } from "@local-traffic/protocol";
import { classifyProcesses, type ProcessDetails } from "./classifyProcesses";
import { expandProcessTargets } from "./expandProcessTargets";
import { buildProcessDiscoveryScript } from "./buildProcessDiscoveryScript";

export function listProcessDetails(): Promise<ProcessDetails[]> {
  if (process.platform !== "win32")
    return Promise.reject(
      new Error(
        "Process discovery is currently available on Windows. Enter an executable name or PID manually.",
      ),
    );
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", buildProcessDiscoveryScript()],
      { timeout: 20_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, encoding: "utf8" },
      (error, stdout) => {
        // Never forward PowerShell stderr: it may contain process command lines or credentials.
        if (error) {
          reject(
            new Error(
              "Could not list local processes. Refresh and try again, or enter an executable name/PID manually.",
            ),
          );
          return;
        }
        try {
          const parsed: unknown = JSON.parse(stdout.replace(/^\uFEFF/, ""));
          const rows: unknown[] = parsed === null ? [] : Array.isArray(parsed) ? parsed : [parsed];
          const details = rows.filter(
            (row): row is ProcessDetails =>
              typeof row === "object" &&
              row !== null &&
              typeof (row as ProcessDetails).ProcessId === "number" &&
              typeof (row as ProcessDetails).Name === "string",
          );
          resolve(details);
        } catch {
          reject(
            new Error(
              "Process discovery returned an invalid result. Enter an executable name/PID manually.",
            ),
          );
        }
      },
    );
  });
}

export async function listProcesses(): Promise<DetectedProcess[]> {
  return classifyProcesses(await listProcessDetails(), process.pid);
}

export async function resolveCaptureProcessTargets(target: string): Promise<string> {
  if (process.platform !== "win32") return target;
  return expandProcessTargets(target, await listProcessDetails(), process.pid);
}
