import { normalizeCaptureOptions } from "@local-traffic/protocol/validation";
import { createConfiguredCaptureEngine } from "../engines/createCaptureEngine";
import { InvalidCaptureOptions, normalizeErrorMessage } from "../errors";
import { createMemoryTrafficRepository } from "../storage/trafficRepository";
import { createCaptureService } from "./captureService";
import type { Runtime, RuntimeOptions } from "./types";

export function createRuntime(options: RuntimeOptions): Runtime {
  const { createEngine: factory, engine } = options;
  const service = createCaptureService(
    options.repository ?? createMemoryTrafficRepository(),
    engine ? (callbacks) => createConfiguredCaptureEngine({ ...engine, callbacks }) : factory,
  );
  let disposal: Promise<void> | undefined;
  let initialization: Promise<void> | undefined;
  function initialize(): Promise<void> {
    if (disposal)
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
    async start(input) {
      if (disposal) throw new Error("Capture runtime has been disposed or is shutting down.");
      let options;
      try {
        options = normalizeCaptureOptions(input);
      } catch (error) {
        throw new InvalidCaptureOptions(normalizeErrorMessage(error));
      }
      return service.startCapture(options);
    },
    stop: service.stopCapture,
    snapshot: service.getSnapshot,
    clear: service.clearTraffic,
    readBody: service.readBody,
    onSnapshot: service.onSnapshot,
    getEngineInfo: () => options.platform.getEngineInfo(),
    trustCertificate: () => options.platform.trustCertificate(),
    listProcesses: () => options.platform.listProcesses(),
    dispose() {
      if (disposal) return disposal;
      disposal = service
        .stopCapture()
        .then(service.disposePublisher)
        .catch((error: unknown) => {
          disposal = undefined;
          throw error;
        });
      return disposal;
    },
  };
}
