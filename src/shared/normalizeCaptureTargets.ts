/** A comma-separated allow-list. Exclusions and wildcard capture are intentionally unsupported. */
export function normalizeCaptureTargets(input: unknown): string {
  if (typeof input !== "string" || input.length > 8192) {
    throw new Error("请选择应用，或填写进程名 / PID，多个目标用逗号分隔。");
  }
  const targets = input.split(",").map((target) => target.trim());
  if (
    !targets.length ||
    targets.length > 64 ||
    targets.some(
      (target) =>
        !target || target.length > 128 || !/^[\p{L}\p{N}_][\p{L}\p{N}_. -]*$/u.test(target),
    )
  ) {
    throw new Error("目标须为有效进程名或 PID，最多 64 个，不支持通配符或排除表达式。");
  }
  // The native redirector matches names case-sensitively; keep resolved case variants.
  return [...new Set(targets)].join(",");
}
