import { normalizeErrorMessage } from "../core/errors";
import { normalizeContext } from "./normalizeContext";
import { runCommand } from "./runCommand";

const context = {
  argv: process.argv.slice(2),
  stderr: process.stderr,
  stdin: process.stdin,
  stdout: process.stdout,
};

async function main() {
  const normalized = normalizeContext(context);
  await runCommand(normalized.command, normalized);
}

void main().catch((error) => {
  context.stderr.write(normalizeErrorMessage(error) + "\n");
  process.exitCode = 1;
});
