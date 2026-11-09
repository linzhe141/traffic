import * as zlib from "node:zlib";
import type { BodyPage, BodyPageRequest, BodySide, CapturedBody } from "@local-traffic/protocol";
import type { CapturedBodyChunk } from "../engines/types";

const PAGE_BYTES = 32 * 1024;
type Decoder =
  | ReturnType<typeof zlib.createGunzip>
  | ReturnType<typeof zlib.createInflate>
  | ReturnType<typeof zlib.createBrotliDecompress>
  | ReturnType<typeof zlib.createZstdDecompress>;

class BodyBuffer {
  private readonly chunks: { offset: number; data: Buffer }[] = [];
  length = 0;

  append(data: Buffer) {
    if (!data.length) return;
    this.chunks.push({ offset: this.length, data });
    this.length += data.length;
  }

  read(offset: number) {
    const end = Math.min(offset + PAGE_BYTES, this.length);
    const result = new Uint8Array(Math.max(0, end - offset));
    let lower = 0;
    let upper = this.chunks.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      const chunk = this.chunks[middle]!;
      if (chunk.offset + chunk.data.length <= offset) lower = middle + 1;
      else upper = middle;
    }
    for (let index = lower, position = offset; position < end; index++) {
      const chunk = this.chunks[index]!;
      const bytes = chunk.data.subarray(position - chunk.offset, end - chunk.offset);
      result.set(bytes, position - offset);
      position += bytes.length;
    }
    return result;
  }
}

function createDecoder(encoding: string): Decoder | undefined {
  switch (encoding) {
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip();
    case "deflate":
      return zlib.createInflate();
    case "br":
      return zlib.createBrotliDecompress();
    case "zstd":
      return zlib.createZstdDecompress?.();
  }
}

class StoredBody {
  private readonly raw = new BodyBuffer();
  private decoded: BodyBuffer;
  private readonly decoder?: Decoder;
  private binary: boolean;
  private generation = 0;
  private finished = false;

  constructor(chunk: CapturedBodyChunk, changed: () => void) {
    const encoding = chunk.contentEncoding.trim().toLowerCase();
    const encoded = encoding !== "" && encoding !== "identity";
    this.decoder = createDecoder(encoding);
    this.binary =
      (encoded && !this.decoder) ||
      /^(?:image\/(?!svg\+xml)|audio\/|video\/|font\/|application\/(?:octet-stream|pdf|zip))/i.test(
        chunk.contentType,
      );
    this.decoded = this.decoder ? new BodyBuffer() : this.raw;
    this.decoder?.on("data", (bytes: Buffer) => {
      this.decoded.append(bytes);
      changed();
    });
    this.decoder?.on("error", () => {
      this.decoded = this.raw;
      this.binary = true;
      this.generation++;
      changed();
    });
  }

  append(bytes: Buffer) {
    this.raw.append(bytes);
    if (!this.decoder?.destroyed) this.decoder?.write(bytes);
  }

  metadata(): NonNullable<CapturedBody["stored"]> {
    return { available: this.decoded.length, generation: this.generation, binary: this.binary };
  }

  page(offset: number): BodyPage {
    const data = this.decoded.read(offset);
    return { ...this.metadata(), data, nextOffset: offset + data.length };
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    if (!this.decoder?.destroyed) this.decoder?.end();
  }

  dispose() {
    this.decoder?.destroy();
  }
}

export function createBodyStore(changed: () => void) {
  const flows = new Map<string, Partial<Record<BodySide, StoredBody>>>();
  function remove(id: string) {
    for (const body of Object.values(flows.get(id) ?? {})) body.dispose();
    flows.delete(id);
  }
  return {
    append(chunk: CapturedBodyChunk) {
      let flow = flows.get(chunk.id);
      if (!flow) flows.set(chunk.id, (flow = {}));
      const body = (flow[chunk.side] ??= new StoredBody(chunk, changed));
      body.append(Buffer.from(chunk.data, "base64"));
    },
    finish(id: string) {
      for (const body of Object.values(flows.get(id) ?? {})) body.finish();
    },
    remove,
    clear() {
      for (const id of flows.keys()) remove(id);
    },
    metadata(id: string, side: BodySide) {
      return flows.get(id)?.[side]?.metadata();
    },
    read({ id, side, offset }: BodyPageRequest) {
      return flows.get(id)?.[side]?.page(offset) ?? null;
    },
  };
}
