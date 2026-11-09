export interface HeaderEntry {
  name: string;
  value: string;
}
export interface CapturedBody {
  text: string;
  bytes: number;
  truncated: boolean;
  encoding: "utf8" | "base64";
  tail?: boolean;
  stored?: { available: number; generation: number; binary: boolean };
}
export type BodySide = "request" | "response";
export interface ProcessIconVariants {
  light: string;
  dark: string;
}
export interface BodyPageRequest {
  id: string;
  side: BodySide;
  offset: number;
}
export interface BodyPage {
  data: Uint8Array;
  nextOffset: number;
  available: number;
  generation: number;
  binary: boolean;
}
export interface TrafficSourceApp {
  name: string;
  pid?: number;
  executablePath?: string;
}
export interface WebSocketMessagePreview {
  sequence: number;
  direction: "sent" | "received";
  timestamp: number;
  bytes: number;
  encoding: CapturedBody["encoding"];
  text: string;
}
export interface TrafficRecord {
  id: string;
  sequence: number;
  method: string;
  url: string;
  host: string;
  path: string;
  protocol: string;
  kind: "http" | "tunnel";
  state: "pending" | "complete" | "failed";
  startedAt: number;
  durationMs: number;
  statusCode: number | null;
  requestHeaders: HeaderEntry[];
  responseHeaders: HeaderEntry[];
  requestBody: CapturedBody;
  responseBody: CapturedBody;
  clientAddress: string;
  sourceApp?: TrafficSourceApp;
  websocket?: {
    messages: WebSocketMessagePreview[];
    messageCount: number;
    closeCode: number | null;
  };
  error?: string;
}
export type CaptureMode = "local" | "system-proxy";

export interface CaptureOptions {
  port: number;
  mode?: CaptureMode;
  target?: string;
  upstreamProxy?: string;
}

export type CaptureConfiguration = Omit<CaptureOptions, "mode" | "target"> &
  ({ mode: "local"; target: string } | { mode: "system-proxy"; target?: string });
export interface EngineInfo {
  available: boolean;
  executablePath: string;
  version: string;
  certificatePath: string;
  certificateReady: boolean;
  certificateTrusted: boolean;
  loopbackProxyEnabled?: boolean;
  systemProxyUpstream?: string;
  error?: string;
}
export interface DetectedProcess {
  name: string;
  displayName: string;
  pids: number[];
  target: string;
  category: "app" | "cli" | "process";
  searchTerms?: string[];
  executablePath?: string;
}
export interface CaptureStatus {
  state: "stopped" | "starting" | "recording" | "stopping";
  host: string;
  port: number;
  error?: string;
  target?: string;
  mode?: CaptureMode;
}
export interface CaptureDiagnostic {
  id: string;
  kind: "connection" | "tls-client-failed" | "tls-server-failed" | "non-http";
  message: string;
  clientAddress: string;
  host: string;
  timestamp: number;
}
export interface TrafficSnapshot {
  records: TrafficRecord[];
  status: CaptureStatus;
  revision: number;
  diagnostics?: CaptureDiagnostic[];
}
