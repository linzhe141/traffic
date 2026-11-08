import { createRuntime, type Runtime } from "../../core";
import { createEngineSetupService } from "../setup/engineSetupService";
import { resolveEnginePaths, checkFileExists } from "../setup/resolveEnginePaths";
import { createApplicationProxyLease } from "../systemProxy";
import { checkCertificateTrusted, resolvePublicCertificate } from "../setup/certificateSetup";
import { listProcesses, resolveCaptureProcessTargets } from "../processes/listProcesses";

/** Electron/Windows composition root. The core only receives explicit platform ports. */
export function createDesktopRuntime(): Runtime {
  const setup = createEngineSetupService();
  const proxyLease = createApplicationProxyLease();
  return createRuntime({
    engine: {
      proxyLease,
      resolvePaths: resolveEnginePaths,
      resolveTargets: resolveCaptureProcessTargets,
      async getCertificateState(confdir) {
        const path = await resolvePublicCertificate(confdir);
        return { ready: await checkFileExists(path), trusted: await checkCertificateTrusted(path) };
      },
    },
    platform: {
      initialize: () => proxyLease.recover(),
      getEngineInfo: () => setup.getEngineInfo(),
      trustCertificate: () => setup.trustCertificate(),
      revealCertificate: () => setup.revealCertificate(),
      listProcesses,
    },
  });
}
