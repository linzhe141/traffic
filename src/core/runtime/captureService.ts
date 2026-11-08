import type {
  CaptureDiagnostic,
  CaptureOptions,
  CaptureStatus,
  TrafficSnapshot,
} from "../../shared/contracts";
import type { TrafficRepository } from "../storage/trafficRepository";

import type { CaptureEngineFactory } from "../engines/types";
import { normalizeErrorMessage } from "../errors";
import { createBodyStore } from "../storage/bodyStore";

export function createCaptureService(
  repository: TrafficRepository,
  createEngine: CaptureEngineFactory,
) {
  let status: CaptureStatus = { state: "stopped", host: "127.0.0.1", port: 9090 };
  let revision = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(snapshot: TrafficSnapshot) => void>();
  const activeRecords = new Map<string, boolean>();
  const diagnostics: CaptureDiagnostic[] = [];
  let engineError: Error | undefined;
  const bodies = createBodyStore(scheduleSnapshot);

  function getSnapshot(): TrafficSnapshot {
    const records = repository.listRecords();
    const visible = new Set(records.map((record) => record.id));
    bodies.prune(visible);
    for (const id of activeRecords.keys()) if (!visible.has(id)) activeRecords.set(id, false);
    for (const record of records) {
      for (const side of ["request", "response"] as const) {
        const stored = bodies.metadata(record.id, side);
        if (stored) {
          const key = side === "request" ? "requestBody" : "responseBody";
          record[key] = { ...record[key], text: "", truncated: false, stored };
        }
      }
    }
    return { records, status: { ...status }, revision, diagnostics: structuredClone(diagnostics) };
  }
  function publishSnapshot(): void {
    publishTimer = undefined;
    const snapshot = getSnapshot();
    for (const listener of listeners) listener(snapshot);
  }
  function scheduleSnapshot(): void {
    revision += 1;
    if (!publishTimer) publishTimer = setTimeout(publishSnapshot, 100);
  }
  function updateStatus(nextStatus: CaptureStatus): CaptureStatus {
    status = nextStatus;
    scheduleSnapshot();
    return { ...status };
  }
  function enqueueOperation<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  }
  function finishPendingRecords(message: string): void {
    for (const record of repository.listRecords()) {
      if (record.state !== "pending") continue;
      bodies.finish(record.id);
      repository.upsertRecord(
        {
          ...record,
          state: "failed",
          error: message,
          durationMs: Math.max(0, Date.now() - record.startedAt),
        },
        false,
      );
    }
    activeRecords.clear();
  }
  const engine = createEngine({
    onRecord(record) {
      const isNew = !activeRecords.has(record.id);
      if (isNew && record.state !== "pending") return;
      const isVisible = activeRecords.get(record.id) ?? true;
      if (isVisible) {
        if (bodies.metadata(record.id, "request"))
          record = { ...record, requestBody: { ...record.requestBody, text: "" } };
        if (bodies.metadata(record.id, "response"))
          record = { ...record, responseBody: { ...record.responseBody, text: "" } };
        repository.upsertRecord(record, isNew);
      }
      if (record.state === "pending") activeRecords.set(record.id, isVisible);
      else {
        bodies.finish(record.id);
        activeRecords.delete(record.id);
      }
      scheduleSnapshot();
    },
    onBodyChunk(chunk) {
      if (activeRecords.get(chunk.id)) {
        bodies.append(chunk);
        scheduleSnapshot();
      }
    },
    onDiagnostic(diagnostic) {
      diagnostics.push(structuredClone(diagnostic));
      if (diagnostics.length > 100) diagnostics.shift();
      scheduleSnapshot();
    },
    onError(error) {
      engineError = error;
      finishPendingRecords(error.message);
      updateStatus({ ...status, state: "stopped", error: error.message });
    },
  });

  return {
    getSnapshot,
    readBody: bodies.read,
    startCapture(options: CaptureOptions): Promise<CaptureStatus> {
      return enqueueOperation(async () => {
        if (status.state === "recording") return { ...status };
        engineError = undefined;
        const selection = { target: options.target, mode: options.mode ?? "local" };
        updateStatus({ state: "starting", host: "127.0.0.1", port: options.port, ...selection });
        try {
          const address = await engine.start(options);
          if (engineError) throw engineError;
          return updateStatus({ state: "recording", ...address, ...selection });
        } catch (error) {
          await engine.stop().catch(() => undefined);
          finishPendingRecords(normalizeErrorMessage(error));
          updateStatus({ ...status, state: "stopped", error: normalizeErrorMessage(error) });
          throw error;
        }
      });
    },
    stopCapture(): Promise<CaptureStatus> {
      return enqueueOperation(async () => {
        if (status.state === "stopped") {
          await engine.stop();
          return { ...status };
        }
        updateStatus({ ...status, state: "stopping" });
        try {
          await engine.stop();
          finishPendingRecords("Capture stopped before the request completed.");
          return updateStatus({ state: "stopped", host: status.host, port: status.port });
        } catch (error) {
          updateStatus({ ...status, error: normalizeErrorMessage(error) });
          throw error;
        }
      });
    },
    clearTraffic(): Promise<void> {
      return enqueueOperation(() => {
        repository.clearRecords();
        bodies.clear();
        diagnostics.length = 0;
        for (const id of activeRecords.keys()) activeRecords.set(id, false);
        scheduleSnapshot();
      });
    },
    onSnapshot(listener: (snapshot: TrafficSnapshot) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    disposePublisher(): void {
      if (publishTimer) clearTimeout(publishTimer);
      publishTimer = undefined;
      listeners.clear();
      bodies.clear();
    },
  };
}

export type CaptureService = ReturnType<typeof createCaptureService>;
