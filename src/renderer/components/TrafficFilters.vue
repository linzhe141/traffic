<script setup lang="ts">
import {
  contentFilters,
  protocolFilters,
  type ContentFilter,
  type ProtocolFilter,
} from "../utils/trafficFilters";
defineProps<{ protocol: ProtocolFilter; content: ContentFilter }>();
defineEmits<{
  "update:protocol": [filter: ProtocolFilter];
  "update:content": [filter: ContentFilter];
  reset: [];
}>();
</script>

<template>
  <div
    class="traffic-filters flex h-8 shrink-0 items-center justify-between gap-3 border-b border-black/10 px-3 text-[10px]"
  >
    <div class="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
      <button
        v-for="item in ['', ...protocolFilters] as const"
        :key="item"
        class="rounded px-2 py-1 text-neutral-600 hover:bg-black/5 aria-pressed:bg-blue-100 aria-pressed:text-blue-700"
        :aria-pressed="protocol === item"
        @click="$emit('update:protocol', item)"
      >
        {{ item || "All" }}
      </button>
      <span class="mx-1 h-3 w-px shrink-0 bg-neutral-200" aria-hidden="true"></span>
      <button
        v-for="item in contentFilters"
        :key="item"
        class="rounded px-2 py-1 text-neutral-600 hover:bg-black/5 aria-pressed:bg-blue-100 aria-pressed:text-blue-700"
        :aria-pressed="content === item"
        @click="$emit('update:content', content === item ? '' : item)"
      >
        {{ item }}
      </button>
    </div>
    <button v-if="protocol || content" class="shrink-0 text-blue-600" @click="$emit('reset')">
      清除筛选
    </button>
  </div>
</template>
