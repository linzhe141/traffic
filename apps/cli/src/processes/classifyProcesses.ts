import type { DetectedProcess } from "@local-traffic/protocol";

/** CommandLine is confined to main-process classification and never returned to the renderer. */
export interface ProcessDetails {
  ProcessId: number;
  ParentProcessId?: number;
  Name: string;
  CommandLine?: string | null;
  ExecutablePath?: string | null;
  MainWindowTitle?: string | null;
  ProductName?: string | null;
  FileDescription?: string | null;
}
interface ProcessIdentity {
  key: string;
  displayName: string;
  category: DetectedProcess["category"];
  usePidTarget: boolean;
}

const knownApps: Record<string, string> = {
  "chrome.exe": "Google Chrome",
  "msedge.exe": "Microsoft Edge",
  "firefox.exe": "Firefox",
  "brave.exe": "Brave",
  "opera.exe": "Opera",
  "vivaldi.exe": "Vivaldi",
  "code.exe": "Visual Studio Code",
  "cursor.exe": "Cursor",
  "windsurf.exe": "Windsurf",
  "chatgpt.exe": "ChatGPT",
  "lark.exe": "Lark",
  "feishu.exe": "飞书",
  "wechat.exe": "WeChat",
  "weixin.exe": "WeChat",
  "postman.exe": "Postman",
};
const knownCli: Record<string, string> = {
  "codex.exe": "Codex CLI",
  "claude.exe": "Claude Code",
  "claude-code.exe": "Claude Code",
  "curl.exe": "curl",
  "wget.exe": "wget",
  "git.exe": "Git",
};
const runtimes: Record<string, string> = {
  "node.exe": "Node.js",
  "bun.exe": "Bun",
  "deno.exe": "Deno",
  "python.exe": "Python",
  "python3.exe": "Python",
  "pythonw.exe": "Python",
};
const engineNames = new Set([
  "mitmdump.exe",
  "mitmproxy.exe",
  "mitmweb.exe",
  "localredirector.exe",
  "windows-redirector.exe",
]);

function resolveHostedCli(name: string, commandLine: string): string | undefined {
  if (!runtimes[name]) return undefined;
  const args = [...commandLine.matchAll(/"([^"]*)"|(\S+)/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
  const flagsWithValue = new Set([
    "--require",
    "-r",
    "--import",
    "--loader",
    "--experimental-loader",
  ]);
  let script = "";
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]!;
    if (flagsWithValue.has(arg)) {
      index += 1;
      continue;
    }
    if (arg === "-e" || arg === "--eval" || arg === "-c" || arg === "-m") return undefined;
    if (arg.startsWith("-")) continue;
    script = arg.replaceAll("\\", "/");
    break;
  }
  if (/(?:^|\/)@anthropic-ai\/claude-code\/(?:cli|bin\/claude)\.(?:js|mjs|cjs)$/i.test(script))
    return "Claude Code";
  if (/(?:^|\/)@openai\/codex\/(?:bin\/codex|dist\/cli|cli)\.(?:js|mjs|cjs)$/i.test(script))
    return "Codex CLI";
  return undefined;
}

function classifyIdentity(
  name: string,
  commandLine: string,
  details: ProcessDetails,
): ProcessIdentity {
  const hostedCli = resolveHostedCli(name, commandLine);
  if (hostedCli)
    return {
      key: `hosted:${hostedCli}`,
      displayName: hostedCli,
      category: "cli",
      usePidTarget: true,
    };
  if (knownApps[name]) {
    const product = details.ProductName?.trim();
    const displayName =
      product && !/^(?:electron|microsoft.*windows.*)$/i.test(product) ? product : knownApps[name];
    const branded = displayName !== knownApps[name];
    return {
      key: branded ? `app:${details.ExecutablePath || name}`.toLowerCase() : name,
      displayName,
      category: "app",
      usePidTarget: branded,
    };
  }
  if (knownCli[name])
    return { key: name, displayName: knownCli[name], category: "cli", usePidTarget: false };
  if (runtimes[name])
    return {
      key: name,
      displayName: `${runtimes[name]} (other scripts)`,
      category: "cli",
      usePidTarget: true,
    };
  const product = [details.ProductName, details.FileDescription].find(
    (value) =>
      value?.trim() &&
      !/^(?:electron|node\.js|microsoft.*windows.*|windows.*)$/i.test(value.trim()),
  );
  const title = details.MainWindowTitle?.trim();
  if (product || title) {
    const displayName = product?.trim() || title!;
    return {
      key: `app:${details.ExecutablePath || name}`.toLowerCase(),
      displayName,
      category: "app",
      usePidTarget: true,
    };
  }
  return { key: name, displayName: name, category: "process", usePidTarget: false };
}

export function classifyProcesses(processes: ProcessDetails[], ownPid: number): DetectedProcess[] {
  const excluded = new Set([ownPid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of processes) {
      if (
        !excluded.has(row.ProcessId) &&
        row.ParentProcessId &&
        excluded.has(row.ParentProcessId)
      ) {
        excluded.add(row.ProcessId);
        changed = true;
      }
    }
  }
  const groups = new Map<string, { process: DetectedProcess; usePidTarget: boolean }>();
  for (const details of processes) {
    if (
      !Number.isSafeInteger(details.ProcessId) ||
      details.ProcessId <= 0 ||
      excluded.has(details.ProcessId)
    )
      continue;
    if (
      typeof details.Name !== "string" ||
      details.Name.length > 260 ||
      // oxlint-disable-next-line no-control-regex -- Windows executable names cannot contain control characters.
      /[\x00-\x1f\\/]/.test(details.Name)
    )
      continue;
    const name = details.Name.trim();
    const lookupName = name.toLowerCase();
    if (!name || engineNames.has(lookupName)) continue;
    const identity = classifyIdentity(
      lookupName,
      typeof details.CommandLine === "string" ? details.CommandLine : "",
      details,
    );
    let group = groups.get(identity.key);
    if (!group) {
      group = {
        process: {
          name,
          displayName: identity.displayName,
          pids: [],
          target: name,
          category: identity.category,
          searchTerms: [],
          executablePath: details.ExecutablePath || undefined,
        },
        usePidTarget: identity.usePidTarget,
      };
      groups.set(identity.key, group);
    }
    if (!group.process.pids.includes(details.ProcessId)) group.process.pids.push(details.ProcessId);
    for (const value of [
      details.ProductName,
      details.FileDescription,
      details.MainWindowTitle,
      details.ExecutablePath,
    ]) {
      if (typeof value === "string" && value.trim() && group.process.searchTerms!.length < 32) {
        const term = value.trim().slice(0, 512);
        if (!group.process.searchTerms!.includes(term)) group.process.searchTerms!.push(term);
      }
    }
  }
  const rank = { app: 0, cli: 1, process: 2 };
  return [...groups.values()]
    .map(({ process, usePidTarget }) => {
      process.pids.sort((left, right) => left - right);
      if (usePidTarget) process.target = process.pids.join(",");
      return process;
    })
    .sort(
      (left, right) =>
        rank[left.category] - rank[right.category] ||
        left.displayName.localeCompare(right.displayName),
    );
}
