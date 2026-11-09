import { fork } from "node:child_process";
import {
  SNAPSHOT_NOTIFICATION,
  type CliCommand,
  type CliCommands,
  type CliMethod,
} from "@local-traffic/protocol";
import { readFrames, writeFrame } from "@local-traffic/protocol/transport";
import type { TrafficSnapshot } from "@local-traffic/protocol";
import { isObject } from "@local-traffic/protocol/validation";

export function createCliClient(
  modulePath: string,
  args: string[],
  handlers: {
    onSnapshot(snapshot: TrafficSnapshot): void;
    onExit(error: Error): void;
  },
) {
  const child = fork(modulePath, args, {
    silent: true,
    windowsHide: true,
    execArgv: [],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  let nextId = 0;
  let failure: Error | undefined;
  let stderr = "";
  const pending = new Map<
    number,
    {
      timer: ReturnType<typeof setTimeout>;
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();
  child.stderr!.setEncoding("utf8").on("data", (text: string) => {
    stderr = (stderr + text).slice(-8192);
  });

  function rejectPending(error: Error) {
    if (failure) return;
    failure = error;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  }

  function abort(error: Error) {
    rejectPending(error);
    child.stdin!.end();
  }

  const detach = readFrames(child.stdout!, {
    onMessage(message) {
      if (failure) return;
      if (!isObject(message) || message.jsonrpc !== "2.0")
        return abort(new Error("Invalid CLI JSON-RPC envelope"));
      if (!("id" in message) && message.method === SNAPSHOT_NOTIFICATION) {
        const snapshot = message.params;
        if (snapshot === null || typeof snapshot !== "object")
          return abort(new Error("Invalid CLI snapshot envelope"));
        // Payloads come from the bundled, version-matched CLI.
        handlers.onSnapshot(snapshot as TrafficSnapshot);
        return;
      }
      if (
        typeof message.id !== "number" ||
        !Number.isSafeInteger(message.id) ||
        "method" in message ||
        "result" in message === "error" in message
      ) {
        return abort(new Error("Invalid CLI JSON-RPC response"));
      }
      const call = pending.get(message.id);
      if (!call) return;
      const error = message.error;
      if (
        "error" in message &&
        (!isObject(error) || typeof error.message !== "string" || !Number.isInteger(error.code))
      )
        return abort(new Error("Invalid CLI JSON-RPC error"));
      pending.delete(message.id);
      clearTimeout(call.timer);
      if (isObject(error)) call.reject(new Error(`CLI ${error.code}: ${error.message}`));
      else call.resolve(message.result);
    },
    onInvalid: abort,
    onEnd() {
      rejectPending(
        new Error("CLI closed its output stream" + (stderr.trim() ? `: ${stderr.trim()}` : "")),
      );
    },
  });
  child.stdin!.on("error", rejectPending);
  child.stdout!.on("error", abort);
  child.on("error", rejectPending);
  const exited = new Promise<void>((resolve) => {
    child.once("close", (code, signal) => {
      detach();
      const detail = stderr.trim();
      const error =
        failure ??
        new Error(
          `Capture CLI exited (${code ?? signal ?? "unknown"})${detail ? `: ${detail}` : ""}`,
        );
      rejectPending(error);
      handlers.onExit(error);
      resolve();
    });
  });

  return {
    async send<K extends CliMethod>(
      command: CliCommand<K>,
      timeoutMs = 45_000,
    ): Promise<CliCommands[K]["result"]> {
      if (failure) throw failure;
      const id = ++nextId;
      const result = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CLI command timed out: ${command.method}`));
        }, timeoutMs);
        pending.set(id, { timer, resolve, reject });
      });
      void writeFrame(child.stdin!, { jsonrpc: "2.0", id, ...command }).catch(abort);
      return (await result) as CliCommands[K]["result"];
    },
    async close() {
      child.stdin!.end();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          exited,
          new Promise<void>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Capture CLI did not exit after closing stdin")),
              10_000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
