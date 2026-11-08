import { app, BrowserWindow } from "electron";
import { join } from "node:path";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 680,
    title: "Local Traffic",
    backgroundColor: "#f6f6f6",
    show: true,
    icon: join(app.isPackaged ? process.resourcesPath : app.getAppPath(), "local-traffic.png"),
    titleBarStyle:
      process.platform === "win32" || process.platform === "darwin" ? "hidden" : "default",
    ...(process.platform === "win32"
      ? {
          titleBarOverlay: { color: "#00000000", symbolColor: "#8a8a94", height: 48 },
        }
      : {}),
    ...(process.platform === "darwin" ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  const rendererUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const load = rendererUrl
    ? window.loadURL(rendererUrl)
    : window.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  void load.catch((error: unknown) => {
    console.error("Failed to load traffic workspace:", error);
  });
  return window;
}
