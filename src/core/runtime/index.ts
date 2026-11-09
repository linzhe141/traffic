import { normalizeCaptureOptions } from "../../shared/validation";
import { createCaptureEngine } from "../engines/createCaptureEngine";
import { createMemoryTrafficRepository } from "../storage/trafficRepository";
import { createCaptureService } from "./captureService";
import type { Runtime, RuntimeOptions } from "./types";

export function createRuntime(options: RuntimeOptions): Runtime {
  const createEngine =
    options.createEngine ?? ((callbacks) => createCaptureEngine({ ...options.engine!, callbacks }));
  const service = createCaptureService(
    options.repository ?? createMemoryTrafficRepository(),
    createEngine,
  );
  let disposed = false;
  let disposal: Promise<void> | undefined;
  let initialization: Promise<void> | undefined;
  function initialize(): Promise<void> {
    if (disposed || disposal)
      return Promise.reject(new Error("Capture runtime has been disposed or is shutting down."));
    if (!initialization) {
      initialization = Promise.resolve()
        .then(() => options.platform.initialize?.())
        .catch((error: unknown) => {
          initialization = undefined;
          throw error;
        });
    }
    return initialization;
  }
  return {
    initialize,
    start(input) {
      if (disposed || disposal)
        return Promise.reject(new Error("Capture runtime has been disposed or is shutting down."));
      try {
        return service.startCapture(normalizeCaptureOptions(input));
      } catch (error) {
        return Promise.reject(error);
      }
    },
    stop: () => service.stopCapture(),
    snapshot: () => service.getSnapshot(),
    clear: () => service.clearTraffic(),
    readBody: service.readBody,
    onSnapshot: (listener) => service.onSnapshot(listener),
    getEngineInfo: () => options.platform.getEngineInfo(),
    trustCertificate: () => options.platform.trustCertificate(),
    listProcesses: () => options.platform.listProcesses(),
    dispose() {
      if (disposed) return Promise.resolve();
      if (disposal) return disposal;
      disposal = service
        .stopCapture()
        .then(() => {
          disposed = true;
          service.disposePublisher();
        })
        .catch((error: unknown) => {
          disposal = undefined;
          throw error;
        });
      return disposal;
    },
  };
}
export type { Runtime, RuntimeOptions, RuntimePlatformPorts } from "./types";
