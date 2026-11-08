import type { CaptureOptions } from "../../shared/contracts";
import type {
  CaptureBackendFactory,
  CaptureEngine,
  CaptureBackendDependencies,
  EnginePaths,
} from "./types";
import { createMitmCaptureEngine } from "../adapters/mitmproxy";

export interface CaptureEngineOptions {
  resolvePaths(): Promise<EnginePaths>;
  resolveTargets(target: string): Promise<string>;
  getCertificateState(confdir: string): Promise<{ ready: boolean; trusted: boolean }>;
  proxyLease: {
    getUpstream(): Promise<string | undefined>;
    activate(port: number): Promise<void>;
    restore(): Promise<void>;
  };
  createEngine?: CaptureBackendFactory;
  callbacks: Pick<
    CaptureBackendDependencies,
    "onRecord" | "onError" | "onDiagnostic" | "onBodyChunk"
  >;
}

export function createCaptureEngine(dependencies: CaptureEngineOptions): CaptureEngine {
  let engine: CaptureEngine | undefined;
  let systemMode = false;
  let engineFailure: Error | undefined;

  async function stop(): Promise<void> {
    if (systemMode) await dependencies.proxyLease.restore();
    systemMode = false;
    await engine?.stop();
    engine = undefined;
  }

  return {
    async start(options: CaptureOptions) {
      await stop();
      engineFailure = undefined;
      const paths = await dependencies.resolvePaths();
      systemMode = options.mode === "system-proxy";
      let normalized = { ...options };
      if (systemMode) {
        normalized.upstreamProxy =
          options.upstreamProxy ?? (await dependencies.proxyLease.getUpstream());
        if (normalized.upstreamProxy) {
          const upstream = new URL(normalized.upstreamProxy);
          const upstreamPort = Number(upstream.port || (upstream.protocol === "https:" ? 443 : 80));
          if (
            ["127.0.0.1", "localhost", "[::1]"].includes(upstream.hostname) &&
            upstreamPort === options.port
          ) {
            throw new Error("抓取端口与上游代理端口相同，会形成代理循环，请更换抓取端口。");
          }
        }
      } else normalized.target = await dependencies.resolveTargets(options.target ?? "");

      engine = (dependencies.createEngine ?? createMitmCaptureEngine)({
        ...paths,
        ...dependencies.callbacks,
        onError(error) {
          engineFailure = error;
          void (async () => {
            try {
              if (systemMode) await dependencies.proxyLease.restore();
            } catch {
              error = new Error(`${error.message} 系统代理恢复失败，请手动检查代理设置。`);
            }
            dependencies.callbacks.onError(error);
          })();
        },
      });
      try {
        const certificate = systemMode
          ? await dependencies.getCertificateState(paths.confdir)
          : undefined;
        if (certificate?.ready && !certificate.trusted)
          throw new Error("请先点击信任 CA 证书，然后再启动系统代理模式。系统代理尚未修改。");
        const address = await engine.start(normalized);
        if (engineFailure) throw engineFailure;
        if (systemMode) {
          const certificate = await dependencies.getCertificateState(paths.confdir);
          if (!certificate.trusted)
            throw new Error(
              "CA 证书已生成。请先点击信任 CA 证书，然后再次启动系统代理模式。系统代理尚未修改。",
            );
          if (engineFailure) throw engineFailure;
          await dependencies.proxyLease.activate(options.port);
          if (engineFailure) throw engineFailure;
        }
        return address;
      } catch (error) {
        await stop();
        throw error;
      }
    },
    stop,
  };
}
