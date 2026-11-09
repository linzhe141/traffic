import type { InvokeContract } from "../../shared/desktopApi";
import { normalizeBodyPageRequest, normalizeCaptureOptions } from "@local-traffic/protocol/validation";

function noInput(input: unknown): undefined {
  if (input !== undefined) throw new Error("This IPC channel does not accept arguments.");
  return undefined;
}

function parseExecutablePath(input: unknown): string {
  if (
    typeof input !== "string" ||
    input.length > 4096 ||
    !/^[a-z]:[\\/][^\\/:][^:\0]*\.exe$/i.test(input) ||
    input.split(/[\\/]/).some((part) => part === "..")
  ) {
    throw new Error("无效的本地可执行文件路径。");
  }
  return input;
}

const inputParsers: {
  [K in keyof InvokeContract]: (input: unknown) => InvokeContract[K]["input"];
} = {
  "capture:start": normalizeCaptureOptions,
  "capture:stop": noInput,
  "traffic:snapshot": noInput,
  "traffic:clear": noInput,
  "traffic:body": normalizeBodyPageRequest,
  "clipboard:write": (input) => {
    if (typeof input !== "string") throw new Error("剪贴板内容须为文本。");
    return input;
  },
  "process:icon": parseExecutablePath,
  "engine:info": noInput,
  "certificate:reveal": noInput,
  "certificate:trust": noInput,
  "process:list": noInput,
};

export function validateInvokeInput<K extends keyof InvokeContract>(
  channel: K,
  input: unknown,
): InvokeContract[K]["input"] {
  return inputParsers[channel](input);
}
