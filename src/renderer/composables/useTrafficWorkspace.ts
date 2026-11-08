import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import type { TrafficApi, TrafficSnapshot, TrafficSourceApp } from "../../shared/contracts";
import { useEngineSetup } from "./useEngineSetup";
import { buildContentType } from "../utils/format";
import {
  getContentCategory,
  matchesProtocol,
  type ContentFilter,
  type ProtocolFilter,
} from "../utils/trafficFilters";

function appKey(app?: TrafficSourceApp) {
  if (!app) return "unknown";
  const path = app.executablePath;
  if (!path) return `name:${app.name}`;
  return `path:${path.includes("\\") ? path.toLowerCase() : path}`;
}

export function useTrafficWorkspace() {
  const api: TrafficApi | undefined = window.trafficApi;
  const snapshot = shallowRef<TrafficSnapshot>({
    records: [],
    revision: -1,
    status: { state: "stopped", host: "127.0.0.1", port: 9090 },
  });
  const search = ref("");
  const protocolFilter = ref<ProtocolFilter>("");
  const contentFilter = ref<ContentFilter>("");
  const selectedDomain = ref("");
  const selectedApp = ref("");
  const selectedId = ref("");
  const mode = ref<"local" | "system-proxy">("local");
  const target = ref("");
  let modeChosen = false;
  const upstreamProxy = ref("");
  const busy = ref(false);
  const error = ref("");
  const ready = ref(false);
  const setup = useEngineSetup(api, (message) => {
    error.value = message;
  });
  watch(
    () => setup.engine.value?.loopbackProxyEnabled,
    (enabled) => {
      if (enabled && !modeChosen && snapshot.value.status.state === "stopped")
        mode.value = "system-proxy";
    },
  );
  function updateCaptureMode(next: "local" | "system-proxy") {
    modeChosen = true;
    mode.value = next;
  }
  let unsubscribe: (() => void) | undefined;
  let disposed = false;

  function updateSnapshot(next: TrafficSnapshot) {
    if (disposed || next.revision < snapshot.value.revision) return;
    snapshot.value = next;
    if (!next.records.some((record) => record.id === selectedId.value)) selectedId.value = "";
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
  }
  async function processAction(action: () => Promise<unknown>) {
    if (!api || busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      await action();
      updateSnapshot(await api.getSnapshot());
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busy.value = false;
    }
  }
  function toggleCapture() {
    if (!api) return;
    if (snapshot.value.status.state === "recording") return processAction(() => api.stopCapture());
    if (mode.value === "local" && !target.value.trim()) {
      error.value = "请选择要抓取的应用，或填写进程名 / PID。";
      return;
    }
    if (upstreamProxy.value.trim()) {
      try {
        const url = new URL(upstreamProxy.value.trim());
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        )
          throw new Error();
      } catch {
        error.value =
          "上游代理请使用不含认证信息的 HTTP 或 HTTPS 地址，例如 http://127.0.0.1:7890。";
        return;
      }
    }
    return processAction(async () => {
      try {
        await api.startCapture({
          port: 9090,
          mode: mode.value,
          target: mode.value === "local" ? target.value : undefined,
          upstreamProxy: upstreamProxy.value.trim() || undefined,
        });
      } finally {
        await setup.refreshEngine();
      }
    });
  }
  function clearTraffic() {
    if (api) return processAction(() => api.clearTraffic());
  }
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
  const selectedRecord = computed(
    () => filteredRecords.value.find((record) => record.id === selectedId.value) ?? null,
  );
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
  onMounted(async () => {
    if (!api) {
      ready.value = true;
      return;
    }
    try {
      unsubscribe = api.onSnapshot(updateSnapshot);
      updateSnapshot(await api.getSnapshot());
      await setup.refreshEngine();
    } catch (cause) {
      error.value = String(cause);
    } finally {
      ready.value = true;
    }
  });
  onUnmounted(() => {
    disposed = true;
    unsubscribe?.();
  });
  return {
    snapshot,
    records,
    filteredRecords,
    selectedRecord,
    selectedId,
    search,
    protocolFilter,
    contentFilter,
    selectedDomain,
    selectedApp,
    apps,
    domains,
    mode,
    target,
    updateCaptureMode,
    upstreamProxy,
    ...setup,
    busy,
    error,
    ready,
    hasBridge: !!api,
    toggleCapture,
    clearTraffic,
    selectScope,
  };
}
