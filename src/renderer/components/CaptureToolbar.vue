<script setup lang="ts">
import { Play, Pause, Trash2, Search, Settings2, PanelLeft, Moon, Sun } from "@lucide/vue";
import type { CaptureStatus } from "../../shared/contracts";
import IconButton from "./ui/IconButton.vue";
defineProps<{
  status: CaptureStatus;
  search: string;
  busy: boolean;
  enabled: boolean;
  count: number;
  total: number;
  dark: boolean;
  captureLabel: string;
  mode: "local" | "system-proxy";
}>();
defineEmits<{
  toggle: [];
  clear: [];
  settings: [];
  sidebar: [];
  theme: [];
  "update:search": [value: string];
}>();
</script>
<template>
  <header
    class="capture-toolbar drag-region flex h-12 shrink-0 items-center gap-3 border-b border-black/10 px-3"
  >
    <div class="no-drag flex items-center gap-1 border-r border-black/10 pr-3">
      <IconButton label="显示或隐藏侧栏" @click="$emit('sidebar')">
        <PanelLeft :size="17" />
      </IconButton>
      <IconButton
        :label="status.state === 'recording' ? '停止抓取' : '开始抓取'"
        :title="
          mode === 'system-proxy' && status.state === 'stopped'
            ? '开始并临时切换系统代理'
            : undefined
        "
        :disabled="busy || !enabled || status.state === 'starting' || status.state === 'stopping'"
        @click="$emit('toggle')"
      >
        <Pause v-if="status.state === 'recording'" :size="17" />
        <Play v-else :size="17" />
      </IconButton>
      <IconButton label="清空记录" :disabled="busy || !enabled || !total" @click="$emit('clear')">
        <Trash2 :size="17" />
      </IconButton>
    </div>
    <div
      class="status-pill flex min-w-0 items-center gap-2 rounded-full border border-black/5 bg-white/35 px-3 py-1"
    >
      <span class="status-dot" :class="status.state"></span>
      <strong class="shrink-0 text-[11px] font-medium">
        {{
          status.state === "recording"
            ? "Recording"
            : status.state === "starting"
              ? "Starting…"
              : status.state === "stopping"
                ? "Stopping…"
                : "Ready"
        }}
      </strong>
      <span class="truncate text-[11px] text-neutral-400" :title="status.target">
        {{ captureLabel }}
      </span>
    </div>
    <span class="ml-auto shrink-0 text-[11px] text-neutral-400">
      {{ count }}
      <template v-if="count !== total">/ {{ total }}</template>
      requests
    </span>
    <div class="no-drag flex items-center gap-2">
      <label
        class="search-field flex h-7 w-44 items-center gap-1.5 rounded-full border border-black/8 bg-white/40 px-2.5"
      >
        <Search :size="13" class="shrink-0 text-neutral-400" />
        <input
          class="w-full min-w-0 bg-transparent text-[11px] outline-none"
          aria-label="搜索请求"
          placeholder="域名、进程或协议"
          :value="search"
          @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <IconButton :label="dark ? '切换浅色模式' : '切换深色模式'" @click="$emit('theme')">
        <Sun v-if="dark" :size="16" />
        <Moon v-else :size="16" />
      </IconButton>
      <IconButton label="抓取设置" @click="$emit('settings')">
        <Settings2 :size="17" />
      </IconButton>
    </div>
  </header>
</template>
