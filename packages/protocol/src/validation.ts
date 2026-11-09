import type { BodyPageRequest, CaptureConfiguration } from "./contracts";
import { normalizeCaptureTargets } from "./normalizeCaptureTargets";
import { isObject } from "./trafficValidation";

export {
  isBoundedString,
  isObject,
  validateCaptureDiagnostic,
  validateTrafficRecord,
} from "./trafficValidation";

export function normalizeCaptureOptions(input: unknown): CaptureConfiguration {
  if (!isObject(input)) {
    throw new Error("Capture options must be an object.");
  }
  const keys = Object.keys(input);
  const { port, mode = "local", target, upstreamProxy } = input;
  if (
    keys.some((key) => !["port", "mode", "target", "upstreamProxy"].includes(key)) ||
    typeof port !== "number" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("Proxy port must be an integer between 1 and 65535.");
  }
  if (mode !== "local" && mode !== "system-proxy") throw new Error("抓取模式无效。");
  const options: { port: number; upstreamProxy?: string } = { port };
  if (upstreamProxy !== undefined && upstreamProxy !== "") {
    if (typeof upstreamProxy !== "string" || upstreamProxy.length > 2048)
      throw new Error("上游代理地址无效。");
    options.upstreamProxy = normalizeUpstreamProxy(upstreamProxy);
  }
  if (mode === "local") return { ...options, mode, target: normalizeCaptureTargets(target) };
  if (target === undefined) return { ...options, mode };
  const scope = normalizeCaptureTargets(target);
  if (!/^\d+(,\d+)*$/.test(scope)) throw new Error("系统代理的应用范围须使用进程 ID。");
  return { ...options, mode, target: scope };
}

export function normalizeUpstreamProxy(value: string): string {
  const upstream = URL.parse(value);
  if (
    !upstream ||
    !["http:", "https:"].includes(upstream.protocol) ||
    upstream.username ||
    upstream.password ||
    upstream.search ||
    upstream.hash ||
    upstream.pathname !== "/"
  ) {
    throw new Error("上游代理仅支持不带认证的 HTTP/HTTPS 地址，例如 http://127.0.0.1:7890。");
  }
  return upstream.origin;
}

export function normalizeBodyPageRequest(value: unknown): BodyPageRequest {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 128 ||
    (value.side !== "request" && value.side !== "response") ||
    typeof value.offset !== "number" ||
    !Number.isSafeInteger(value.offset) ||
    value.offset < 0
  ) {
    throw new Error("正文读取参数无效。");
  }
  return { id: value.id, side: value.side, offset: value.offset };
}
