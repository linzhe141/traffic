<script setup lang="ts">
import type { HeaderEntry } from "../../shared/contracts";
import AppPanel from "./ui/AppPanel.vue";
defineProps<{ title: string; headers: HeaderEntry[]; empty?: string }>();
</script>

<template>
  <AppPanel :title="title">
    <template #meta>{{ headers.length }}</template>
    <dl v-if="headers.length" class="header-list">
      <template v-for="(header, index) in headers" :key="index">
        <dt>{{ header.name }}</dt>
        <dd>{{ header.value }}</dd>
      </template>
    </dl>
    <p v-else class="muted section-empty">{{ empty || "No headers captured" }}</p>
  </AppPanel>
</template>
