import { X509Certificate } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkFileExists } from "./resolveEnginePaths";
import { runBoundedCommand } from "./runBoundedCommand";

export async function resolvePublicCertificate(confdir: string): Promise<string> {
  // Deliberately exclude mitmproxy-ca.pem: that file contains the CA private key.
  for (const name of ["mitmproxy-ca-cert.cer", "mitmproxy-ca-cert.pem"]) {
    const path = join(confdir, name);
    if (await checkFileExists(path)) return path;
  }
  return join(confdir, "mitmproxy-ca-cert.cer");
}

export async function checkCertificateTrusted(certificatePath: string): Promise<boolean> {
  if (process.platform !== "win32") return false;
  try {
    const certificate = new X509Certificate(await readFile(certificatePath));
    const thumbprint = certificate.fingerprint.replaceAll(":", "");
    const output = await runBoundedCommand("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `if (Test-Path 'Cert:\\CurrentUser\\Root\\${thumbprint}') { 'trusted' }`,
    ]);
    return output === "trusted";
  } catch {
    return false;
  }
}

export async function trustPublicCertificate(certificatePath: string): Promise<void> {
  if (process.platform !== "win32")
    throw new Error("Automatic certificate trust is currently supported on Windows only.");
  // Parse before invoking certutil and only pass the known public certificate file.
  new X509Certificate(await readFile(certificatePath));
  await runBoundedCommand("certutil.exe", ["-user", "-addstore", "Root", certificatePath], 30_000);
}
