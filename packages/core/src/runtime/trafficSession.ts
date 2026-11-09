import type { CaptureDiagnostic, TrafficRecord, TrafficSnapshot } from "@local-traffic/protocol";
import type { CapturedBodyChunk } from "../engines/types";
import { createBodyStore } from "../storage/bodyStore";
import type { TrafficRepository } from "../storage/trafficRepository";

export function createTrafficSession(repository: TrafficRepository, changed: () => void) {
  // Keep hidden flows until their final event so a later pending update cannot reinsert them.
  const pending = new Map<string, "visible" | "hidden">();
  const diagnostics: CaptureDiagnostic[] = [];
  const bodies = createBodyStore(changed);

  function storeRecord(record: TrafficRecord, allowInsert: boolean) {
    for (const id of repository.upsertRecord(record, allowInsert)) {
      bodies.remove(id);
      if (pending.has(id)) pending.set(id, "hidden");
    }
  }

  return {
    record(record: TrafficRecord): void {
      const visibility = pending.get(record.id);
      if (!visibility && record.state !== "pending") return;
      if (!visibility) pending.set(record.id, "visible");
      if (visibility !== "hidden") {
        const { id, requestBody, responseBody } = record;
        storeRecord(
          {
            ...record,
            requestBody: bodies.metadata(id, "request")
              ? { ...requestBody, text: "" }
              : requestBody,
            responseBody: bodies.metadata(id, "response")
              ? { ...responseBody, text: "" }
              : responseBody,
          },
          !visibility,
        );
      }
      if (record.state !== "pending") {
        bodies.finish(record.id);
        pending.delete(record.id);
      }
      changed();
    },
    appendBody(chunk: CapturedBodyChunk): void {
      if (pending.get(chunk.id) !== "visible") return;
      bodies.append(chunk);
      changed();
    },
    addDiagnostic(diagnostic: CaptureDiagnostic): void {
      diagnostics.push(structuredClone(diagnostic));
      if (diagnostics.length > 100) diagnostics.shift();
      changed();
    },
    finishPending(message: string): void {
      for (const record of repository.listRecords()) {
        if (record.state !== "pending") continue;
        bodies.finish(record.id);
        storeRecord(
          {
            ...record,
            state: "failed",
            error: message,
            durationMs: Math.max(0, Date.now() - record.startedAt),
          },
          false,
        );
      }
      pending.clear();
    },
    snapshot(): Pick<TrafficSnapshot, "records" | "diagnostics"> {
      const records = repository.listRecords();
      for (const record of records) {
        const request = bodies.metadata(record.id, "request");
        const response = bodies.metadata(record.id, "response");
        if (request)
          record.requestBody = {
            ...record.requestBody,
            text: "",
            truncated: false,
            stored: request,
          };
        if (response)
          record.responseBody = {
            ...record.responseBody,
            text: "",
            truncated: false,
            stored: response,
          };
      }
      return { records, diagnostics: structuredClone(diagnostics) };
    },
    readBody: bodies.read,
    clear(): void {
      repository.clearRecords();
      bodies.clear();
      diagnostics.length = 0;
      for (const id of pending.keys()) pending.set(id, "hidden");
      changed();
    },
    dispose: bodies.clear,
  };
}
