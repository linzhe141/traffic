import type { CaptureOptions, InvokeContract } from "./contracts";
import { normalizeCaptureTargets } from "./normalizeCaptureTargets";

export function normalizeCaptureOptions(input: unknown): CaptureOptions {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Capture options must be an object.");
  }
  const keys = Object.keys(input);
  const port = (input as Record<string, unknown>).port;
  if (
    keys.some((key) => !["port", "mode", "target", "upstreamProxy"].includes(key)) ||
    typeof port !== "number" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("Proxy port must be an integer between 1 and 65535.");
  }
  const options: CaptureOptions = { port };
  const mode = (input as Record<string, unknown>).mode;
  if (mode !== undefined) {
    if (mode !== "local" && mode !== "system-proxy") throw new Error("抓取模式无效。");
    options.mode = mode;
  }
  const { target, upstreamProxy } = input as Record<string, unknown>;
  if (target !== undefined) {
    options.target = normalizeCaptureTargets(target);
  }
  if (upstreamProxy !== undefined && upstreamProxy !== "") {
    if (typeof upstreamProxy !== "string" || upstreamProxy.length > 2048)
      throw new Error("上游代理地址无效。");
    const upstream = new URL(upstreamProxy);
    if (
      !["http:", "https:"].includes(upstream.protocol) ||
      upstream.username ||
      upstream.password ||
      upstream.search ||
      upstream.hash ||
      upstream.pathname !== "/"
    ) {
      throw new Error("上游代理仅支持不带认证的 HTTP/HTTPS 地址，例如 http://127.0.0.1:7890。");
    }
    options.upstreamProxy = upstream.origin;
  }
  return options;
}

export function validateInvokeInput<K extends keyof InvokeContract>(
  channel: K,
  input: unknown,
): InvokeContract[K]["input"] {
  if (channel === "clipboard:write") {
    if (typeof input !== "string") throw new Error("剪贴板内容须为文本。");
    return input as InvokeContract[K]["input"];
  }
  if (channel === "process:icon") {
    if (
      typeof input !== "string" ||
      input.length > 4096 ||
      !/^[a-z]:[\\/][^\\/:][^:\0]*\.exe$/i.test(input) ||
      input.split(/[\\/]/).some((part) => part === "..")
    ) {
      throw new Error("无效的本地可执行文件路径。");
    }
    return input as InvokeContract[K]["input"];
  }
  if (channel === "traffic:body") {
    const value = input as Record<string, unknown> | null;
    if (
      !value ||
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
    return { id: value.id, side: value.side, offset: value.offset } as InvokeContract[K]["input"];
  }
  if (channel === "capture:start") {
    return normalizeCaptureOptions(input) as InvokeContract[K]["input"];
  }
  if (input !== undefined) throw new Error(`${channel} does not accept arguments.`);
  return undefined as InvokeContract[K]["input"];
}
