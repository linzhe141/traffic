import { createCliRuntime } from "./createCliRuntime";
import type { CliContext, Command } from "./normalizeContext";
import { serveCli } from "./serveCli";

export async function runCommand(command: Command, context: CliContext): Promise<void> {
  if (command.name === "help") {
    context.stdout.write("Usage: node capture-cli.cjs serve --resources PATH --data PATH\n");
    return;
  }
  await serveCli(createCliRuntime(command.resourceRoot, command.dataDir), context);
}
