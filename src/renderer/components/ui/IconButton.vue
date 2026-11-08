<script setup lang="ts">
defineProps<{ label: string; active?: boolean }>();
</script>
<template>
  <button
    :aria-label="label"
    :title="label"
    :data-active="active"
    class="icon-button inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 disabled:opacity-35"
  >
    <slot />
  </button>
</template>
