<script setup lang="ts">
import { onUnmounted, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, ArrowRight } from "@lucide/vue";
import IconButton from "./ui/IconButton.vue";

const router = useRouter();
const history = router.options.history;
const state = shallowRef(history.state);
onUnmounted(
  router.afterEach(() => {
    state.value = history.state;
  }),
);
</script>

<template>
  <nav class="history-navigation no-drag flex shrink-0 items-center" aria-label="导航历史">
    <IconButton label="后退" :disabled="!state.back" @click="router.back()">
      <ArrowLeft :size="16" />
    </IconButton>
    <IconButton label="前进" :disabled="!state.forward" @click="router.forward()">
      <ArrowRight :size="16" />
    </IconButton>
  </nav>
</template>
