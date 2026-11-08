import { spawn, type ChildProcess } from "node:child_process";

export async function terminateEngine(child: ChildProcess, token: string): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(forceTimer);
      clearTimeout(deadline);
      child.removeListener("exit", finish);
      resolve();
    };
    const forceTimer = setTimeout(() => {
      if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          shell: false,
          windowsHide: true,
          stdio: "ignore",
        });
        killer.on("error", () => child.kill());
      } else child.kill("SIGKILL");
    }, 2500);
    const deadline = setTimeout(finish, 6500);
    child.once("exit", finish);
    child.stdin?.write(`${JSON.stringify({ command: "shutdown", token })}\n`, () => {});
  });
}
