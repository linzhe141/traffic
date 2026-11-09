<script setup lang="ts">
defineProps<{ tone?: "neutral" | "warning" | "blue" }>();
</script>
<template>
  <span
    class="app-badge inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
    :data-tone="tone || 'neutral'"
  >
    <slot />
  </span>
</template>
