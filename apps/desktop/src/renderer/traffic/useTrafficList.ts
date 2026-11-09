import { computed, ref, watch, type ShallowRef } from "vue";
import type { TrafficSnapshot, TrafficSourceApp } from "@local-traffic/protocol";
import { buildContentType } from "./format";
import {
  getContentCategory,
  matchesProtocol,
  type ContentFilter,
  type ProtocolFilter,
} from "./trafficFilters";

function appKey(app?: TrafficSourceApp) {
  if (!app) return "unknown";
  const path = app.executablePath;
  if (!path) return `name:${app.name}`;
  return `path:${path.includes("\\") ? path.toLowerCase() : path}`;
}

export function useTrafficList(snapshot: Readonly<ShallowRef<TrafficSnapshot>>) {
  const search = ref("");
  const protocolFilter = ref<ProtocolFilter>("");
  const contentFilter = ref<ContentFilter>("");
  const selectedDomain = ref("");
  const selectedApp = ref("");
  watch(
    snapshot,
    (next) => {
      if (
        selectedApp.value &&
        !next.records.some((record) => appKey(record.sourceApp) === selectedApp.value)
      )
        selectedApp.value = "";
      if (
        selectedDomain.value &&
        !next.records.some(
          (record) =>
            record.host === selectedDomain.value &&
            (!selectedApp.value || appKey(record.sourceApp) === selectedApp.value),
        )
      )
        selectedDomain.value = "";
    },
    { flush: "sync" },
  );
  function selectScope(kind: "all" | "domain" | "app", value = "") {
    selectedDomain.value = kind === "domain" ? value : "";
    if (kind !== "domain") selectedApp.value = kind === "app" ? value : "";
  }
  const records = computed(() => snapshot.value.records);
  const filteredRecords = computed(() => {
    const query = search.value.trim().toLowerCase();
    return records.value.filter(
      (record) =>
        (!selectedDomain.value || record.host === selectedDomain.value) &&
        (!selectedApp.value || appKey(record.sourceApp) === selectedApp.value) &&
        matchesProtocol(record, protocolFilter.value) &&
        (!contentFilter.value || getContentCategory(record) === contentFilter.value) &&
        (!query ||
          `${record.method} ${record.url} ${record.statusCode ?? ""} ${buildContentType(record)} ${record.clientAddress} ${record.sourceApp?.name ?? "未知应用"} ${record.sourceApp?.pid ?? ""} ${record.sourceApp?.executablePath ?? ""}`
            .toLowerCase()
            .includes(query)),
    );
  });
  const domains = computed(() => {
    const counts = new Map<string, number>();
    for (const record of records.value) {
      if (selectedApp.value && appKey(record.sourceApp) !== selectedApp.value) continue;
      counts.set(record.host, (counts.get(record.host) ?? 0) + 1);
    }
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  const apps = computed(() => {
    const groups = new Map<string, { key: string; name: string; path?: string; count: number }>();
    for (const { sourceApp } of records.value) {
      const key = appKey(sourceApp);
      const group = groups.get(key);
      if (group) group.count++;
      else
        groups.set(key, {
          key,
          name: sourceApp?.name ?? "未知应用",
          path: sourceApp?.executablePath,
          count: 1,
        });
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
  return {
    records,
    filteredRecords,
    search,
    protocolFilter,
    contentFilter,
    selectedDomain,
    selectedApp,
    apps,
    domains,
    selectScope,
  };
}
