import type { Runtime } from "../core";
import { normalizeBodyPageRequest, normalizeCaptureOptions } from "../shared/validation";
import type { TrafficSnapshot } from "../shared/contracts";
import { normalizeErrorMessage } from "../core/errors";
import type { CliContext } from "./normalizeContext";
import {
  CLI_PROTOCOL_VERSION,
  isObject,
  SNAPSHOT_NOTIFICATION,
  type CliCommands,
} from "./protocol";
import { readFrames, writeFrame } from "./transport/ndjson";

class RequestError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export function serveCli(runtime: Runtime, { stdin, stdout, stderr }: CliContext): Promise<void> {
  let initialized = false;
  let disposing = false;
  let stopped = false;
  let latest: TrafficSnapshot | undefined;

  return new Promise((resolve, reject) => {
    function shutdown() {
      if (stopped) return;
      stopped = true;
      stopReading();
      unsubscribe();
      stdin.pause();
      stdout.off("drain", flushSnapshot);
      void runtime.dispose().then(resolve, reject);
    }

    function send(message: object) {
      return writeFrame(stdout, { jsonrpc: "2.0", ...message });
    }

    function transportError(error: unknown) {
      if (stopped) return;
      stderr.write(normalizeErrorMessage(error) + "\n");
      shutdown();
    }

    function flushSnapshot() {
      if (stopped || disposing || !initialized || !latest || stdout.writableNeedDrain) return;
      const params = latest;
      latest = undefined;
      void send({ method: SNAPSHOT_NOTIFICATION, params }).catch(transportError);
    }

    const unsubscribe = runtime.onSnapshot((snapshot) => {
      latest = snapshot;
      flushSnapshot();
    });
    stdout.on("drain", flushSnapshot);
    stdout.on("error", transportError);
    stdin.on("error", transportError);

    const handlers: {
      [K in keyof CliCommands]: (
        params: Record<string, unknown>,
      ) => CliCommands[K]["result"] | Promise<CliCommands[K]["result"]>;
    } = {
      "core.initialize": async (params) => {
        if (params.protocolVersion !== CLI_PROTOCOL_VERSION)
          throw new RequestError(-32001, `Expected CLI protocol version ${CLI_PROTOCOL_VERSION}`);
        await runtime.initialize();
        initialized = true;
        return { protocolVersion: CLI_PROTOCOL_VERSION };
      },
      "core.dispose": async () => {
        disposing = true;
        try {
          await runtime.dispose();
        } catch (error) {
          disposing = false;
          throw error;
        }
        return null;
      },
      "capture.start": (params) => {
        let options;
        try {
          options = normalizeCaptureOptions(params);
        } catch (error) {
          throw new RequestError(-32602, normalizeErrorMessage(error));
        }
        return runtime.start(options);
      },
      "capture.stop": runtime.stop,
      "capture.snapshot": runtime.snapshot,
      "capture.clear": async () => {
        await runtime.clear();
        return null;
      },
      "capture.readBody": (params) => {
        let input;
        try {
          input = normalizeBodyPageRequest(params);
        } catch (error) {
          throw new RequestError(-32602, normalizeErrorMessage(error));
        }
        const page = runtime.readBody(input);
        if (!page) return null;
        const { data, ...metadata } = page;
        return { ...metadata, dataBase64: Buffer.from(data).toString("base64") };
      },
      "engine.info": runtime.getEngineInfo,
      "certificate.trust": runtime.trustCertificate,
      "process.list": runtime.listProcesses,
    };

    async function receive(value: unknown) {
      if (!isObject(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
        await send({ id: null, error: { code: -32600, message: "Invalid Request" } });
        return;
      }
      if (!("id" in value)) return; // Business commands require a response.
      const { id, method } = value;
      if (id !== null && typeof id !== "string" && !Number.isSafeInteger(id)) {
        await send({ id: null, error: { code: -32600, message: "Invalid request ID" } });
        return;
      }
      let result: unknown;
      try {
        if (!Object.hasOwn(handlers, method)) throw new RequestError(-32601, "Method not found");
        const params = "params" in value ? value.params : {};
        if (!isObject(params)) throw new RequestError(-32602, "Expected named parameters");
        if (
          !["core.initialize", "capture.start", "capture.readBody"].includes(method) &&
          Object.keys(params).length
        )
          throw new RequestError(-32602, "This command does not take parameters");
        if (disposing) throw new RequestError(-32003, "CLI is shutting down");
        if (!initialized && method !== "core.initialize" && method !== "core.dispose")
          throw new RequestError(-32002, "Call core.initialize first");
        result = await handlers[method as keyof CliCommands](params);
      } catch (error) {
        await send({
          id,
          error: {
            code: error instanceof RequestError ? error.code : -32000,
            message: normalizeErrorMessage(error),
          },
        });
        return;
      }
      await send({ id, result });
      if (method === "core.dispose") shutdown();
    }

    const stopReading = readFrames(stdin, {
      onMessage: (value) => {
        void receive(value).catch(transportError);
      },
      onInvalid: () => {
        void send({ id: null, error: { code: -32700, message: "Parse error" } }).catch(
          transportError,
        );
      },
      onEnd: shutdown,
    });
  });
}
