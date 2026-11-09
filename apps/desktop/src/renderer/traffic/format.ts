import type { CapturedBody, TrafficRecord } from "@local-traffic/protocol";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
export function formatTime(timestamp: number): string {
  return (
    new Date(timestamp).toLocaleTimeString("en-GB", { hour12: false }) +
    `.${String(Math.floor(timestamp) % 1000).padStart(3, "0")}`
  );
}
export function formatStatus(record: TrafficRecord): string {
  if (record.state === "failed") return "Failed";
  if (record.state === "pending")
    return record.websocket || (record.kind === "tunnel" && record.statusCode === 200)
      ? "Open"
      : "Pending";
  return String(record.statusCode ?? "—");
}
export function formatBody(body: CapturedBody): string {
  if (!body.text) return "No body captured";
  if (body.encoding === "base64" || body.truncated) return body.text;
  try {
    return JSON.stringify(JSON.parse(body.text), null, 2);
  } catch {
    return body.text;
  }
}
export function buildContentType(record: TrafficRecord): string {
  if (record.websocket) return "WebSocket";
  if (record.kind === "tunnel") return "Tunnel";
  const value =
    record.responseHeaders.find((header) => header.name.toLowerCase() === "content-type")?.value ??
    "";
  if (value.includes("json")) return "JSON";
  if (value.includes("html")) return "HTML";
  if (value.split(";")[0]?.trim().toLowerCase() === "text/event-stream") return "SSE";
  return value.split(";")[0]?.split("/").pop()?.toUpperCase() || "—";
}
