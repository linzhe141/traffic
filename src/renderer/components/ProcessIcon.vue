<script lang="ts">
import type { ProcessIconVariants } from "../../shared/contracts";

const icons = new Map<string, Promise<ProcessIconVariants | null>>();

function getIcon(path: string) {
  const key = path.toLowerCase();
  const cached = icons.get(key);
  if (cached) return cached;
  const request = window.trafficApi?.getProcessIcon?.(path).catch(() => null);
  if (!request) return Promise.resolve(null);
  if (icons.size >= 256) icons.delete(icons.keys().next().value!);
  icons.set(key, request);
  return request;
}
</script>

<script setup lang="ts">
import { AppWindow } from "@lucide/vue";
import { shallowRef, watch } from "vue";

const props = defineProps<{ path?: string }>();
const icon = shallowRef<ProcessIconVariants | null>(null);
watch(
  () => props.path,
  async (path, _, cleanup) => {
    icon.value = null;
    if (!path) return;
    let current = true;
    cleanup(() => {
      current = false;
    });
    const url = await getIcon(path);
    if (current) icon.value = url;
  },
  { immediate: true },
);
</script>

<template>
  <span v-if="icon" class="process-icon size-4 shrink-0" aria-hidden="true">
    <img
      :src="icon.light"
      alt=""
      class="process-icon-light size-full object-contain"
      draggable="false"
    />
    <img
      v-if="icon.dark !== icon.light"
      :src="icon.dark"
      alt=""
      class="process-icon-dark size-full object-contain"
      draggable="false"
    />
  </span>
  <AppWindow v-else :size="16" class="shrink-0 text-blue-500" aria-hidden="true" />
</template>

<style>
.process-icon-dark {
  display: none;
}
[data-theme="dark"] .process-icon:has(.process-icon-dark) > .process-icon-light {
  display: none;
}
[data-theme="dark"] .process-icon-dark {
  display: block;
}
</style>
