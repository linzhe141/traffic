import type { TrafficRecord } from "../../shared/contracts";

export const protocolFilters = ["HTTP", "HTTPS", "WebSocket", "SSE"] as const;
export const contentFilters = [
  "JSON",
  "XML",
  "Form",
  "JS",
  "CSS",
  "Document",
  "Media",
  "GraphQL",
  "Other",
] as const;
export type ProtocolFilter = (typeof protocolFilters)[number] | "";
export type ContentFilter = (typeof contentFilters)[number] | "";

export function getMediaType(record: TrafficRecord) {
  return (
    (
      record.responseHeaders.find((header) => header.name.toLowerCase() === "content-type") ??
      record.requestHeaders.find((header) => header.name.toLowerCase() === "content-type")
    )?.value
      .split(";")[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

export function matchesProtocol(record: TrafficRecord, filter: ProtocolFilter) {
  switch (filter) {
    case "HTTP":
      return record.url.startsWith("http://") && !record.websocket;
    case "HTTPS":
      return record.url.startsWith("https://") && !record.websocket;
    case "WebSocket":
      return Boolean(record.websocket);
    case "SSE":
      return getMediaType(record) === "text/event-stream";
    default:
      return true;
  }
}

export function getContentCategory(record: TrafficRecord): Exclude<ContentFilter, ""> {
  const type = getMediaType(record);
  if (type.includes("graphql") || /(?:^|\/)graphql(?:\/|\?|$)/i.test(record.path)) return "GraphQL";
  if (type.includes("json")) return "JSON";
  if (type.includes("xml")) return "XML";
  if (type.includes("form-urlencoded") || type === "multipart/form-data") return "Form";
  if (type.includes("javascript") || type.includes("ecmascript")) return "JS";
  if (type === "text/css") return "CSS";
  if (type === "text/html" || type === "text/plain" || type === "application/pdf")
    return "Document";
  if (/^(image|audio|video|font)\//.test(type)) return "Media";
  return "Other";
}
