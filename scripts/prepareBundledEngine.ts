import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import extractZip from "extract-zip";
import manifest from "../resources/engine/manifest.json";

async function checkFileChecksum(path: string, checksum: string): Promise<boolean> {
  try {
    return (
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex") === checksum
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function downloadEngineArchive(path: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(manifest.archiveUrl, { signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const checksum = createHash("sha256").update(bytes).digest("hex");
      if (checksum !== manifest.archiveSha256) throw new Error("下载文件的 SHA-256 不匹配");
      await writeFile(path, bytes);
      return;
    } catch (error) {
      if (attempt === 3)
        throw new Error("无法下载内置抓取引擎，请检查网络后重新启动。", { cause: error });
    }
  }
}

/** Forge build-time preparation. The shipped app does not download or install Python. */
export async function prepareBundledEngine(root: string): Promise<void> {
  if (process.platform !== manifest.platform || process.arch !== manifest.arch) return;
  const targetDirectory = join(
    root,
    "resources",
    "engine",
    `${manifest.platform}-${manifest.arch}`,
  );
  const executablePath = join(targetDirectory, manifest.executableName);
  if (await checkFileChecksum(executablePath, manifest.executableSha256)) return;

  console.info(`正在准备内置 mitmproxy ${manifest.version}…`);
  const cacheDirectory = join(root, ".engine-cache");
  const archivePath = join(cacheDirectory, basename(new URL(manifest.archiveUrl).pathname));
  await mkdir(cacheDirectory, { recursive: true });
  if (!(await checkFileChecksum(archivePath, manifest.archiveSha256)))
    await downloadEngineArchive(archivePath);

  const extractionDirectory = join(
    cacheDirectory,
    `${manifest.version}-${manifest.platform}-${manifest.arch}`,
  );
  await extractZip(archivePath, { dir: extractionDirectory });
  const extractedPath = join(extractionDirectory, manifest.executableName);
  if (!(await checkFileChecksum(extractedPath, manifest.executableSha256)))
    throw new Error("内置引擎的 SHA-256 不匹配");
  await mkdir(targetDirectory, { recursive: true });
  await copyFile(extractedPath, executablePath);
}
