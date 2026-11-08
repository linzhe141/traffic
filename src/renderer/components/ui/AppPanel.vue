<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";
defineProps<{ title: string }>();
</script>
<template>
  <section class="info-section">
    <h3>
      <ChevronDown :size="12" />
      {{ title }}
      <span><slot name="meta" /></span>
    </h3>
    <slot />
  </section>
</template>
