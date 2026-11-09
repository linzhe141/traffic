import { normalizeErrorMessage } from "@local-traffic/core";
import { createCliRuntime } from "./createCliRuntime";
import { parseArguments } from "./parseArguments";
import { serveCli } from "./serveCli";

async function main(): Promise<void> {
  const command = parseArguments(process.argv.slice(2));
  const { stdin, stdout, stderr } = process;
  if (command.name === "help") {
    stdout.write("Usage: node capture-cli.cjs serve --resources PATH --data PATH\n");
    return;
  }
  const runtime = createCliRuntime(command.resourceRoot, command.dataDir);
  await serveCli(runtime, { stdin, stdout, stderr });
}

void main().catch((error) => {
  process.stderr.write(normalizeErrorMessage(error) + "\n");
  process.exitCode = 1;
});
