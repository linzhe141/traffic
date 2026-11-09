import type { TrafficApi } from "../../../shared/desktopApi";
import type { BodyPageRequest } from "@local-traffic/protocol";

export async function readCompleteBody(api: TrafficApi, request: Omit<BodyPageRequest, "offset">) {
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let offset = 0;
  let end: number | undefined;
  let generation: number | undefined;
  while (end === undefined || offset < end) {
    const page = await api.readBody({ ...request, offset });
    if (!page) throw new Error("这条记录的正文已释放。");
    end ??= page.available;
    generation ??= page.generation;
    if (generation !== page.generation || (offset < end && page.nextOffset <= offset)) {
      throw new Error("正文已更新，请重试。");
    }
    const data = page.data.subarray(0, end - offset);
    parts.push(
      page.binary
        ? Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join(" ")
        : decoder.decode(data, { stream: true }),
    );
    offset = page.nextOffset;
    if (offset >= end) {
      return page.binary ? parts.join(" ") : parts.join("") + decoder.decode();
    }
  }
  return parts.join("");
}

export function createHtmlPreview(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const element of template.content.querySelectorAll(
    "script, iframe, frame, object, embed, meta, base, link",
  )) {
    element.remove();
  }
  for (const element of template.content.querySelectorAll("a, area")) {
    element.removeAttribute("href");
    element.removeAttribute("xlink:href");
  }
  const policy =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body>${template.innerHTML}</body></html>`;
}
