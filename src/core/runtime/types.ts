import type {
  BodyPage,
  BodyPageRequest,
  CaptureOptions,
  CaptureStatus,
  DetectedProcess,
  EngineInfo,
  TrafficSnapshot,
} from "../../shared/contracts";
import type { CaptureEngineOptions } from "../engines/createCaptureEngine";
import type { CaptureEngineFactory } from "../engines/types";
import type { TrafficRepository } from "../storage/trafficRepository";

export interface RuntimePlatformPorts {
  initialize?(): Promise<void>;
  getEngineInfo(): Promise<EngineInfo>;
  trustCertificate(): Promise<EngineInfo>;
  listProcesses(): Promise<DetectedProcess[]>;
}
type RuntimeEngineOptions =
  | { engine: Omit<CaptureEngineOptions, "callbacks">; createEngine?: never }
  | { createEngine: CaptureEngineFactory; engine?: never };
export type RuntimeOptions = RuntimeEngineOptions & {
  platform: RuntimePlatformPorts;
  repository?: TrafficRepository;
};

export interface Runtime extends Omit<RuntimePlatformPorts, "initialize"> {
  initialize(): Promise<void>;
  start(options: CaptureOptions): Promise<CaptureStatus>;
  stop(): Promise<CaptureStatus>;
  snapshot(): TrafficSnapshot;
  clear(): Promise<void>;
  readBody(input: BodyPageRequest): BodyPage | null;
  onSnapshot(listener: (snapshot: TrafficSnapshot) => void): () => void;
  dispose(): Promise<void>;
}
