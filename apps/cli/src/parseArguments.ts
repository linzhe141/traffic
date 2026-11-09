import { resolve } from "node:path";

type Command = { name: "help" } | { name: "serve"; resourceRoot: string; dataDir: string };

export function parseArguments(argv: string[]): Command {
  const [name, ...args] = argv;
  if (!name || name === "--help" || name === "help") return { name: "help" };
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
  return { name, resourceRoot, dataDir };
}
