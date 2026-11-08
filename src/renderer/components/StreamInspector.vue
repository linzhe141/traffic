<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, toRef, watch } from "vue";
import type { TrafficRecord } from "../../shared/contracts";
import { formatBytes, formatTime } from "../utils/format";
import { detectCodeLanguage } from "../utils/inspectTraffic";
import CodeHighlight from "./CodeHighlight.vue";
import ScrollLoad from "./ui/ScrollLoad.vue";
import { useBodyPages } from "../composables/useBodyPages";
import { createSseReader, type SseEvent } from "../utils/readSse";

const props = defineProps<{ record: TrafficRecord }>();
type StreamEntry = { label: string; detail: string; text: string; binary?: boolean };
const selection = shallowRef<StreamEntry>();
const following = ref(false);
const formatted = ref(true);
const list = ref<HTMLElement>();
const sse = shallowRef<SseEvent[]>([]);
const { pages, loading, error, load, hasMore } = useBodyPages(
  toRef(() => props.record.id),
  toRef(() => "response" as const),
  toRef(() => props.record.responseBody),
);
let reader = createSseReader();
watch([() => props.record.id, () => props.record.responseBody.stored?.generation], () => {
  reader = createSseReader();
  sse.value = [];
  selection.value = undefined;
  following.value = false;
});
watch(pages, (next, previous) => {
  if (!next.length) return;
  const additions = next.slice(previous.length).flatMap((page) => reader(page));
  if (additions.length) sse.value = [...sse.value, ...additions];
});
const entries = computed<StreamEntry[]>(() => {
  const socket = props.record.websocket;
  if (socket)
    return socket.messages.map((message) => ({
      label: message.direction === "sent" ? "客户端 → 服务端" : "服务端 → 客户端",
      detail: `#${message.sequence} · ${formatTime(message.timestamp)} · ${formatBytes(message.bytes)}`,
      text: message.text,
      binary: message.encoding === "base64",
    }));
  if (props.record.responseBody.stored) return sse.value;
  return createSseReader()(props.record.responseBody.text);
});
const active = computed(
  () => selection.value ?? (following.value ? entries.value.at(-1) : entries.value[0]),
);
async function scrollToLatest() {
  await nextTick();
  if (following.value && list.value) list.value.scrollTop = list.value.scrollHeight;
}
watch(entries, scrollToLatest);
function followLatest() {
  following.value = !following.value;
  selection.value = undefined;
  void scrollToLatest();
}
const language = computed(() =>
  active.value?.binary ? "text" : detectCodeLanguage(active.value?.text ?? ""),
);
const display = computed(() => {
  const text = active.value?.text ?? "";
  if (formatted.value && language.value === "json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
});
</script>

<template>
  <section class="stream-view" aria-label="流式消息">
    <header class="stream-toolbar">
      <strong>{{ record.websocket ? "WebSocket" : "SSE" }}</strong>
      <span class="stream-status">
        <i class="status-dot" :class="{ recording: record.state === 'pending' }"></i>
        {{ record.state === "pending" ? "接收中" : record.state === "failed" ? "失败" : "已结束" }}
      </span>
      <button :aria-pressed="following" @click="followLatest" ">跟随最新</button>
    </header>
    <p v-if="record.websocket" class="stream-note">
      {{ record.websocket.messageCount }} 条消息 · 最近 64 条，每条预览 1 KiB
      <template v-if="record.websocket.closeCode">
        · Close {{ record.websocket.closeCode }}</template
      >
    </p>
    <p v-if="!entries.length && !active" class="stream-note">
      等待完整消息。也可在 Body 页查看收到的原始片段。
    </p>
    <template v-if="entries.length || active || record.responseBody.stored">
      <div ref="list" class="stream-list" aria-label="消息列表">
        <button
          v-for="(entry, index) in entries"
          :key="index"
          class="stream-row"
          :aria-pressed="active === entry"
          @click="
            selection = entry;
            following = false;
          "
        >
          <span class="truncate">{{ entry.label }}</span><small>{{ entry.detail }}</small>
        </button>
        <button v-if="error && !record.websocket" class="text-blue-600" @click="load">
          {{ error }} · 重试
        </button>
        <ScrollLoad :enabled="!record.websocket && hasMore && !loading && !error" @load="load" />
      </div>
      <div v-if="active" class="stream-payload">
        <header class="stream-toolbar">
          <strong class="min-w-0 truncate">{{ active.label }}</strong>
          <span v-if="active.binary" class="muted">Base64</span>
          <button
            v-if="language === 'json'"
            :aria-pressed="formatted"
            @click="formatted = !formatted"
          >
            格式化 JSON
          </button>
        </header>
        <CodeHighlight :code="display" :language="language" label="消息内容" />
      </div>
    </template>
  </section>
</template>
