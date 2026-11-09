<script setup lang="ts">
import { SplitterResizeHandle } from "reka-ui";
defineProps<{ label: string }>();
</script>
<template>
  <SplitterResizeHandle :aria-label="label" class="resize-handle" />
</template>
