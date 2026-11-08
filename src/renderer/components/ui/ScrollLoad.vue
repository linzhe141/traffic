<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{ enabled: boolean }>();
const emit = defineEmits<{ load: [] }>();
const sentinel = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;
watch(
  [sentinel, () => props.enabled],
  ([element, enabled]) => {
    observer?.disconnect();
    if (!element || !enabled) return;
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && props.enabled) emit("load");
      },
      { rootMargin: "0px 0px 100px" },
    );
    observer.observe(element);
  },
  { flush: "post" },
);
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <span ref="sentinel" style="display: block; height: 1px" aria-hidden="true"></span>
</template>
