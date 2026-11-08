import { app, nativeImage } from "electron";
import { readFile } from "node:fs/promises";
import { win32 } from "node:path";
import type { ProcessIconVariants } from "../../shared/contracts";

async function readPackagedIcon(executable: string): Promise<ProcessIconVariants | null> {
  const packageMatch = /^(.*[\\/]WindowsApps[\\/][^\\/]+)[\\/](.+)$/i.exec(executable);
  if (!packageMatch) return null;
  const root = packageMatch[1]!;
  const relativeExe = win32.normalize(packageMatch[2]!).toLowerCase();
  const manifest = await readFile(win32.join(root, "AppxManifest.xml"), "utf8");
  for (const match of manifest.matchAll(/<Application\b([^>]*)>([\s\S]*?)<\/Application>/gi)) {
    const [, attributes, content] = match;
    const declared = /\bExecutable\s*=\s*["']([^"']+)["']/i.exec(attributes ?? "")?.[1];
    if (!declared || win32.normalize(declared).toLowerCase() !== relativeExe) continue;
    const asset = /\bSquare44x44Logo\s*=\s*["']([^"']+)["']/i.exec(content ?? "")?.[1];
    if (
      !asset ||
      !/^[^:\\/]([^:\0]*?)\.png$/i.test(asset) ||
      asset.split(/[\\/]/).some((part) => part === "..")
    )
      return null;
    const stem = asset.slice(0, -4);
    function load(paths: string[]) {
      for (const path of paths) {
        const icon = nativeImage.createFromPath(win32.join(root, path));
        if (!icon.isEmpty()) return icon.resize({ width: 32, height: 32 }).toDataURL();
      }
      return null;
    }
    const fallback = load([asset, `${stem}.scale-100.png`, `${stem}.scale-200.png`]);
    const light = load(
      [32, 24, 16].map((size) => `${stem}.targetsize-${size}_altform-lightunplated.png`),
    );
    const dark = load(
      [32, 24, 16].map((size) => `${stem}.targetsize-${size}_altform-unplated.png`),
    );
    const defaultIcon = fallback ?? dark ?? light;
    return defaultIcon ? { light: light ?? defaultIcon, dark: dark ?? defaultIcon } : null;
  }
  return null;
}

export async function readProcessIcon(executable: string): Promise<ProcessIconVariants | null> {
  const packaged = await readPackagedIcon(executable).catch(() => null);
  if (packaged) return packaged;
  const icon = await app.getFileIcon(executable, { size: "small" });
  if (icon.isEmpty()) return null;
  const data = icon.toDataURL();
  return { light: data, dark: data };
}
