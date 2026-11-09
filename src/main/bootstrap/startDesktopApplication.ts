import { app, dialog, type BrowserWindow } from "electron";
import { createWindow } from "../createWindow";
import { registerTrafficHandlers } from "../ipc/registerTrafficHandlers";
import { createDesktopRuntime, type DesktopRuntime } from "./createDesktopRuntime";
let mainWindow: BrowserWindow | null = null;
let shutdownComplete = false;
let shutdownPromise: Promise<unknown> | undefined;
let runtime: DesktopRuntime;
let unregisterHandlers: (() => void) | undefined;

function openWindow(): void {
  mainWindow = createWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

export function startDesktopApplication(): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  runtime = createDesktopRuntime();
  app.on("second-instance", () => {
    if (!mainWindow && app.isReady()) openWindow();
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });

  void app.whenReady().then(async () => {
    await runtime.initialize().catch((error: unknown) => {
      dialog.showErrorBox(
        "抓取 CLI 初始化失败",
        error instanceof Error ? error.message : "请检查抓取引擎及系统代理设置。",
      );
    });
    unregisterHandlers = registerTrafficHandlers(runtime, () => mainWindow);
    openWindow();
    app.on("activate", () => {
      if (!mainWindow && !shutdownPromise) openWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
    else
      void runtime.stop().catch((error: unknown) => {
        console.error("Failed to stop capture:", error);
      });
  });

  app.on("before-quit", (event) => {
    if (shutdownComplete) return;
    event.preventDefault();
    if (shutdownPromise) return;
    shutdownPromise = runtime
      .dispose()
      .then(() => {
        unregisterHandlers?.();

        shutdownComplete = true;
        app.quit();
      })
      .catch((error: unknown) => {
        shutdownPromise = undefined;
        if (!mainWindow) openWindow();
        dialog.showErrorBox(
          "暂时无法退出",
          `停止抓取或恢复系统代理失败。请重试停止，或检查系统代理后再退出。\n${error instanceof Error ? error.message : ""}`,
        );
      });
  });
}
