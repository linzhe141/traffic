<script setup lang="ts">
import { useProcessTargets } from "./useProcessTargets";
import ProcessIcon from "../components/ProcessIcon.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppInput from "../components/ui/AppInput.vue";
const props = defineProps<{
  target: string;
  locked: boolean;
  hasBridge: boolean;
}>();
const emit = defineEmits<{ "update:target": [value: string] }>();
const {
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
} = useProcessTargets(
  window.trafficApi,
  () => props.target,
  (value) => emit("update:target", value),
);
const categories = [
  { value: "all", label: "全部" },
  { value: "app", label: "应用" },
  { value: "cli", label: "CLI 工具" },
  { value: "process", label: "其他进程" },
] as const;
</script>

<template>
  <section class="process-picker" aria-label="自动发现抓取目标">
    <div class="process-picker-heading">
      <strong>选择正在运行的应用或 CLI</strong>
      <span>{{ processes.length }} 个目标 · 可多选</span>
      <AppButton :disabled="loading || !hasBridge" @click="refreshProcesses">
        {{ loading ? "检测中…" : "刷新进程" }}
      </AppButton>
    </div>
    <div class="process-picker-filters">
      <div class="process-categories" aria-label="进程类别">
        <button
          v-for="item in categories"
          :key="item.value"
          :aria-pressed="category === item.value"
          @click="category = item.value"
        >
          {{ item.label }}
        </button>
      </div>
      <AppInput
        v-model="search"
        aria-label="搜索应用或 CLI"
        placeholder="搜索应用名、窗口标题或可执行文件…"
      />
    </div>
    <p v-if="error" class="process-picker-error" role="alert">{{ error }}</p>
    <div class="process-options">
      <button
        v-for="process in visibleProcesses"
        :key="process.target"
        class="process-option"
        :class="{ selected: isSelected(process.target) }"
        :disabled="locked"
        :aria-pressed="isSelected(process.target)"
        :title="`${process.name} · PID ${process.pids.join(', ')}`"
        @click="toggleTarget(process.target)"
      >
        <span class="process-checkbox">
          {{ isSelected(process.target) ? "✓" : "" }}
        </span>
        <ProcessIcon :path="process.executablePath" />
        <span class="process-description">
          <strong>{{ process.displayName }}</strong>
          <small>{{ process.name }} · PID {{ process.pids.join(", ") }}</small>
        </span>
        <span class="process-type">
          {{ process.category === "cli" ? "CLI" : process.category === "app" ? "APP" : "进程" }}
        </span>
      </button>
      <p v-if="!visibleProcesses.length && !loading" class="process-picker-empty">
        {{
          !hasBridge
            ? "请在桌面端检测进程"
            : search
              ? "没有匹配的运行进程"
              : "未检测到此类别的运行进程；启动目标应用后刷新，或在下方手动填写。"
        }}
      </p>
      <p v-if="loading && !processes.length" class="process-picker-empty">正在扫描本机运行进程…</p>
    </div>
    <div v-if="selectedTargets.length" class="selected-processes">
      <span>已选择</span>
      <button
        v-for="target in selectedTargets"
        :key="target"
        :disabled="locked"
        :aria-label="`移除目标 ${target}`"
        @click="toggleTarget(target)"
      >
        {{ target }}
        <span>×</span>
      </button>
    </div>
    <p v-else class="process-picker-hint">启动目标应用后刷新即可选择。</p>
  </section>
</template>
