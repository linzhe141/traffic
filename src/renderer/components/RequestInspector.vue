<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { FileSearch } from "@lucide/vue";
import type { TrafficRecord } from "../../shared/contracts";
import { buildContentType, formatDuration } from "../utils/format";
import { formatMessagePreview, queryEntries, requestCookies } from "../utils/inspectTraffic";
import MethodBadge from "./MethodBadge.vue";
import HeaderList from "./HeaderList.vue";
import BodyViewer from "./BodyViewer.vue";
import StreamInspector from "./StreamInspector.vue";
import RequestOverview from "./RequestOverview.vue";
import AppTabs from "./ui/AppTabs.vue";
import ResizableGroup from "./ui/ResizableGroup.vue";
import ResizablePanel from "./ui/ResizablePanel.vue";
import ResizeHandle from "./ui/ResizeHandle.vue";

const props = defineProps<{ record: TrafficRecord | null }>();
const requestTab = ref("Headers");
const responseTab = ref("Body");
const requestTabs = ["Headers", "Query", "Body", "Cookies", "Raw", "Summary"];
const responseTabs = computed(() => {
  const items = ["Headers", "Body", "Set-Cookie", "Raw"];
  if (props.record && ["SSE", "WebSocket"].includes(buildContentType(props.record)))
    items.push("Messages");
  return items;
});
watch(responseTabs, (items) => {
  if (!items.includes(responseTab.value)) responseTab.value = "Body";
});
const query = computed(() => queryEntries(props.record?.url ?? ""));
const cookies = computed(() => requestCookies(props.record?.requestHeaders ?? []));
const setCookies = computed(
  () =>
    props.record?.responseHeaders.filter((header) => header.name.toLowerCase() === "set-cookie") ??
    [],
);
const rawRequest = computed(() => {
  const record = props.record;
  return record
    ? formatMessagePreview(
        `${record.method} ${record.path} ${record.protocol}`,
        record.requestHeaders,
        { ...record.requestBody, text: "" },
      )
    : "";
});
const rawResponse = computed(() => {
  const record = props.record;
  return record
    ? formatMessagePreview(
        `${record.protocol} ${record.statusCode ?? ""}`,
        record.responseHeaders,
        { ...record.responseBody, text: "" },
      )
    : "";
});
</script>

<template>
  <section class="workspace-surface flex h-full min-h-0 flex-col">
    <template v-if="record">
      <div
        class="request-summary flex h-8 shrink-0 items-center gap-3 border-b border-black/10 px-3 text-[11px]"
      >
        <MethodBadge :method="record.method" />
        <span v-if="record.statusCode" class="font-semibold text-green-700">{{
          record.statusCode
        }}</span>
        <span class="min-w-0 flex-1 truncate" :title="record.url">{{ record.url }}</span>
        <span class="text-neutral-500"
          >{{ record.protocol }} · {{ formatDuration(record.durationMs) }}</span
        >
      </div>
      <p
        v-if="record.error"
        class="border-b border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-600"
      >
        {{ record.error }}
      </p>
      <ResizableGroup direction="horizontal">
        <ResizablePanel :default-size="50" :min-size="28">
          <section class="flex h-full min-w-0 flex-col" aria-label="Request">
            <div
              class="flex min-h-9 shrink-0 items-center gap-2 overflow-x-auto border-b border-black/5 px-3"
            >
              <strong class="text-[11px]">Request</strong>
              <AppTabs v-model="requestTab" :items="requestTabs" />
            </div>
            <div :key="`${record.id}:${requestTab}`" class="min-h-0 flex-1 overflow-auto p-3">
              <HeaderList
                v-if="requestTab === 'Headers'"
                title="Request headers"
                :headers="record.requestHeaders"
              />
              <HeaderList
                v-else-if="requestTab === 'Query'"
                title="Query parameters"
                :headers="query"
                empty="此请求没有 Query 参数。"
              />
              <HeaderList
                v-else-if="requestTab === 'Cookies'"
                title="Request cookies"
                :headers="cookies"
                empty="此请求没有 Cookie。"
              />
              <BodyViewer
                v-else-if="requestTab === 'Body'"
                title="Request body"
                :body="record.requestBody"
                :record-id="record.id"
                side="request"
                :content-type="
                  record.requestHeaders.find(
                    (header) => header.name.toLowerCase() === 'content-type',
                  )?.value
                "
              />
              <RequestOverview v-else-if="requestTab === 'Summary'" :record="record" />
              <BodyViewer
                v-else
                title="Request Raw · 重建视图"
                :prefix="rawRequest"
                :body="record.requestBody"
                :record-id="record.id"
                side="request"
              />
            </div>
          </section>
        </ResizablePanel>
        <ResizeHandle label="调整请求和响应宽度" />
        <ResizablePanel :default-size="50" :min-size="28">
          <section class="flex h-full min-w-0 flex-col" aria-label="Response">
            <div
              class="flex min-h-9 shrink-0 items-center gap-2 overflow-x-auto border-b border-black/5 px-3"
            >
              <strong class="text-[11px]">Response</strong>
              <AppTabs v-model="responseTab" :items="responseTabs" />
            </div>
            <div :key="`${record.id}:${responseTab}`" class="min-h-0 flex-1 overflow-auto p-3">
              <HeaderList
                v-if="responseTab === 'Headers'"
                title="Response headers"
                :headers="record.responseHeaders"
              />
              <HeaderList
                v-else-if="responseTab === 'Set-Cookie'"
                title="Set-Cookie"
                :headers="setCookies"
                empty="此响应没有 Set-Cookie。"
              />
              <StreamInspector v-else-if="responseTab === 'Messages'" :record="record" />
              <BodyViewer
                v-else-if="responseTab === 'Raw'"
                title="Response Raw · 重建视图"
                :prefix="rawResponse"
                :body="record.responseBody"
                :record-id="record.id"
                side="response"
              />
              <BodyViewer
                v-else
                :title="buildContentType(record) === 'SSE' ? 'SSE · 响应内容' : 'Response body'"
                :body="record.responseBody"
                :record-id="record.id"
                side="response"
                :content-type="
                  record.responseHeaders.find(
                    (header) => header.name.toLowerCase() === 'content-type',
                  )?.value
                "
              />
            </div>
          </section>
        </ResizablePanel>
      </ResizableGroup>
    </template>
    <div v-else class="flex flex-1 flex-col items-center justify-center gap-2 text-neutral-400">
      <FileSearch :size="25" :stroke-width="1" />
      <span class="text-xs">选择一条请求查看详情</span>
    </div>
  </section>
</template>
