<script setup lang="ts">
import { computed } from "vue";
import type { CaptureDiagnostic } from "@local-traffic/protocol";
import { formatTime } from "./format";
const props = defineProps<{ diagnostics: CaptureDiagnostic[] }>();
const recent = computed(() => props.diagnostics.slice(-10).reverse());
const failure = computed(() =>
  [...props.diagnostics]
    .reverse()
    .find((item) => item.kind === "tls-client-failed" || item.kind === "tls-server-failed"),
);
const title = computed(() =>
  failure.value?.kind === "tls-client-failed"
    ? "连接已到达，但 HTTPS 证书被客户端拒绝"
    : failure.value?.kind === "tls-server-failed"
      ? "连接已到达，但服务端 TLS 握手失败"
      : props.diagnostics.some((item) => item.kind === "non-http")
        ? "连接已到达，但尚未解析出 HTTP 请求"
        : "已检测到连接，正在等待 HTTP 请求",
);
</script>

<template>
  <section class="capture-diagnostics" aria-label="抓取连接诊断">
    <h2>{{ title }}</h2>
    <p v-if="failure?.kind === 'tls-client-failed'">
      请先信任本地 CA，然后完全关闭并重新打开目标 App。CLI 可能使用独立证书库。Node / Electron
      应用可在抓取设置中生成包含代理和 CA 的启动命令；证书固定的 App 可能拒绝解密。
    </p>
    <p v-else-if="failure?.kind === 'tls-server-failed'">
      请检查上游代理、VPN 和服务端证书是否正常。
    </p>
    <p v-else>
      连接事件不等于已成功抓到 HTTP。微信等 App 可能包含私有协议；只会显示成功解析的 HTTP / HTTPS
      请求。
    </p>
    <div class="diagnostic-list">
      <div v-for="item in recent" :key="item.id" class="diagnostic-row">
        <time>{{ formatTime(item.timestamp) }}</time>
        <span class="diagnostic-kind">{{ item.kind }}</span>
        <span :title="item.host">
          {{ item.host || item.clientAddress || "Unknown peer" }}
        </span>
        <p>{{ item.message }}</p>
      </div>
    </div>
    <small>最近 {{ recent.length }} 条连接诊断</small>
  </section>
</template>
