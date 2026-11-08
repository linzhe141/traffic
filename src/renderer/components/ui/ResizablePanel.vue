<script setup lang="ts">
import { SplitterPanel } from "reka-ui";
defineProps<{ defaultSize?: number; minSize?: number; maxSize?: number }>();
</script>
<template>
  <SplitterPanel
    :default-size="defaultSize"
    :min-size="minSize"
    :max-size="maxSize"
    class="min-h-0 min-w-0 overflow-hidden"
  >
    <slot />
  </SplitterPanel>
</template>
