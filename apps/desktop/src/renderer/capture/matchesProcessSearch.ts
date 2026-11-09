import type { DetectedProcess } from "@local-traffic/protocol";

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function matchesProcessSearch(process: DetectedProcess, query: string): boolean {
  const haystack = normalizeSearchText(
    [process.displayName, process.name, ...(process.searchTerms ?? []), ...process.pids].join(" "),
  );
  return query
    .trim()
    .split(/\s+/)
    .every((term) => haystack.includes(normalizeSearchText(term)));
}
