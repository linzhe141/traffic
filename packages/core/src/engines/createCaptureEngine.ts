import type { CaptureConfiguration } from "@local-traffic/protocol";
import { normalizeCaptureOptions, normalizeUpstreamProxy } from "@local-traffic/protocol/validation";
import { normalizeErrorMessage } from "../errors";
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
  const engine = createConfiguredCaptureEngine(dependencies);
  return {
    async start(input) {
      return engine.start(normalizeCaptureOptions(input));
    },
    stop: engine.stop,
  };
}

export function createConfiguredCaptureEngine(
  dependencies: CaptureEngineOptions,
): CaptureEngine<CaptureConfiguration> {
  let engine: CaptureEngine<CaptureConfiguration> | undefined;
  let systemMode = false;
  let currentAttempt: { error?: Error } | undefined;

  async function stop(): Promise<void> {
    if (systemMode) await dependencies.proxyLease.restore();
    systemMode = false;
    currentAttempt = undefined;
    await engine?.stop();
    engine = undefined;
  }

  return {
    async start(options) {
      await stop();
      const paths = await dependencies.resolvePaths();
      systemMode = options.mode === "system-proxy";
      const normalized = { ...options };
      if (options.mode === "system-proxy") {
        if (!normalized.upstreamProxy) {
          const upstream = await dependencies.proxyLease.getUpstream();
          if (upstream) normalized.upstreamProxy = normalizeUpstreamProxy(upstream);
        }
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
      } else normalized.target = await dependencies.resolveTargets(options.target);

      const attempt: { error?: Error } = {};
      currentAttempt = attempt;
      const active = (dependencies.createEngine ?? createMitmCaptureEngine)({
        ...paths,
        ...dependencies.callbacks,
        onError(error) {
          if (currentAttempt !== attempt) return;
          attempt.error = error;
          void (async () => {
            try {
              if (systemMode) await dependencies.proxyLease.restore();
            } catch {
              error = new Error(`${error.message} 系统代理恢复失败，请手动检查代理设置。`);
            }
            if (currentAttempt === attempt) dependencies.callbacks.onError(error);
          })();
        },
      });
      engine = active;
      try {
        const certificate = systemMode
          ? await dependencies.getCertificateState(paths.confdir)
          : undefined;
        if (certificate?.ready && !certificate.trusted)
          throw new Error("请先点击信任 CA 证书，然后再启动系统代理模式。系统代理尚未修改。");
        const address = await active.start(normalized);
        if (attempt.error) throw attempt.error;
        if (systemMode) {
          const certificate = await dependencies.getCertificateState(paths.confdir);
          if (!certificate.trusted)
            throw new Error(
              "CA 证书已生成。请先点击信任 CA 证书，然后再次启动系统代理模式。系统代理尚未修改。",
            );
          if (attempt.error) throw attempt.error;
          await dependencies.proxyLease.activate(options.port);
          if (attempt.error) throw attempt.error;
        }
        return address;
      } catch (error) {
        try {
          await stop();
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `${normalizeErrorMessage(error)}；清理失败：${normalizeErrorMessage(cleanupError)}`,
          );
        }
        throw error;
      }
    },
    stop,
  };
}
