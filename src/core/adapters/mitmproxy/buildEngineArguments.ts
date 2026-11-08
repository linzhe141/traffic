import type { CaptureOptions } from "../../../shared/contracts";
import { normalizeCaptureTargets } from "../../../shared/normalizeCaptureTargets";

export function buildEngineArguments(
  options: CaptureOptions,
  addonPath: string,
  confdir: string,
): string[] {
  const mode =
    options.mode === "system-proxy"
      ? options.upstreamProxy
        ? `upstream:${options.upstreamProxy}`
        : "regular"
      : `local:${normalizeCaptureTargets(options.target)}`;
  if (options.mode === "system-proxy" && options.target && !/^\d+(,\d+)*$/.test(options.target)) {
    throw new Error("系统代理的应用范围须使用进程 ID。");
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535)
    throw new Error("Invalid capture port");
  if (options.upstreamProxy) {
    let proxy: URL;
    try {
      proxy = new URL(options.upstreamProxy);
    } catch {
      throw new Error("Invalid upstream HTTP proxy URL");
    }
    if (
      !["http:", "https:"].includes(proxy.protocol) ||
      proxy.username ||
      proxy.password ||
      proxy.pathname !== "/" ||
      proxy.search ||
      proxy.hash
    ) {
      throw new Error(
        "Only HTTP(S) upstream proxies without credentials are supported; SOCKS is not supported",
      );
    }
  }
  return [
    "--quiet",
    "--mode",
    mode,
    "--listen-host",
    "127.0.0.1",
    "--listen-port",
    String(options.port),
    "--set",
    `confdir=${confdir}`,
    "--set",
    "connection_strategy=lazy",
    "--set",
    "upstream_cert=false",
    "--set",
    "http3=false",
    "--set",
    "flow_detail=0",
    "--set",
    "termlog_verbosity=error",
    "-s",
    addonPath,
  ];
}
