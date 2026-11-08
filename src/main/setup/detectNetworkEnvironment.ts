import { runBoundedCommand } from "./runBoundedCommand";

/** Report a routing limitation without exposing proxy addresses or changing settings. */
export async function detectLoopbackSystemProxy(): Promise<boolean | undefined> {
  if (process.platform !== "win32") return undefined;
  try {
    const output = await runBoundedCommand("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$settings = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; " +
        "if ($settings.ProxyEnable -eq 1 -and $settings.ProxyServer -match '127\\.0\\.0\\.1|localhost|\\[::1\\]') { 'enabled' } else { 'disabled' }",
    ]);
    return output === "enabled";
  } catch {
    return undefined;
  }
}
