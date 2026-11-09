import { createRuntime } from "@local-traffic/core";
import { listProcesses, resolveCaptureProcessTargets } from "./processes/listProcesses";
import { checkCertificateTrusted, resolvePublicCertificate } from "./setup/certificateSetup";
import { createEngineSetupService } from "./setup/engineSetupService";
import { checkFileExists, resolveEnginePaths } from "./setup/resolveEnginePaths";
import { createApplicationProxyLease } from "./systemProxy";

export function createCliRuntime(resourceRoot: string, dataDir: string) {
  const resolvePaths = () => resolveEnginePaths(resourceRoot, dataDir);
  const proxyLease = createApplicationProxyLease(dataDir);
  const setup = createEngineSetupService(resolvePaths, () =>
    process.platform === "win32" ? proxyLease.getUpstream() : Promise.resolve(undefined),
  );
  return createRuntime({
    engine: {
      proxyLease,
      resolvePaths,
      resolveTargets: resolveCaptureProcessTargets,
      async getCertificateState(confdir) {
        const certificatePath = await resolvePublicCertificate(confdir);
        return {
          ready: await checkFileExists(certificatePath),
          trusted: await checkCertificateTrusted(certificatePath),
        };
      },
    },
    platform: {
      initialize: () => proxyLease.recover(),
      getEngineInfo: setup.getEngineInfo,
      trustCertificate: setup.trustCertificate,
      listProcesses,
    },
  });
}
