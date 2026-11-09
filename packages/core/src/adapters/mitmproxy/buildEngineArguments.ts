import type { CaptureConfiguration } from "@local-traffic/protocol";

export function buildEngineArguments(
  options: CaptureConfiguration,
  addonPath: string,
  confdir: string,
): string[] {
  const mode =
    options.mode === "system-proxy"
      ? options.upstreamProxy
        ? `upstream:${options.upstreamProxy}`
        : "regular"
      : `local:${options.target}`;
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
