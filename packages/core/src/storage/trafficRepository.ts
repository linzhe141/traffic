import type { TrafficRecord } from "@local-traffic/protocol";

export interface TrafficRepository {
  /** Returns the IDs evicted by this write. */
  upsertRecord(record: TrafficRecord, allowInsert?: boolean): readonly string[];
  listRecords(): TrafficRecord[];
  clearRecords(): void;
}

interface RepositoryOptions {
  maxRecords?: number;
  maxPreviewBytes?: number;
}

function measureRecordPreview(record: TrafficRecord): number {
  return (
    Buffer.byteLength(record.requestBody.text) +
    Buffer.byteLength(record.responseBody.text) +
    (record.websocket?.messages.reduce(
      (bytes, message) => bytes + Buffer.byteLength(message.text),
      0,
    ) ?? 0)
  );
}

export function createMemoryTrafficRepository(options: RepositoryOptions = {}): TrafficRepository {
  const maxRecords = options.maxRecords ?? 500;
  const maxPreviewBytes = options.maxPreviewBytes ?? 16 * 1024 * 1024;
  const records = new Map<string, TrafficRecord>();
  let previewBytes = 0;

  function removeRecord(id: string): void {
    const record = records.get(id);
    if (!record) return;
    previewBytes -= measureRecordPreview(record);
    records.delete(id);
  }

  return {
    upsertRecord(record, allowInsert = true) {
      // A final update must not resurrect an evicted or explicitly cleared request.
      if (!records.has(record.id) && (!allowInsert || record.state !== "pending")) return [];
      const previous = records.get(record.id);
      if (previous) previewBytes -= measureRecordPreview(previous);
      const stored = structuredClone(record);
      records.set(record.id, stored);
      previewBytes += measureRecordPreview(stored);
      const evicted: string[] = [];
      while (records.size > maxRecords || previewBytes > maxPreviewBytes) {
        const oldestId = records.keys().next().value;
        if (oldestId === undefined) break;
        removeRecord(oldestId);
        evicted.push(oldestId);
      }
      return evicted;
    },
    listRecords: () => structuredClone([...records.values()]),
    clearRecords() {
      records.clear();
      previewBytes = 0;
    },
  };
}
