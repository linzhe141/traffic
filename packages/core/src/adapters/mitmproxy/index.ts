import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { CaptureConfiguration } from "@local-traffic/protocol";
import type { CaptureBackendDependencies } from "../../engines/types";
import { buildEngineArguments } from "./buildEngineArguments";
import { createEngineEventParser } from "./parseEngineEvents";
import { terminateEngine } from "./terminateEngine";
import { prepareEngineEnvironment } from "./prepareEngineEnvironment";
import { buildEngineExitError } from "./buildEngineExitError";

export type MitmEngineDependencies = CaptureBackendDependencies;

export function createMitmCaptureEngine(dependencies: MitmEngineDependencies) {
  let child: ChildProcessWithoutNullStreams | undefined;
  let token = "";
  let stopping = false;
  return {
    async start(options: CaptureConfiguration): Promise<{ host: string; port: number }> {
      if (!dependencies.executablePath)
        throw new Error("内置抓取引擎缺失，请重新安装应用或设置 MITMDUMP_PATH。");
      if (child) throw new Error("Capture engine is already running");
      const args = buildEngineArguments(options, dependencies.addonPath, dependencies.confdir);
      const environment = await prepareEngineEnvironment(dependencies.confdir);
      token = randomUUID();
      stopping = false;
      const active = spawn(dependencies.executablePath, args, {
        shell: false,
        windowsHide: true,
        stdio: "pipe",
        env: {
          ...environment,
          TRAFFIC_SESSION_TOKEN: token,
          TRAFFIC_UPSTREAM_PROXY:
            options.mode === "system-proxy" ? "" : (options.upstreamProxy ?? ""),
          TRAFFIC_SCOPE_PIDS: options.mode === "system-proxy" ? (options.target ?? "") : "",
          TRAFFIC_FULL_BODIES: dependencies.onBodyChunk ? "1" : "",
        },
      });
      child = active;
      let diagnosticOutput = "";
      const appendEngineLog = (text: string) => {
        diagnosticOutput = (diagnosticOutput + text).slice(-8192);
      };
      active.stderr.setEncoding("utf8").on("data", appendEngineLog);
      active.stdin.on("error", () => {});
      try {
        await new Promise<void>((resolve, reject) => {
          let ready = false;
          let failed = false;
          const timer = setTimeout(
            () =>
              reject(
                new Error(
                  `抓取内核启动超时。Windows 首次启动需要允许 windows-redirector.exe 的管理员授权；请处理系统提示后重试。 ${diagnosticOutput.trim()}`,
                ),
              ),
            120_000,
          );
          const fail = (error: Error) => {
            clearTimeout(timer);
            if (failed) return;
            failed = true;
            if (!ready) reject(error);
            else if (!stopping) dependencies.onError(error);
          };
          const parser = createEngineEventParser(token, {
            onReady() {
              if (!ready) {
                ready = true;
                clearTimeout(timer);
                resolve();
              }
            },
            onRecord(record) {
              if (!stopping && child === active && !failed) dependencies.onRecord(record);
            },
            onBodyChunk(chunk) {
              if (!stopping && child === active && !failed) dependencies.onBodyChunk?.(chunk);
            },
            onDiagnostic(diagnostic) {
              if (!stopping && child === active && !failed) dependencies.onDiagnostic?.(diagnostic);
            },
            onLog(line) {
              appendEngineLog(`${line}\n`);
            },
            onError(error) {
              fail(error);
              void terminateEngine(active, token);
            },
          });
          active.stdout.on("data", (chunk: Buffer) => parser.push(chunk));
          active.once("error", fail);
          active.once("close", (code, signal) => {
            parser.finish();
            if (child === active) child = undefined;
            fail(buildEngineExitError(code, signal, diagnosticOutput, environment.TEMP));
          });
        });
        return { host: "127.0.0.1", port: options.port };
      } catch (error) {
        stopping = true;
        await terminateEngine(active, token);
        if (child === active) child = undefined;
        throw error;
      }
    },
    async stop(): Promise<void> {
      stopping = true;
      const active = child;
      if (!active) return;
      await terminateEngine(active, token);
      if (child === active) child = undefined;
    },
  };
}
