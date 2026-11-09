<script setup lang="ts">
import { SplitterGroup } from "reka-ui";
withDefaults(defineProps<{ direction?: "horizontal" | "vertical" }>(), {
  direction: "horizontal",
});
</script>
<template>
  <SplitterGroup :direction="direction" class="min-h-0 min-w-0 flex-1 overflow-hidden">
    <slot />
  </SplitterGroup>
</template>
