import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import {
  SNAPSHOT_CHANNEL,
  type InvokeContract,
  type IpcResult,
  type TrafficApi,
  type TrafficSnapshot,
} from "../shared/contracts";

async function invokeCommand<K extends keyof InvokeContract>(
  channel: K,
  input: InvokeContract[K]["input"],
): Promise<InvokeContract[K]["output"]> {
  const result: IpcResult<InvokeContract[K]["output"]> = await ipcRenderer.invoke(channel, input);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

const trafficApi: TrafficApi = {
  startCapture: (options) => invokeCommand("capture:start", options),
  stopCapture: () => invokeCommand("capture:stop", undefined),
  getSnapshot: () => invokeCommand("traffic:snapshot", undefined),
  clearTraffic: () => invokeCommand("traffic:clear", undefined),
  readBody: (input) => invokeCommand("traffic:body", input),
  copyText: (text) => invokeCommand("clipboard:write", text),
  getProcessIcon: (path) => invokeCommand("process:icon", path),
  getEngineInfo: () => invokeCommand("engine:info", undefined),
  revealCertificate: () => invokeCommand("certificate:reveal", undefined),
  trustCertificate: () => invokeCommand("certificate:trust", undefined),
  listProcesses: () => invokeCommand("process:list", undefined),
  onSnapshot(listener) {
    const handleSnapshot = (_event: IpcRendererEvent, snapshot: TrafficSnapshot): void =>
      listener(snapshot);
    ipcRenderer.on(SNAPSHOT_CHANNEL, handleSnapshot);
    return () => {
      ipcRenderer.removeListener(SNAPSHOT_CHANNEL, handleSnapshot);
    };
  },
};
contextBridge.exposeInMainWorld("trafficApi", trafficApi);
