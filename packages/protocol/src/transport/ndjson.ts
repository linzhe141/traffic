import type { Readable, Writable } from "node:stream";

export const MAX_FRAME_BYTES = 64 * 1024 * 1024;

export function encodeFrame(message: unknown): string {
  const frame = JSON.stringify(message) + "\n";
  if (Buffer.byteLength(frame) > MAX_FRAME_BYTES) throw new Error("CLI frame exceeds 64 MiB");
  return frame;
}

export function readFrames(
  input: Readable,
  handlers: {
    onMessage(value: unknown): void;
    onInvalid(error: Error): void;
    onEnd(): void;
  },
) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let chunks: Buffer[] = [];
  let bytes = 0;
  let discard = false;
  let stopped = false;

  function receive(chunk: Buffer) {
    for (let start = 0; start < chunk.length && !stopped;) {
      const newline = chunk.indexOf(10, start);
      const end = newline < 0 ? chunk.length : newline;
      if (!discard) {
        const piece = chunk.subarray(start, end);
        bytes += piece.length;
        if (bytes >= MAX_FRAME_BYTES) {
          chunks = [];
          bytes = 0;
          discard = true;
          handlers.onInvalid(new Error("CLI frame exceeds 64 MiB"));
        } else if (piece.length) chunks.push(piece);
      }
      if (newline < 0) return;
      if (!discard && bytes) {
        const line = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks, bytes);
        chunks = [];
        bytes = 0;
        let value: unknown;
        try {
          value = JSON.parse(decoder.decode(line));
        } catch {
          handlers.onInvalid(new Error("Invalid JSON frame"));
          start = newline + 1;
          continue;
        }
        handlers.onMessage(value);
      }
      discard = false;
      start = newline + 1;
    }
  }

  function finish() {
    if (stopped) return;
    if (bytes) handlers.onInvalid(new Error("CLI stream ended mid-frame"));
    handlers.onEnd();
  }

  input.on("data", receive);
  input.once("end", finish);
  return () => {
    stopped = true;
    chunks = [];
    input.off("data", receive);
    input.off("end", finish);
  };
}

export function writeFrame(output: Writable, message: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    output.write(encodeFrame(message), (error) => (error ? reject(error) : resolve()));
  });
}
