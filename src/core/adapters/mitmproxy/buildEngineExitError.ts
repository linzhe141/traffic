export function buildEngineExitError(
  code: number | null,
  signal: string | null,
  output: string,
  temporaryDirectory?: string,
): Error {
  const details = output.trim();
  const hint = /Failed to extract|decompression resulted/i.test(details)
    ? `内置引擎运行时解压失败，请检查临时目录的可用空间和写入权限：${temporaryDirectory ?? ""}。\n`
    : "";
  return new Error(`${hint}Capture engine exited (${code ?? signal ?? "unknown"}). ${details}`);
}
