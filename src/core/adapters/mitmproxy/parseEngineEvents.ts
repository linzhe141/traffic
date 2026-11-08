import { StringDecoder } from "node:string_decoder";
import type {
  CapturedBody,
  CaptureDiagnostic,
  HeaderEntry,
  TrafficRecord,
} from "../../../shared/contracts";
import type { CapturedBodyChunk } from "../../engines/types";

export const EVENT_PREFIX = "TRAFFIC_EVENT:";
const MAX_LINE = 1024 * 1024;
type UnknownObject = Record<string, unknown>;
const object = (value: unknown): value is UnknownObject =>
  !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const string = (value: unknown, limit = 8192): value is string =>
  typeof value === "string" && value.length <= limit;

function validateHeaders(value: unknown): value is HeaderEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= 256 &&
    value.every((entry) => object(entry) && string(entry.name, 1024) && string(entry.value, 8192))
  );
}
function validateBody(value: unknown): value is CapturedBody {
  return (
    object(value) &&
    string(value.text, 90_000) &&
    number(value.bytes) &&
    typeof value.truncated === "boolean" &&
    (value.encoding === "utf8" || value.encoding === "base64") &&
    (value.tail === undefined || typeof value.tail === "boolean")
  );
}
function validateSourceApp(value: unknown): boolean {
  return (
    object(value) &&
    string(value.name, 512) &&
    value.name.length > 0 &&
    (value.pid === undefined ||
      (number(value.pid) &&
        Number.isInteger(value.pid) &&
        value.pid > 0 &&
        value.pid <= 0xffffffff)) &&
    (value.executablePath === undefined || string(value.executablePath, 8192))
  );
}
function validateWebSocket(value: unknown): boolean {
  return (
    object(value) &&
    number(value.messageCount) &&
    Number.isSafeInteger(value.messageCount) &&
    (value.closeCode === null ||
      (number(value.closeCode) && Number.isInteger(value.closeCode) && value.closeCode <= 65535)) &&
    Array.isArray(value.messages) &&
    value.messages.length <= 64 &&
    value.messages.every(
      (message) =>
        object(message) &&
        number(message.sequence) &&
        Number.isSafeInteger(message.sequence) &&
        (message.direction === "sent" || message.direction === "received") &&
        number(message.timestamp) &&
        number(message.bytes) &&
        string(message.text, 2048) &&
        (message.encoding === "utf8" || message.encoding === "base64"),
    )
  );
}
export function validateTrafficRecord(value: unknown): value is TrafficRecord {
  if (!object(value)) return false;
  return (
    string(value.id, 128) &&
    number(value.sequence) &&
    string(value.method, 64) &&
    string(value.url, 16384) &&
    string(value.host, 1024) &&
    string(value.path, 16384) &&
    string(value.protocol, 64) &&
    ["http", "tunnel"].includes(String(value.kind)) &&
    ["pending", "complete", "failed"].includes(String(value.state)) &&
    number(value.startedAt) &&
    number(value.durationMs) &&
    (value.statusCode === null ||
      (number(value.statusCode) &&
        Number.isInteger(value.statusCode) &&
        value.statusCode <= 999)) &&
    validateHeaders(value.requestHeaders) &&
    validateHeaders(value.responseHeaders) &&
    validateBody(value.requestBody) &&
    validateBody(value.responseBody) &&
    string(value.clientAddress, 1024) &&
    (value.error === undefined || string(value.error, 8192)) &&
    (value.sourceApp === undefined || validateSourceApp(value.sourceApp)) &&
    (value.websocket === undefined || validateWebSocket(value.websocket))
  );
}

export interface EngineEventHandlers {
  onReady(): void;
  onRecord(record: TrafficRecord): void;
  onError(error: Error): void;
  onDiagnostic?(diagnostic: CaptureDiagnostic): void;
  onLog?(line: string): void;
  onBodyChunk?(chunk: CapturedBodyChunk): void;
}

function validateBodyChunk(value: unknown): value is CapturedBodyChunk {
  return (
    object(value) &&
    string(value.id, 128) &&
    (value.side === "request" || value.side === "response") &&
    string(value.contentEncoding, 256) &&
    string(value.contentType, 1024) &&
    string(value.data, 90_000) &&
    value.data.length > 0
  );
}

export function validateCaptureDiagnostic(value: unknown): value is CaptureDiagnostic {
  return (
    object(value) &&
    string(value.id, 128) &&
    ["connection", "tls-client-failed", "tls-server-failed", "non-http"].includes(
      String(value.kind),
    ) &&
    string(value.message, 2048) &&
    string(value.clientAddress, 1024) &&
    string(value.host, 1024) &&
    number(value.timestamp)
  );
}

/** Bounded, UTF-8 aware framing. Protocol events and ordinary logs stay separate. */
export function createEngineEventParser(token: string, handlers: EngineEventHandlers) {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let dropping = false;
  const processLine = (line: string) => {
    if (!line.startsWith(EVENT_PREFIX)) {
      if (line.trim()) handlers.onLog?.(line);
      return;
    }
    try {
      const event: unknown = JSON.parse(line.slice(EVENT_PREFIX.length));
      if (!object(event) || event.token !== token) throw new Error("Invalid engine event token");
      if (event.type === "ready") handlers.onReady();
      else if (event.type === "record" && validateTrafficRecord(event.record))
        handlers.onRecord(event.record);
      else if (event.type === "body" && validateBodyChunk(event.chunk))
        handlers.onBodyChunk?.(event.chunk);
      else if (event.type === "diagnostic" && validateCaptureDiagnostic(event.diagnostic))
        handlers.onDiagnostic?.(event.diagnostic);
      else if (event.type === "error" && string(event.error, 8192))
        handlers.onError(new Error(event.error));
      else throw new Error("Invalid engine event schema");
    } catch (error) {
      handlers.onError(error instanceof Error ? error : new Error("Invalid engine event"));
    }
  };
  function processText(decoded: string): void {
    for (const character of decoded) {
      if (character === "\n") {
        if (!dropping) processLine(pending.replace(/\r$/, ""));
        pending = "";
        dropping = false;
      } else if (!dropping) {
        pending += character;
        if (pending.length > MAX_LINE) {
          pending = "";
          dropping = true;
          handlers.onError(new Error("Engine event exceeded maximum line length"));
        }
      }
    }
  }
  return {
    push(chunk: Buffer) {
      processText(decoder.write(chunk));
    },
    finish() {
      processText(decoder.end());
      if (pending && !dropping) processLine(pending.replace(/\r$/, ""));
      pending = "";
      dropping = false;
    },
  };
}
