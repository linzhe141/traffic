<script setup lang="ts">
import { computed, ref } from "vue";
import type { DetectedProcess, EngineInfo } from "../../shared/contracts";
import { buildNodeLaunchCommand } from "../utils/buildNodeLaunchCommand";
import AppButton from "./ui/AppButton.vue";

const props = defineProps<{ engine?: EngineInfo; port: number }>();
const open = ref(false);
const loading = ref(false);
const error = ref("");
const applications = ref<DetectedProcess[]>([]);
const selectedPath = ref("");
const command = computed(() =>
  selectedPath.value && props.engine?.certificateReady
    ? buildNodeLaunchCommand(selectedPath.value, props.engine.certificatePath, props.port)
    : "",
);
async function loadApplications() {
  open.value = true;
  loading.value = true;
  error.value = "";
  try {
    if (!window.trafficApi) throw new Error("请在桌面应用中生成启动命令。");
    applications.value = (await window.trafficApi.listProcesses()).filter(
      (process) => process.category === "app" && process.executablePath,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="mt-4 rounded-lg border border-black/10 bg-white/60 p-3 text-xs">
    <div class="flex items-center justify-between gap-3">
      <strong>Node / Electron 请求</strong>
      <AppButton :disabled="loading" @click="loadApplications">
        {{ loading ? "读取应用…" : "生成启动命令" }}
      </AppButton>
    </div>
    <p class="mt-2 leading-relaxed text-neutral-500">
      Node fetch 可能不使用 Windows 系统代理，也可能使用独立证书库。 支持环境代理的 Node
      运行时可通过启动命令接入抓取。
    </p>
    <div v-if="open" class="mt-3 space-y-3">
      <p v-if="error" role="alert" class="text-red-600">{{ error }}</p>
      <select
        v-model="selectedPath"
        aria-label="生成启动命令的应用"
        class="w-full rounded border border-black/15 bg-white px-2 py-1.5"
      >
        <option value="">选择要抓取的桌面应用</option>
        <option
          v-for="application in applications"
          :key="application.target"
          :value="application.executablePath"
        >
          {{ application.displayName }} · {{ application.name }}
        </option>
      </select>
      <p v-if="!engine?.certificateReady" class="text-neutral-500">
        请先启动一次抓取以生成 CA，然后刷新引擎状态。
      </p>
      <template v-if="command">
        <p class="leading-relaxed text-neutral-600">
          先开始兼容系统代理抓取，保存工作并完全退出目标应用，再在 PowerShell 执行下方命令。
          环境变量只传给这次启动的应用及其子进程，已运行的进程不会更新。
        </p>
        <textarea
          :value="command"
          readonly
          rows="8"
          aria-label="Node 应用抓取启动命令"
          class="w-full resize-y rounded border border-black/15 bg-white p-2 font-mono text-[11px]"
          @focus="($event.target as HTMLTextAreaElement).select()"
        />
        <p class="text-neutral-500">
          点击命令后按 Ctrl+C 复制。适用于支持环境代理的 Node
          版本；自定义网络代理或证书固定可能需要应用自身配置。
        </p>
      </template>
    </div>
  </section>
</template>
