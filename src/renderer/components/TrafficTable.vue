<script setup lang="ts">
import type { TrafficRecord } from "../../shared/contracts";
import { buildContentType, formatBytes, formatDuration, formatTime } from "../utils/format";
import MethodBadge from "./MethodBadge.vue";
import ProcessIcon from "./ProcessIcon.vue";
import { Lock, LockOpen, Radio, SlidersHorizontal } from "@lucide/vue";
defineProps<{
  records: TrafficRecord[];
  selectedId: string;
  capturing: boolean;
  hasRecords: boolean;
}>();
defineEmits<{ select: [id: string]; settings: [] }>();
function isSecure(record: TrafficRecord) {
  return /^(https|wss):\/\//i.test(record.url) || record.kind === "tunnel";
}
</script>

<template>
  <div class="traffic-table-scroll">
    <table class="traffic-table">
      <colgroup>
        <col style="width: 52px" />
        <col />
        <col style="width: 65px" />
        <col style="width: 72px" />
        <col style="width: 53px" />
        <col style="width: 100px" />
        <col style="width: 85px" />
        <col style="width: 74px" />
        <col style="width: 74px" />
        <col style="width: 48px" />
        <col style="width: 100px" />
        <col style="width: 116px" />
      </colgroup>
      <thead>
        <tr>
          <th>ID</th>
          <th>URL</th>
          <th>Method</th>
          <th>Status</th>
          <th>Code</th>
          <th>Time</th>
          <th class="numeric">Duration</th>
          <th class="numeric">Request</th>
          <th class="numeric">Response</th>
          <th>SSL</th>
          <th>Type</th>
          <th>来源应用</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="record in records"
          :key="record.id"
          :class="{ selected: selectedId === record.id }"
          tabindex="0"
          :aria-selected="selectedId === record.id"
          @click="$emit('select', record.id)"
          @keydown.enter="$emit('select', record.id)"
          @keydown.space.prevent="$emit('select', record.id)"
        >
          <td class="sequence">{{ record.sequence }}</td>
          <td class="path-cell" :title="record.url">{{ record.url }}</td>
          <td><MethodBadge :method="record.method" /></td>
          <td
            :class="{
              'status-failed': record.state === 'failed',
              'status-pending': record.state === 'pending',
            }"
          >
            {{
              record.state === "complete"
                ? "Completed"
                : record.state === "failed"
                  ? "Failed"
                  : record.websocket
                    ? "Open"
                    : "Pending"
            }}
          </td>
          <td>{{ record.statusCode ?? "—" }}</td>
          <td class="time-cell">{{ formatTime(record.startedAt) }}</td>
          <td class="numeric">{{ formatDuration(record.durationMs) }}</td>
          <td class="numeric">{{ formatBytes(record.requestBody.bytes) }}</td>
          <td class="numeric">{{ formatBytes(record.responseBody.bytes) }}</td>
          <td
            :title="
              isSecure(record)
                ? record.kind === 'tunnel'
                  ? '加密隧道'
                  : '已解密的 HTTP 消息'
                : '明文 HTTP'
            "
          >
            <component
              v-if="isSecure(record)"
              :is="record.kind === 'tunnel' ? Lock : LockOpen"
              :size="12"
            />
            <span v-else>—</span>
          </td>
          <td>{{ buildContentType(record) }}</td>
          <td :title="record.sourceApp?.executablePath || record.sourceApp?.name">
            <span class="flex min-w-0 items-center gap-2">
              <ProcessIcon :path="record.sourceApp?.executablePath" />
              <span class="truncate">{{ record.sourceApp?.name ?? "未知应用" }}</span>
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="!records.length" class="table-empty flex items-center justify-center gap-2">
      <Radio :size="14" class="text-neutral-400" />
      <span>
        {{
          hasRecords
            ? "No matching requests · 调整搜索或选择 All Traffic"
            : capturing
              ? "Listening · 在目标应用中发起新请求"
              : "No requests yet · 选择抓取目标后开始"
        }}
      </span>
      <button
        v-if="!hasRecords"
        class="inline-flex items-center gap-1 text-blue-500"
        @click="$emit('settings')"
      >
        <SlidersHorizontal :size="12" />
        抓取设置
      </button>
    </div>
  </div>
</template>
