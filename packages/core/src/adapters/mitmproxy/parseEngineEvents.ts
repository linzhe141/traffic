import { StringDecoder } from "node:string_decoder";
import type { CaptureDiagnostic, TrafficRecord } from "@local-traffic/protocol";
import {
  isObject,
  isBoundedString,
  validateCaptureDiagnostic,
  validateTrafficRecord,
} from "@local-traffic/protocol/validation";
import type { CapturedBodyChunk } from "../../engines/types";

export const EVENT_PREFIX = "TRAFFIC_EVENT:";
const MAX_LINE = 1024 * 1024;
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
    isObject(value) &&
    isBoundedString(value.id, 128) &&
    (value.side === "request" || value.side === "response") &&
    isBoundedString(value.contentEncoding, 256) &&
    isBoundedString(value.contentType, 1024) &&
    isBoundedString(value.data, 90_000) &&
    value.data.length > 0
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
      if (!isObject(event) || event.token !== token) throw new Error("Invalid engine event token");
      if (event.type === "ready") handlers.onReady();
      else if (event.type === "record" && validateTrafficRecord(event.record))
        handlers.onRecord(event.record);
      else if (event.type === "body" && validateBodyChunk(event.chunk))
        handlers.onBodyChunk?.(event.chunk);
      else if (event.type === "diagnostic" && validateCaptureDiagnostic(event.diagnostic))
        handlers.onDiagnostic?.(event.diagnostic);
      else if (event.type === "error" && isBoundedString(event.error, 8192))
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
