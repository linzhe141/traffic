<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";
import type { TrafficRecord } from "../../shared/contracts";
import { formatBytes, formatDuration, formatStatus, formatTime } from "../utils/format";
defineProps<{ record: TrafficRecord }>();
</script>
<template>
  <div class="mx-auto w-full max-w-4xl space-y-4 p-6">
    <section class="timing-panel pb-1">
      <div class="flex justify-between text-xs">
        <strong class="font-semibold">Timing</strong>
        <span class="text-neutral-400"> Started {{ formatTime(record.startedAt) }} </span>
      </div>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
        <div
          class="h-full w-full bg-blue-300"
          :class="record.state === 'pending' ? 'opacity-50' : 'border-r-[24px] border-blue-500'"
        ></div>
      </div>
      <div class="mt-2 flex justify-between text-[11px] text-neutral-400">
        <span>Total {{ formatDuration(record.durationMs) }}</span>
        <span>
          {{
            record.state === "pending"
              ? "In progress"
              : record.state === "failed"
                ? "Failed"
                : "Completed"
          }}
        </span>
      </div>
    </section>
    <section class="info-section">
      <h3>
        <ChevronDown :size="12" />
        General
        <span>
          {{ record.protocol }} · ↑ {{ formatBytes(record.requestBody.bytes) }} · ↓
          {{ formatBytes(record.responseBody.bytes) }}
        </span>
      </h3>
      <dl>
        <dt>Request URL</dt>
        <dd>{{ record.url }}</dd>
        <dt>Method</dt>
        <dd>{{ record.method }}</dd>
        <dt>Status</dt>
        <dd>{{ formatStatus(record) }}</dd>
        <dt>Protocol</dt>
        <dd>{{ record.protocol }}</dd>
      </dl>
    </section>
    <section class="info-section">
      <h3>
        <ChevronDown :size="12" />
        Connection
      </h3>
      <dl>
        <dt>来源应用</dt>
        <dd>{{ record.sourceApp?.name ?? "未知应用" }}</dd>
        <template v-if="record.sourceApp?.pid">
          <dt>PID</dt>
          <dd>{{ record.sourceApp.pid }}</dd>
        </template>
        <template v-if="record.sourceApp?.executablePath">
          <dt>可执行文件</dt>
          <dd>{{ record.sourceApp.executablePath }}</dd>
        </template>
        <dt>Client Address</dt>
        <dd>{{ record.clientAddress }}</dd>
        <dt>Target</dt>
        <dd>{{ record.host }}</dd>
        <dt>Type</dt>
        <dd>
          {{ record.kind === "tunnel" ? "Encrypted CONNECT tunnel" : "HTTP request" }}
        </dd>
        <dt>Started</dt>
        <dd>{{ new Date(record.startedAt).toLocaleString() }}</dd>
      </dl>
    </section>
    <p v-if="record.kind === 'tunnel'" class="text-[11px] leading-relaxed text-neutral-400">
      这条记录只包含加密隧道元数据，没有可查看的 HTTP 正文。
    </p>
  </div>
</template>
