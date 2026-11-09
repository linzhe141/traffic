import type { Readable, Writable } from "node:stream";
import { resolve } from "node:path";

export interface CliContext {
  argv: string[];
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
}

export type Command = { name: "help" } | { name: "serve"; resourceRoot: string; dataDir: string };

export function normalizeContext(context: CliContext): CliContext & { command: Command } {
  const [name, ...args] = context.argv;
  if (!name || name === "--help" || name === "help")
    return { ...context, command: { name: "help" } };
  if (name !== "serve") throw new Error("Unknown command. Use: serve --resources PATH --data PATH");
  const paths = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]!;
    const value = args[index + 1];
    if (
      !["--resources", "--data"].includes(key) ||
      !value ||
      value.startsWith("--") ||
      paths.has(key)
    )
      throw new Error("Expected: serve --resources PATH --data PATH");
    paths.set(key, resolve(value));
  }
  const resourceRoot = paths.get("--resources");
  const dataDir = paths.get("--data");
  if (!resourceRoot || !dataDir) throw new Error("Both --resources and --data are required");
  return { ...context, command: { name, resourceRoot, dataDir } };
}
