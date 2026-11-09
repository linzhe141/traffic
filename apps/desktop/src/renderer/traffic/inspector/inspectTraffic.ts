import type { CapturedBody, HeaderEntry } from "@local-traffic/protocol";
import type { CodeLanguage } from "./highlightCode";

export function detectCodeLanguage(code: string, contentType = ""): CodeLanguage {
  const type = contentType.toLowerCase();
  if (type.includes("json") || /^\s*[[{]/.test(code)) return "json";
  if (type.includes("html")) return "html";
  if (type.includes("xml")) return "xml";
  if (type.includes("javascript") || type.includes("ecmascript")) return "javascript";
  if (type.includes("css")) return "css";
  return "text";
}

export function queryEntries(url: string): HeaderEntry[] {
  const parsed = URL.parse(url);
  return parsed ? [...parsed.searchParams].map(([name, value]) => ({ name, value })) : [];
}

export function requestCookies(headers: HeaderEntry[]): HeaderEntry[] {
  return headers
    .filter((header) => header.name.toLowerCase() === "cookie")
    .flatMap((header) => header.value.split(";"))
    .flatMap((cookie) => {
      const delimiter = cookie.indexOf("=");
      const name = cookie.slice(0, delimiter).trim();
      return delimiter > 0 && name ? [{ name, value: cookie.slice(delimiter + 1).trim() }] : [];
    });
}

export function formatMessagePreview(start: string, headers: HeaderEntry[], body: CapturedBody) {
  const headerText = headers.map(({ name, value }) => `${name}: ${value}`).join("\n");
  return [start, headerText].filter(Boolean).join("\n") + "\n\n" + body.text;
}
