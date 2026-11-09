import { mkdir, statfs } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Give the bundled bootloader its own writable extraction directory. */
export async function prepareEngineEnvironment(confdir: string): Promise<NodeJS.ProcessEnv> {
  const temporaryDirectory = join(dirname(confdir), "engine-temp");
  await mkdir(temporaryDirectory, { recursive: true });
  const disk = await statfs(temporaryDirectory);
  const available = disk.bavail * disk.bsize;
  if (available < 256 * 1024 * 1024) {
    throw new Error(
      `抓取引擎解压空间不足：${temporaryDirectory} 所在磁盘仅剩 ${Math.floor(available / 1024 / 1024)} MiB，至少需要 256 MiB。请释放空间后重试。`,
    );
  }
  return {
    ...process.env,
    TEMP: temporaryDirectory,
    TMP: temporaryDirectory,
    TMPDIR: temporaryDirectory,
    PYTHONUNBUFFERED: "1",
    PYTHONDONTWRITEBYTECODE: "1",
  };
}
