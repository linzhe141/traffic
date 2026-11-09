import type {
  BodyPage,
  BodyPageRequest,
  CaptureOptions,
  CaptureStatus,
  DetectedProcess,
  EngineInfo,
  ProcessIconVariants,
  TrafficSnapshot,
} from "@local-traffic/protocol";

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string };
export interface InvokeContract {
  "capture:start": { input: CaptureOptions; output: CaptureStatus };
  "capture:stop": { input: undefined; output: CaptureStatus };
  "traffic:snapshot": { input: undefined; output: TrafficSnapshot };
  "traffic:clear": { input: undefined; output: undefined };
  "traffic:body": { input: BodyPageRequest; output: BodyPage | null };
  "clipboard:write": { input: string; output: undefined };
  "process:icon": { input: string; output: ProcessIconVariants | null };
  "engine:info": { input: undefined; output: EngineInfo };
  "certificate:reveal": { input: undefined; output: undefined };
  "certificate:trust": { input: undefined; output: EngineInfo };
  "process:list": { input: undefined; output: DetectedProcess[] };
}
export interface TrafficApi {
  startCapture(options: CaptureOptions): Promise<CaptureStatus>;
  stopCapture(): Promise<CaptureStatus>;
  getSnapshot(): Promise<TrafficSnapshot>;
  clearTraffic(): Promise<void>;
  readBody(input: BodyPageRequest): Promise<BodyPage | null>;
  copyText(text: string): Promise<void>;
  getProcessIcon(path: string): Promise<ProcessIconVariants | null>;
  getEngineInfo(): Promise<EngineInfo>;
  revealCertificate(): Promise<void>;
  trustCertificate(): Promise<EngineInfo>;
  listProcesses(): Promise<DetectedProcess[]>;
  onSnapshot(listener: (snapshot: TrafficSnapshot) => void): () => void;
}
export const SNAPSHOT_CHANNEL = "traffic:changed";
