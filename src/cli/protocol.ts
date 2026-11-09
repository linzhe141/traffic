import type {
  BodyPage,
  BodyPageRequest,
  CaptureOptions,
  CaptureStatus,
  DetectedProcess,
  EngineInfo,
  TrafficSnapshot,
} from "../shared/contracts";

export const CLI_PROTOCOL_VERSION = 1;
export const SNAPSHOT_NOTIFICATION = "capture.changed";

type EmptyParams = Record<string, never>;
export type WireBodyPage = Omit<BodyPage, "data"> & { dataBase64: string };

export interface CliCommands {
  "core.initialize": { params: { protocolVersion: number }; result: { protocolVersion: number } };
  "core.dispose": { params: EmptyParams; result: null };
  "capture.start": { params: CaptureOptions; result: CaptureStatus };
  "capture.stop": { params: EmptyParams; result: CaptureStatus };
  "capture.snapshot": { params: EmptyParams; result: TrafficSnapshot };
  "capture.clear": { params: EmptyParams; result: null };
  "capture.readBody": { params: BodyPageRequest; result: WireBodyPage | null };
  "engine.info": { params: EmptyParams; result: EngineInfo };
  "certificate.trust": { params: EmptyParams; result: EngineInfo };
  "process.list": { params: EmptyParams; result: DetectedProcess[] };
}

export type CliMethod = keyof CliCommands;
export type CliCommand<K extends CliMethod = CliMethod> = {
  [M in K]: { method: M; params: CliCommands[M]["params"] };
}[K];

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isSnapshot(value: unknown): value is TrafficSnapshot {
  return (
    isObject(value) &&
    Number.isSafeInteger(value.revision) &&
    Array.isArray(value.records) &&
    isObject(value.status) &&
    ["stopped", "starting", "recording", "stopping"].includes(String(value.status.state))
  );
}
