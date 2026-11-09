import type { CaptureConfiguration, CaptureStatus, TrafficSnapshot } from "@local-traffic/protocol";
import type { TrafficRepository } from "../storage/trafficRepository";

import type { CaptureEngineFactory } from "../engines/types";
import { normalizeErrorMessage } from "../errors";
import { createTrafficSession } from "./trafficSession";

export function createCaptureService(
  repository: TrafficRepository,
  createEngine: CaptureEngineFactory,
) {
  let status: CaptureStatus = { state: "stopped", host: "127.0.0.1", port: 9090 };
  let revision = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(snapshot: TrafficSnapshot) => void>();
  let engineError: Error | undefined;
  const traffic = createTrafficSession(repository, scheduleSnapshot);

  function getSnapshot(): TrafficSnapshot {
    return { ...traffic.snapshot(), status: { ...status }, revision };
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
  const engine = createEngine({
    onRecord: traffic.record,
    onBodyChunk: traffic.appendBody,
    onDiagnostic: traffic.addDiagnostic,
    onError(error) {
      engineError = error;
      traffic.finishPending(error.message);
      updateStatus({ ...status, state: "stopped", error: error.message });
    },
  });

  return {
    getSnapshot,
    readBody: traffic.readBody,
    startCapture(options: CaptureConfiguration): Promise<CaptureStatus> {
      return enqueueOperation(async () => {
        if (status.state === "recording") return { ...status };
        engineError = undefined;
        const selection = { target: options.target, mode: options.mode };
        updateStatus({ state: "starting", host: "127.0.0.1", port: options.port, ...selection });
        try {
          const address = await engine.start(options);
          if (engineError) throw engineError;
          return updateStatus({ state: "recording", ...address, ...selection });
        } catch (error) {
          await engine.stop().catch(() => undefined);
          traffic.finishPending(normalizeErrorMessage(error));
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
          traffic.finishPending("Capture stopped before the request completed.");
          return updateStatus({ state: "stopped", host: status.host, port: status.port });
        } catch (error) {
          updateStatus({ ...status, error: normalizeErrorMessage(error) });
          throw error;
        }
      });
    },
    clearTraffic(): Promise<void> {
      return enqueueOperation(traffic.clear);
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
      traffic.dispose();
    },
  };
}

export type CaptureService = ReturnType<typeof createCaptureService>;
