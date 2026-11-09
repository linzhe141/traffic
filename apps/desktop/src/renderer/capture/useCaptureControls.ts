import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import type { TrafficApi } from "../../shared/desktopApi";
import type { CaptureMode, TrafficSnapshot } from "@local-traffic/protocol";
import { useEngineSetup } from "./useEngineSetup";

export function useCaptureControls(api: TrafficApi | undefined) {
  const snapshot = shallowRef<TrafficSnapshot>({
    records: [],
    revision: -1,
    status: { state: "stopped", host: "127.0.0.1", port: 9090 },
  });
  const mode = ref<CaptureMode>("local");
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
  function updateCaptureMode(next: CaptureMode) {
    modeChosen = true;
    mode.value = next;
  }
  let unsubscribe: (() => void) | undefined;
  let disposed = false;

  function updateSnapshot(next: TrafficSnapshot) {
    if (disposed || next.revision < snapshot.value.revision) return;
    snapshot.value = next;
  }

  async function runCaptureAction(action: (api: TrafficApi) => Promise<unknown>) {
    if (!api || busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      await action(api);
      updateSnapshot(await api.getSnapshot());
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busy.value = false;
    }
  }
  function toggleCapture() {
    return runCaptureAction(async (api) => {
      if (snapshot.value.status.state === "recording") {
        await api.stopCapture();
        return;
      }
      try {
        await api.startCapture({
          port: 9090,
          mode: mode.value,
          target: mode.value === "local" ? target.value : undefined,
          upstreamProxy: upstreamProxy.value.trim() || undefined,
        });
      } finally {
        void setup.refreshEngine().catch(() => undefined);
      }
    });
  }
  function clearTraffic() {
    return runCaptureAction((api) => api.clearTraffic());
  }
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
  };
}
