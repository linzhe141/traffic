import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import type { DetectedProcess, TrafficApi } from "../../shared/contracts";
import { matchesProcessSearch } from "../utils/matchesProcessSearch";
import {
  isProcessTargetGroupSelected,
  normalizeProcessTargetTokens,
  updateProcessTargetSelection,
} from "../utils/processTargets";

type ProcessCategory = DetectedProcess["category"] | "all";

export function useProcessTargets(
  api: TrafficApi | undefined,
  getTarget: () => string,
  updateTarget: (value: string) => void,
) {
  const processes = shallowRef<DetectedProcess[]>([]);
  const search = ref("");
  const category = ref<ProcessCategory>("all");
  const loading = ref(false);
  const error = ref("");
  let disposed = false;
  const selectedTargets = computed(() => normalizeProcessTargetTokens(getTarget()));
  const visibleProcesses = computed(() => {
    const query = search.value.trim().toLowerCase();
    return processes.value.filter(
      (process) =>
        (category.value === "all" || process.category === category.value) &&
        (!query || matchesProcessSearch(process, query)),
    );
  });
  function isSelected(target: string) {
    return isProcessTargetGroupSelected(selectedTargets.value, target);
  }
  function toggleTarget(target: string) {
    const next = updateProcessTargetSelection(selectedTargets.value, target);
    updateTarget(next.join(","));
  }
  async function refreshProcesses() {
    if (!api || loading.value) return;
    loading.value = true;
    error.value = "";
    try {
      const next = await api.listProcesses();
      if (!disposed) processes.value = next;
    } catch (cause) {
      if (!disposed) error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (!disposed) loading.value = false;
    }
  }
  onMounted(refreshProcesses);
  onUnmounted(() => {
    disposed = true;
  });
  return {
    processes,
    visibleProcesses,
    search,
    category,
    loading,
    error,
    selectedTargets,
    isSelected,
    toggleTarget,
    refreshProcesses,
  };
}
