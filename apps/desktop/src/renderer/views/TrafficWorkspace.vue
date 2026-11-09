<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ShieldAlert, AlertCircle, X } from "@lucide/vue";
import NavigationButtons from "../components/NavigationButtons.vue";
import CaptureToolbar from "../capture/CaptureToolbar.vue";
import TrafficSidebar from "../traffic/TrafficSidebar.vue";
import TrafficTable from "../traffic/TrafficTable.vue";
import TrafficFilters from "../traffic/TrafficFilters.vue";
import RequestInspector from "../traffic/inspector/RequestInspector.vue";
import CaptureSettingsDialog from "../capture/CaptureSettingsDialog.vue";
import CaptureDiagnostics from "../traffic/CaptureDiagnostics.vue";
import ResizableGroup from "../components/ui/ResizableGroup.vue";
import ResizablePanel from "../components/ui/ResizablePanel.vue";
import ResizeHandle from "../components/ui/ResizeHandle.vue";
import { useCaptureControls } from "../capture/useCaptureControls";
import { useTrafficList } from "../traffic/useTrafficList";

const {
  snapshot,
  mode,
  target,
  updateCaptureMode,
  upstreamProxy,
  engine,
  engineBusy,
  checkEngine,
  trustCertificate,
  revealCertificate,
  busy,
  error,
  ready,
  hasBridge,
  toggleCapture,
  clearTraffic,
} = useCaptureControls(window.trafficApi);
const {
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
} = useTrafficList(snapshot);
const props = defineProps<{ requestId?: string }>();
const router = useRouter();
const selectedRecord = computed(
  () => records.value.find((record) => record.id === props.requestId) ?? null,
);
function selectRequest(requestId: string) {
  diagnosticsVisible.value = false;
  void router.push({ name: "traffic", params: { requestId } });
}
const settingsVisible = ref(false);
const sidebarVisible = ref(true);
const diagnosticsVisible = ref(false);
watch(
  () => props.requestId,
  () => {
    diagnosticsVisible.value = false;
  },
);
const savedTheme = localStorage.getItem("local-traffic-theme");
const dark = ref(
  savedTheme === "dark" ||
    (savedTheme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches),
);
watch(
  dark,
  (value) => {
    document.documentElement.dataset.theme = value ? "dark" : "light";
    localStorage.setItem("local-traffic-theme", value ? "dark" : "light");
  },
  { immediate: true },
);
const activeMode = computed(() =>
  snapshot.value.status.state === "stopped" ? mode.value : snapshot.value.status.mode || mode.value,
);
const captureLabel = computed(() =>
  activeMode.value === "system-proxy"
    ? "所有走系统代理的应用"
    : target.value.trim()
      ? "所选进程"
      : "选择本地进程",
);
function processToggle() {
  if (snapshot.value.status.state === "stopped" && mode.value === "local" && !target.value.trim()) {
    settingsVisible.value = true;
    return;
  }
  void toggleCapture();
}
const locked = computed(() => busy.value || snapshot.value.status.state !== "stopped");
</script>
<template>
  <div class="app-shell flex h-screen min-h-0 min-w-0 flex-col overflow-hidden">
    <ResizableGroup direction="horizontal">
      <template v-if="sidebarVisible">
        <ResizablePanel :default-size="17" :min-size="13" :max-size="30">
          <TrafficSidebar
            :total="records.length"
            :domains="domains"
            :apps="apps"
            :selected-domain="selectedDomain"
            :selected-app="selectedApp"
            :capture-label="captureLabel"
            @scope="selectScope"
          >
            <NavigationButtons />
          </TrafficSidebar>
        </ResizablePanel>
        <ResizeHandle label="调整侧栏宽度" />
      </template>
      <ResizablePanel :default-size="83" :min-size="65">
        <main class="workspace-surface flex h-full min-w-0 flex-col">
          <CaptureToolbar
            v-model:search="search"
            :mode="activeMode"
            :status="snapshot.status"
            :busy="busy || engineBusy"
            :enabled="hasBridge && ready"
            :count="filteredRecords.length"
            :total="records.length"
            :dark="dark"
            :capture-label="captureLabel"
            @toggle="processToggle"
            @clear="clearTraffic"
            @settings="settingsVisible = true"
            @sidebar="sidebarVisible = !sidebarVisible"
            @theme="dark = !dark"
          >
            <NavigationButtons v-if="!sidebarVisible" />
          </CaptureToolbar>
          <TrafficFilters
            v-model:protocol="protocolFilter"
            v-model:content="contentFilter"
            @reset="
              protocolFilter = '';
              contentFilter = '';
            "
          />
          <div
            v-if="engine?.certificateReady && !engine.certificateTrusted"
            class="compact-notice flex h-7 shrink-0 items-center gap-2 border-b border-amber-200/60 bg-amber-50/60 px-3 text-[10px] text-amber-800"
          >
            <ShieldAlert :size="12" />
            <span>HTTPS certificate not trusted · 本地 CA 尚未信任</span>
            <button
              class="ml-auto underline decoration-amber-300 underline-offset-2"
              @click="settingsVisible = true"
            >
              证书设置
            </button>
          </div>
          <div
            v-if="error || snapshot.status.error"
            class="flex min-h-7 shrink-0 items-center gap-2 border-b border-red-100 bg-red-50 px-3 py-1 text-[10px] text-red-600"
            role="alert"
          >
            <AlertCircle :size="12" />
            <span class="flex-1">{{ error || snapshot.status.error }}</span>
            <button @click="settingsVisible = true">打开设置</button>
            <button v-if="error" aria-label="关闭错误提示" @click="error = ''">
              <X :size="12" />
            </button>
          </div>
          <p
            v-if="snapshot.status.state === 'starting'"
            class="border-b border-black/5 bg-neutral-50 px-3 py-1.5 text-[10px] text-neutral-500"
            role="status"
          >
            {{
              activeMode === "system-proxy"
                ? "正在启动兼容模式，临时切换系统代理；停止后恢复原设置。"
                : "正在启动抓取内核。Windows 如弹出 windows-redirector.exe 管理员授权，请确认后允许。"
            }}
          </p>
          <ResizableGroup direction="vertical">
            <ResizablePanel :default-size="39" :min-size="18">
              <div class="flex h-full min-h-0 flex-col">
                <TrafficTable
                  :records="filteredRecords"
                  :selected-id="requestId ?? ''"
                  :capturing="snapshot.status.state === 'recording'"
                  :has-records="!!records.length"
                  @select="selectRequest"
                  @settings="settingsVisible = true"
                />
              </div>
            </ResizablePanel>
            <ResizeHandle label="调整请求列表和详情高度" />
            <ResizablePanel :default-size="61" :min-size="25">
              <CaptureDiagnostics
                v-if="snapshot.diagnostics?.length && (diagnosticsVisible || !records.length)"
                :diagnostics="snapshot.diagnostics"
              />
              <RequestInspector v-else :record="selectedRecord" />
            </ResizablePanel>
          </ResizableGroup>
          <footer
            class="workspace-footer flex h-6 shrink-0 items-center gap-2 border-t border-black/10 px-3 text-[9px] text-neutral-400"
          >
            <span class="status-dot" :class="snapshot.status.state"></span>
            <span>
              {{ snapshot.status.state === "recording" ? "Capturing" : "Capture stopped" }}
            </span>
            <span class="text-neutral-300">|</span>
            <span>
              {{
                activeMode === "system-proxy"
                  ? "System Proxy · 停止后恢复系统代理"
                  : "Local · Process capture"
              }}
            </span>
            <button
              v-if="snapshot.diagnostics?.length && records.length"
              class="rounded px-1 hover:text-neutral-700"
              :aria-pressed="diagnosticsVisible"
              @click="diagnosticsVisible = !diagnosticsVisible"
            >
              {{
                diagnosticsVisible ? "查看请求详情" : `连接诊断 · ${snapshot.diagnostics.length}`
              }}
            </button>
            <span class="ml-auto">
              HTTP / HTTPS / SSE
              <span class="mx-2 text-neutral-300">·</span>
              In-memory session
            </span>
          </footer>
        </main>
      </ResizablePanel>
    </ResizableGroup>
    <CaptureSettingsDialog
      v-model:open="settingsVisible"
      v-model:upstream-proxy="upstreamProxy"
      v-model:target="target"
      :mode="mode"
      :engine="engine"
      :locked="locked"
      :busy="busy || engineBusy"
      :has-bridge="hasBridge"
      @update:mode="updateCaptureMode"
      @refresh="checkEngine"
      @trust="trustCertificate"
      @reveal="revealCertificate"
    />
  </div>
</template>
