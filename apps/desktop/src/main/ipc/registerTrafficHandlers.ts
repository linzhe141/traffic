import { clipboard, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { SNAPSHOT_CHANNEL, type InvokeContract, type IpcResult } from "../../shared/desktopApi";
import { type ProcessIconVariants } from "@local-traffic/protocol";
import { validateInvokeInput } from "./validateInvokeInput";
import type { DesktopRuntime } from "../bootstrap/createDesktopRuntime";
import { readProcessIcon } from "../processes/readProcessIcon";

export function registerTrafficHandlers(
  runtime: DesktopRuntime,
  getWindow: () => BrowserWindow | null,
): () => void {
  const registeredChannels: (keyof InvokeContract)[] = [];
  const icons = new Map<string, Promise<ProcessIconVariants | null>>();

  function validateSender(event: IpcMainInvokeEvent): void {
    const window = getWindow();
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      throw new Error("IPC sender is not the application main frame.");
    }
  }
  function registerHandler<K extends keyof InvokeContract>(
    channel: K,
    handler: (
      input: InvokeContract[K]["input"],
    ) => Promise<InvokeContract[K]["output"]> | InvokeContract[K]["output"],
  ): void {
    ipcMain.handle(
      channel,
      async (event, input: unknown): Promise<IpcResult<InvokeContract[K]["output"]>> => {
        try {
          validateSender(event);
          const validated = validateInvokeInput(channel, input);
          return { ok: true, value: await handler(validated) };
        } catch (error) {
          const message = error instanceof Error ? error.message : "An unexpected capture error occurred.";
          return { ok: false, error: message };
        }
      },
    );
    registeredChannels.push(channel);
  }

  registerHandler("capture:start", (options) => runtime.start(options));
  registerHandler("capture:stop", () => runtime.stop());
  registerHandler("traffic:snapshot", () => runtime.snapshot());
  registerHandler("traffic:clear", async () => {
    await runtime.clear();
    return undefined;
  });
  registerHandler("traffic:body", (input) => runtime.readBody(input));
  registerHandler("clipboard:write", (text) => {
    clipboard.writeText(text);
    return undefined;
  });
  registerHandler("process:icon", (path) => {
    const key = path.toLowerCase();
    const cached = icons.get(key);
    if (cached) return cached;
    const result = readProcessIcon(path).catch(() => null);
    if (icons.size >= 128) icons.delete(icons.keys().next().value!);
    icons.set(key, result);
    return result;
  });
  registerHandler("engine:info", () => runtime.getEngineInfo());
  registerHandler("certificate:reveal", async () => {
    await runtime.revealCertificate();
    return undefined;
  });
  registerHandler("certificate:trust", () => runtime.trustCertificate());
  registerHandler("process:list", () => runtime.listProcesses());
  const unsubscribe = runtime.onSnapshot((snapshot) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(SNAPSHOT_CHANNEL, snapshot);
  });
  return () => {
    unsubscribe();
    for (const channel of registeredChannels) ipcMain.removeHandler(channel);
  };
}
