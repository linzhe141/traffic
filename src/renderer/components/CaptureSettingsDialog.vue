<script setup lang="ts">
import type { EngineInfo } from "../../shared/contracts";
import AppDialog from "./ui/AppDialog.vue";
import CaptureSetupPanel from "./CaptureSetupPanel.vue";
defineProps<{
  open: boolean;
  engine?: EngineInfo;
  upstreamProxy: string;
  target: string;
  mode: "local" | "system-proxy";
  busy: boolean;
  locked: boolean;
  hasBridge: boolean;
}>();
defineEmits<{
  "update:open": [value: boolean];
  "update:upstreamProxy": [value: string];
  "update:target": [value: string];
  "update:mode": [value: "local" | "system-proxy"];
  refresh: [];
  trust: [];
  reveal: [];
}>();
</script>
<template>
  <AppDialog
    :open="open"
    title="抓取设置"
    description="选择流量来源、上游代理和 HTTPS 证书信任。"
    @update:open="$emit('update:open', $event)"
  >
    <CaptureSetupPanel
      :engine="engine"
      :upstream-proxy="upstreamProxy"
      :target="target"
      :mode="mode"
      :busy="busy"
      :locked="locked"
      :has-bridge="hasBridge"
      @update:upstream-proxy="$emit('update:upstreamProxy', $event)"
      @update:target="$emit('update:target', $event)"
      @update:mode="$emit('update:mode', $event)"
      @refresh="$emit('refresh')"
      @trust="$emit('trust')"
      @reveal="$emit('reveal')"
    />
  </AppDialog>
</template>
