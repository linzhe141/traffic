<script setup lang="ts">
import { Globe2, AppWindow, CircleSlash } from "@lucide/vue";
import ProcessIcon from "../components/ProcessIcon.vue";
defineProps<{
  total: number;
  domains: { name: string; count: number }[];
  apps: { key: string; name: string; path?: string; count: number }[];
  selectedDomain: string;
  selectedApp: string;
  captureLabel: string;
}>();
defineEmits<{
  scope: [kind: "all" | "domain" | "app", value?: string];
}>();
</script>
<template>
  <aside class="sidebar flex h-full min-w-0 flex-col bg-[#e9eaec]">
    <div
      class="drag-region flex h-12 shrink-0 items-center gap-2 px-2 text-[12px] font-semibold tracking-tight text-neutral-600"
    >
      <slot />
      <span class="truncate">Local Traffic</span>
    </div>
    <div class="px-2 pb-3">
      <button
        class="scope-row"
        :class="{ active: !selectedDomain && !selectedApp }"
        @click="$emit('scope', 'all')"
      >
        <Globe2 :size="17" class="text-blue-500" />
        <span>All Traffic</span>
        <span class="ml-auto text-[10px] opacity-50">{{ total }}</span>
      </button>
    </div>
    <div class="shrink-0 pb-3">
      <div class="section-heading">抓取目标</div>
      <div class="scope-row" title="每次开始时重新查找桌面应用和子进程">
        <AppWindow :size="16" class="text-amber-500" />
        <span class="truncate">{{ captureLabel }}</span>
      </div>
    </div>
    <div class="flex min-h-0 flex-1 flex-col">
      <section class="flex max-h-[55%] min-h-0 shrink-0 flex-col" aria-label="来源进程">
        <div class="section-heading shrink-0">来源进程</div>
        <div class="min-h-0 overflow-y-auto">
          <button
            v-for="app in apps"
            :key="app.key"
            class="scope-row"
            :class="{ active: selectedApp === app.key }"
            :aria-pressed="selectedApp === app.key"
            :title="app.path || app.name"
            @click="$emit('scope', 'app', app.key)"
          >
            <ProcessIcon :path="app.path" />
            <span class="truncate">{{ app.name }}</span>
            <span class="ml-auto text-[10px] opacity-40">{{ app.count }}</span>
          </button>
          <p v-if="!apps.length" class="px-4 py-2 text-[10px] text-neutral-400">
            捕获请求后按来源应用分组
          </p>
        </div>
      </section>
      <section
        class="mt-4 flex min-h-0 flex-1 flex-col border-t border-[var(--border)] pt-2"
        aria-label="域名"
      >
        <div class="section-heading shrink-0">
          {{ selectedApp ? "该进程的域名" : "全部域名" }}
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto pb-4">
          <button
            v-for="domain in domains"
            :key="domain.name"
            class="scope-row"
            :class="{ active: selectedDomain === domain.name }"
            :aria-pressed="selectedDomain === domain.name"
            :title="domain.name"
            @click="$emit('scope', 'domain', domain.name)"
          >
            <CircleSlash :size="16" class="text-neutral-400" />
            <span class="truncate">{{ domain.name }}</span>
            <span class="ml-auto text-[10px] opacity-40">{{ domain.count }}</span>
          </button>
          <p v-if="!domains.length" class="px-4 py-2 text-[10px] text-neutral-400">
            请求域名将在这里显示
          </p>
        </div>
      </section>
    </div>
    <div
      class="flex h-7 shrink-0 items-center border-t border-black/5 px-4 text-[9px] text-neutral-400"
    >
      In-memory session
      <span class="ml-auto">v0.1</span>
    </div>
  </aside>
</template>
