import { shell } from "electron";
import type { EngineInfo } from "../../shared/contracts";
import { normalizeErrorMessage } from "../../core/errors";
import {
  checkCertificateTrusted,
  resolvePublicCertificate,
  trustPublicCertificate,
} from "./certificateSetup";
import { checkFileExists, resolveEnginePaths } from "./resolveEnginePaths";
import { createEngineVersionReader } from "./createEngineVersionReader";
import { detectLoopbackSystemProxy } from "./detectNetworkEnvironment";
import { getSystemProxyUpstream } from "../systemProxy";

export function createEngineSetupService() {
  const readEngineVersion = createEngineVersionReader();
  async function getEngineInfo(): Promise<EngineInfo> {
    const paths = await resolveEnginePaths();
    const certificatePath = await resolvePublicCertificate(paths.confdir);
    const certificateReady = await checkFileExists(certificatePath);
    const [certificateTrusted, loopbackProxyEnabled, systemProxyUpstream] = await Promise.all([
      certificateReady ? checkCertificateTrusted(certificatePath) : Promise.resolve(false),
      detectLoopbackSystemProxy(),
      getSystemProxyUpstream().catch(() => undefined),
    ]);
    const info: EngineInfo = {
      available: false,
      executablePath: paths.executablePath,
      version: "",
      certificatePath,
      certificateReady,
      certificateTrusted,
      loopbackProxyEnabled,
      systemProxyUpstream,
    };
    try {
      if (!paths.executablePath)
        throw new Error("内置抓取引擎缺失，请重新安装应用或设置 MITMDUMP_PATH。");
      info.version = await readEngineVersion(paths.executablePath, paths.confdir);
      if (!(await checkFileExists(paths.addonPath)))
        throw new Error("Capture addon is missing. Reinstall the application.");
      info.available = true;
    } catch (error) {
      info.error = normalizeErrorMessage(error);
    }
    return info;
  }
  return {
    getEngineInfo,
    async revealCertificate(): Promise<void> {
      const { confdir } = await resolveEnginePaths();
      const certificatePath = await resolvePublicCertificate(confdir);
      if (!(await checkFileExists(certificatePath)))
        throw new Error("Start capture once to generate the public CA certificate.");
      shell.showItemInFolder(certificatePath);
    },
    async trustCertificate(): Promise<EngineInfo> {
      const { confdir } = await resolveEnginePaths();
      const certificatePath = await resolvePublicCertificate(confdir);
      if (!(await checkFileExists(certificatePath)))
        throw new Error("Start capture once to generate the public CA certificate.");
      await trustPublicCertificate(certificatePath);
      const info = await getEngineInfo();
      if (!info.certificateTrusted)
        throw new Error(
          "Certificate installation finished, but current-user root trust could not be verified.",
        );
      return info;
    },
  };
}
export type EngineSetupService = ReturnType<typeof createEngineSetupService>;
