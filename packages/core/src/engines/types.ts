import type {
  BodySide,
  CaptureDiagnostic,
  CaptureConfiguration,
  CaptureOptions,
  TrafficRecord,
} from "@local-traffic/protocol";

export interface CapturedBodyChunk {
  id: string;
  side: BodySide;
  data: string;
  contentEncoding: string;
  contentType: string;
}

export interface CaptureEngine<Options = CaptureOptions> {
  start(options: Options): Promise<{ host: string; port: number }>;
  stop(): Promise<void>;
}
export interface CaptureEngineCallbacks {
  onRecord(record: TrafficRecord): void;
  onError(error: Error): void;
  onDiagnostic(diagnostic: CaptureDiagnostic): void;
  onBodyChunk?(chunk: CapturedBodyChunk): void;
}
export type CaptureEngineFactory = (callbacks: CaptureEngineCallbacks) => CaptureEngine;
export interface EnginePaths {
  executablePath: string;
  addonPath: string;
  confdir: string;
}
export interface CaptureBackendDependencies extends EnginePaths {
  onRecord(record: TrafficRecord): void;
  onError(error: Error): void;
  onDiagnostic?(diagnostic: CaptureDiagnostic): void;
  onBodyChunk?(chunk: CapturedBodyChunk): void;
}
export type CaptureBackendFactory = (
  dependencies: CaptureBackendDependencies,
) => CaptureEngine<CaptureConfiguration>;
