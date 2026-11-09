import { execFile } from "node:child_process";

export function runBoundedCommand(
  executable: string,
  args: string[],
  timeout = 8000,
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      { timeout, maxBuffer: 256 * 1024, windowsHide: true, env },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${executable}: ${stderr.trim() || error.message}`));
        else resolve(stdout.trim());
      },
    );
  });
}
