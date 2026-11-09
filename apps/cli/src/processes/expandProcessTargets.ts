import type { ProcessDetails } from "./classifyProcesses";

function checkSafeName(name: string): boolean {
  return name.length <= 128 && /^[\p{L}\p{N}_][\p{L}\p{N}_. -]*$/u.test(name);
}

/** Keep actual executable casing and include current descendant executables of selected apps. */
export function expandProcessTargets(
  target: string,
  processes: ProcessDetails[],
  ownPid: number,
): string {
  const rows = processes.filter(
    (row) =>
      Number.isSafeInteger(row.ProcessId) &&
      row.ProcessId > 0 &&
      row.ProcessId !== ownPid &&
      typeof row.Name === "string" &&
      checkSafeName(row.Name) &&
      !/^(?:mitmdump|mitmproxy|mitmweb|localredirector|windows-redirector)\.exe$/i.test(row.Name),
  );
  const selected = target
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const names = selected.filter((item) => !/^\d+$/.test(item));
  const pids = new Set(selected.filter((item) => /^\d+$/.test(item)).map(Number));
  const nameMatches = (row: ProcessDetails) =>
    names.some((name) => name.toLowerCase() === row.Name.toLowerCase());
  const matched = new Set(
    rows.filter((row) => pids.has(row.ProcessId) || nameMatches(row)).map((row) => row.ProcessId),
  );
  const pidScoped = new Map(
    rows
      .filter((row) => matched.has(row.ProcessId))
      .map((row) => [row.ProcessId, !nameMatches(row)]),
  );
  const descendants = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (matched.has(row.ProcessId) || descendants.has(row.ProcessId)) continue;
      if (
        row.ParentProcessId !== undefined &&
        (matched.has(row.ParentProcessId) || descendants.has(row.ParentProcessId))
      ) {
        descendants.add(row.ProcessId);
        pidScoped.set(row.ProcessId, pidScoped.get(row.ParentProcessId) ?? false);
        changed = true;
      }
    }
  }
  const expanded = new Set<string>();
  for (const item of selected) {
    const exactNames = rows
      .filter((row) => row.Name.toLowerCase() === item.toLowerCase())
      .map((row) => row.Name);
    for (const name of exactNames.length ? exactNames : [item]) expanded.add(name);
  }
  for (const row of rows) {
    if (!descendants.has(row.ProcessId)) continue;
    // Runtime executables may also host unrelated scripts, so scope those children to PID.
    expanded.add(
      pidScoped.get(row.ProcessId) ||
        /^(?:node|bun|deno|python\d*|pythonw|cmd|powershell|pwsh|conhost|crashpad_handler|extension-host)\.exe$/i.test(
          row.Name,
        )
        ? String(row.ProcessId)
        : row.Name,
    );
  }
  if (expanded.size > 64) throw new Error("应用子进程超过 64 个抓取目标，请选择范围较小的应用。");
  return [...expanded].join(",");
}
