/** Public core entry: Node-capable hosts can use the engine/runtime without Electron. */
export { createCaptureEngine } from "./engines/createCaptureEngine";
export type { CaptureEngineOptions } from "./engines/createCaptureEngine";
export type {
  CaptureEngine,
  CaptureEngineCallbacks,
  CaptureEngineFactory,
  CaptureBackendDependencies,
  CaptureBackendFactory,
  EnginePaths,
} from "./engines/types";
export { createRuntime } from "./runtime";
export type { Runtime, RuntimeOptions, RuntimePlatformPorts } from "./runtime";
export { createMemoryTrafficRepository } from "./storage/trafficRepository";
export type { TrafficRepository } from "./storage/trafficRepository";
export type {
  CaptureOptions,
  CaptureStatus,
  CaptureDiagnostic,
  TrafficRecord,
  TrafficSnapshot,
} from "../shared/contracts";
