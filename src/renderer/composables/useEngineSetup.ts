import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import type { EngineInfo, TrafficApi } from "../../shared/contracts";

export function useEngineSetup(
  api: TrafficApi | undefined,
  reportError: (message: string) => void,
) {
  const engine = shallowRef<EngineInfo>();
  const engineBusy = ref(false);
  let disposed = false;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  async function refreshEngine() {
    if (!api) return;
    const next = await api.getEngineInfo();
    if (!disposed) engine.value = next;
  }
  onMounted(() => {
    refreshTimer = setInterval(() => {
      if (
        api &&
        !engineBusy.value &&
        (!engine.value?.available || !engine.value?.certificateReady)
      ) {
        void refreshEngine().catch(() => undefined);
      }
    }, 5000);
  });
  onUnmounted(() => {
    disposed = true;
    clearInterval(refreshTimer);
  });
  async function processEngineAction(action: () => Promise<unknown>) {
    if (!api || engineBusy.value) return;
    engineBusy.value = true;
    try {
      await action();
      await refreshEngine();
    } catch (cause) {
      reportError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      engineBusy.value = false;
    }
  }
  return {
    engine,
    engineBusy,
    refreshEngine,
    checkEngine: () => processEngineAction(refreshEngine),
    revealCertificate: () => processEngineAction(() => api!.revealCertificate()),
    trustCertificate: () =>
      processEngineAction(async () => {
        engine.value = await api!.trustCertificate();
      }),
  };
}
