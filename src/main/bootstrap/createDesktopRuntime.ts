import { app, shell } from "electron";
import { join, sep } from "node:path";
import { CLI_PROTOCOL_VERSION, isSnapshot } from "../../cli/protocol";
import type { BodyPageRequest, CaptureOptions, TrafficSnapshot } from "../../shared/contracts";
import { createCliServer } from "./createCliServer";

export type DesktopRuntime = ReturnType<typeof createDesktopRuntime>;

export function createDesktopRuntime() {
  type Link = {
    server: ReturnType<typeof createCliServer>;
    ready: Promise<void>;
    base: number;
    mayOwnProxyLease: boolean;
  };
  let active: Link | undefined;
  let disposing = false;
  let launched = false;
  let revision = -1;
  let status: TrafficSnapshot["status"] = { state: "stopped", host: "127.0.0.1", port: 9090 };
  const listeners = new Set<(snapshot: TrafficSnapshot) => void>();

  function translate(snapshot: TrafficSnapshot, link: Link) {
    const translated = { ...snapshot, revision: link.base + snapshot.revision };
    if (translated.revision >= revision) {
      revision = translated.revision;
      status = translated.status;
    }
    return translated;
  }

  function publish(snapshot: TrafficSnapshot) {
    for (const listener of listeners) listener(snapshot);
  }

  async function connected(): Promise<Link> {
    if (!active) {
      launched = true;
      const modulePath = join(__dirname, "capture-cli.cjs");
      const unpackedPath = app.isPackaged
        ? modulePath.replace(sep + "app.asar" + sep, sep + "app.asar.unpacked" + sep)
        : modulePath;
      const resources = app.isPackaged
        ? process.resourcesPath
        : join(app.getAppPath(), "resources");
      const server = createCliServer(
        unpackedPath,
        ["serve", "--resources", resources, "--data", app.getPath("userData")],
        {
          onSnapshot(snapshot) {
            if (active === link) publish(translate(snapshot, link));
          },
          onExit(error) {
            if (active !== link) return;
            active = undefined;
            if (disposing) return;
            status = {
              state: "stopped",
              host: status.host,
              port: status.port,
              error: error.message,
            };
            publish({ status, records: [], diagnostics: [], revision: ++revision });
            if (link.mayOwnProxyLease) void connected().catch(() => {});
          },
        },
      );
      const link: Link = {
        server,
        base: revision + 1,
        mayOwnProxyLease: false,
        ready: server
          .send({ method: "core.initialize", params: { protocolVersion: CLI_PROTOCOL_VERSION } })
          .then((result) => {
            if (result?.protocolVersion !== CLI_PROTOCOL_VERSION)
              throw new Error("Incompatible capture CLI protocol");
          })
          .catch((error) => {
            void server.close().catch(() => {});
            throw error;
          }),
      };
      active = link;
    }
    const link = active;
    await link.ready;
    return link;
  }

  async function getEngineInfo() {
    return (await connected()).server.send({ method: "engine.info", params: {} }, 150_000);
  }

  return {
    async initialize() {
      await connected();
    },
    async start(params: CaptureOptions) {
      const link = await connected();
      if (params.mode === "system-proxy") link.mayOwnProxyLease = true;
      return link.server.send({ method: "capture.start", params }, 150_000);
    },
    async stop() {
      return (await connected()).server.send({ method: "capture.stop", params: {} });
    },
    async snapshot() {
      const link = await connected();
      const snapshot = await link.server.send({ method: "capture.snapshot", params: {} });
      if (!isSnapshot(snapshot)) throw new Error("Invalid capture snapshot");
      return translate(snapshot, link);
    },
    async clear() {
      await (await connected()).server.send({ method: "capture.clear", params: {} });
    },
    async readBody(params: BodyPageRequest) {
      const page = await (await connected()).server.send({ method: "capture.readBody", params });
      if (!page) return null;
      const { dataBase64, ...metadata } = page;
      if (typeof dataBase64 !== "string" || dataBase64.length > 44_000)
        throw new Error("Invalid CLI body page");
      return { ...metadata, data: new Uint8Array(Buffer.from(dataBase64, "base64")) };
    },
    getEngineInfo,
    async trustCertificate() {
      return (await connected()).server.send({ method: "certificate.trust", params: {} }, 150_000);
    },
    async listProcesses() {
      return (await connected()).server.send({ method: "process.list", params: {} });
    },
    async revealCertificate() {
      const info = await getEngineInfo();
      if (!info.certificateReady)
        throw new Error("Start capture once to generate the public CA certificate.");
      shell.showItemInFolder(info.certificatePath);
    },
    onSnapshot(listener: (snapshot: TrafficSnapshot) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async dispose() {
      if (!launched) return;
      disposing = true;
      try {
        const { server } = await connected();
        await server.send({ method: "core.dispose", params: {} });
        await server.close();
      } finally {
        disposing = false;
      }
    },
  };
}
