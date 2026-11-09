import type { CapturedBody, CaptureDiagnostic, HeaderEntry, TrafficRecord } from "./contracts";

type UnknownObject = Record<string, unknown>;
export const isObject = (value: unknown): value is UnknownObject =>
  !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
export const isBoundedString = (value: unknown, limit = 8192): value is string =>
  typeof value === "string" && value.length <= limit;

function validateHeaders(value: unknown): value is HeaderEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= 256 &&
    value.every(
      (entry) =>
        isObject(entry) && isBoundedString(entry.name, 1024) && isBoundedString(entry.value, 8192),
    )
  );
}
function validateBody(value: unknown): value is CapturedBody {
  return (
    isObject(value) &&
    isBoundedString(value.text, 90_000) &&
    number(value.bytes) &&
    typeof value.truncated === "boolean" &&
    (value.encoding === "utf8" || value.encoding === "base64") &&
    (value.tail === undefined || typeof value.tail === "boolean") &&
    (value.stored === undefined ||
      (isObject(value.stored) &&
        isOffset(value.stored.available) &&
        isOffset(value.stored.generation) &&
        typeof value.stored.binary === "boolean"))
  );
}
function validateSourceApp(value: unknown): boolean {
  return (
    isObject(value) &&
    isBoundedString(value.name, 512) &&
    value.name.length > 0 &&
    (value.pid === undefined ||
      (number(value.pid) &&
        Number.isInteger(value.pid) &&
        value.pid > 0 &&
        value.pid <= 0xffffffff)) &&
    (value.executablePath === undefined || isBoundedString(value.executablePath, 8192))
  );
}
function validateWebSocket(value: unknown): boolean {
  return (
    isObject(value) &&
    number(value.messageCount) &&
    Number.isSafeInteger(value.messageCount) &&
    (value.closeCode === null ||
      (number(value.closeCode) && Number.isInteger(value.closeCode) && value.closeCode <= 65535)) &&
    Array.isArray(value.messages) &&
    value.messages.length <= 64 &&
    value.messages.every(
      (message) =>
        isObject(message) &&
        number(message.sequence) &&
        Number.isSafeInteger(message.sequence) &&
        (message.direction === "sent" || message.direction === "received") &&
        number(message.timestamp) &&
        number(message.bytes) &&
        isBoundedString(message.text, 2048) &&
        (message.encoding === "utf8" || message.encoding === "base64"),
    )
  );
}
export function validateTrafficRecord(value: unknown): value is TrafficRecord {
  if (!isObject(value)) return false;
  return (
    isBoundedString(value.id, 128) &&
    number(value.sequence) &&
    isBoundedString(value.method, 64) &&
    isBoundedString(value.url, 16384) &&
    isBoundedString(value.host, 1024) &&
    isBoundedString(value.path, 16384) &&
    isBoundedString(value.protocol, 64) &&
    (value.kind === "http" || value.kind === "tunnel") &&
    (value.state === "pending" || value.state === "complete" || value.state === "failed") &&
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
    isBoundedString(value.clientAddress, 1024) &&
    (value.error === undefined || typeof value.error === "string") &&
    (value.sourceApp === undefined || validateSourceApp(value.sourceApp)) &&
    (value.websocket === undefined || validateWebSocket(value.websocket))
  );
}

export function validateCaptureDiagnostic(value: unknown): value is CaptureDiagnostic {
  return (
    isObject(value) &&
    isBoundedString(value.id, 128) &&
    (value.kind === "connection" ||
      value.kind === "tls-client-failed" ||
      value.kind === "tls-server-failed" ||
      value.kind === "non-http") &&
    isBoundedString(value.message, 2048) &&
    isBoundedString(value.clientAddress, 1024) &&
    isBoundedString(value.host, 1024) &&
    number(value.timestamp)
  );
}

export function isOffset(value: unknown): value is number {
  return number(value) && Number.isSafeInteger(value);
}
