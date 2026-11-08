import { runBoundedCommand } from "./runBoundedCommand";
import { prepareEngineEnvironment } from "../../core/adapters/mitmproxy/prepareEngineEnvironment";

export function createEngineVersionReader() {
  const versions = new Map<string, Promise<string>>();
  return function readEngineVersion(executablePath: string, confdir: string): Promise<string> {
    const cached = versions.get(executablePath);
    if (cached) return cached;
    // The official standalone executable unpacks its runtime on launch.
    const result = prepareEngineEnvironment(confdir)
      .then((environment) => runBoundedCommand(executablePath, ["--version"], 45_000, environment))
      .then((output) => output.split(/\r?\n/)[0].replace(/^Mitmproxy:\s*/i, ""))
      .catch((error: unknown) => {
        versions.delete(executablePath);
        throw error;
      });
    versions.set(executablePath, result);
    return result;
  };
}
