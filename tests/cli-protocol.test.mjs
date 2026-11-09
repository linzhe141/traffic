import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";

test("standalone CLI speaks JSON-RPC and disposes cleanly", { timeout: 20_000 }, async () => {
  const data = await mkdtemp(join(tmpdir(), "local-traffic-cli-"));
  const child = spawn(
    process.execPath,
    [
      resolve("apps/cli/.vite/build/capture-cli.cjs"),
      "serve",
      "--resources",
      resolve("resources"),
      "--data",
      data,
    ],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  const closed = once(child, "close");
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const send = (id, method, params = {}) =>
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  const next = async () => {
    const line = await lines.next();
    assert.equal(line.done, false);
    return JSON.parse(line.value);
  };
  try {
    child.stdin.write("{\n");
    assert.equal((await next()).error.code, -32700);
    send("version", "core.initialize", { protocolVersion: 2 });
    assert.deepEqual(await next(), {
      jsonrpc: "2.0",
      id: "version",
      error: { code: -32001, message: "Expected CLI protocol version 1" },
    });
    send(1, "capture.snapshot");
    assert.equal((await next()).error.code, -32002);
    const handshake = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "core.initialize",
      params: { protocolVersion: 1 },
    });
    child.stdin.write(handshake.slice(0, 16));
    child.stdin.write(handshake.slice(16) + "\n");
    assert.deepEqual(await next(), { jsonrpc: "2.0", id: 2, result: { protocolVersion: 1 } });

    send(3, "capture.snapshot");
    send(4, "capture.readBody", { id: "不存在", side: "response", offset: 0 });
    send(5, "capture.start", { port: 0 });
    send(6, "does.not.exist");
    send("local-target", "capture.start", { port: 9090 });
    send("system-target", "capture.start", {
      port: 9090,
      mode: "system-proxy",
      target: "chrome.exe",
    });
    const responses = new Map();
    while (responses.size < 6) {
      const response = await next();
      responses.set(response.id, response);
    }
    assert.equal(responses.get(3).result.status.state, "stopped");
    assert.equal(responses.get(4).result, null);
    assert.equal(responses.get(5).error.code, -32602);
    assert.equal(responses.get(6).error.code, -32601);
    assert.equal(responses.get("local-target").error.code, -32602);
    assert.equal(responses.get("system-target").error.code, -32602);

    send(7, "core.dispose");
    assert.deepEqual(await next(), { jsonrpc: "2.0", id: 7, result: null });
    assert.deepEqual(await closed, [0, null]);
  } finally {
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
    await rmdir(data);
  }
});
