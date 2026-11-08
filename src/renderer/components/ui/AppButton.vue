<script setup lang="ts">
withDefaults(defineProps<{ variant?: "default" | "primary" | "ghost" }>(), {
  variant: "default",
});
</script>
<template>
  <button
    type="button"
    class="app-button inline-flex items-center justify-center gap-1.5 disabled:pointer-events-none disabled:opacity-40"
    :data-variant="variant"
  >
    <slot />
  </button>
</template>
