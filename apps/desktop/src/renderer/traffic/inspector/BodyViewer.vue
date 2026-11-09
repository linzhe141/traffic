<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import type { BodySide, CapturedBody } from "@local-traffic/protocol";
import { formatBody, formatBytes } from "../format";
import { detectCodeLanguage } from "./inspectTraffic";
import { createHtmlPreview, readCompleteBody } from "./readCompleteBody";
import CodeHighlight from "./CodeHighlight.vue";
import ScrollLoad from "../../components/ui/ScrollLoad.vue";
import { useBodyPages } from "./useBodyPages";

const props = defineProps<{
  body: CapturedBody;
  title: string;
  contentType?: string;
  recordId: string;
  side: BodySide;
  prefix?: string;
}>();
const { pages, loading, error, load, hasMore, available, binary, offset } = useBodyPages(
  toRef(props, "recordId"),
  toRef(props, "side"),
  toRef(props, "body"),
);
const htmlDocument = ref("");
const htmlError = ref("");
const preparingHtml = ref(false);
let previewVersion = 0;
watch([() => props.recordId, () => props.side, () => props.body.stored?.generation ?? 0], () => {
  previewVersion++;
  htmlDocument.value = "";
  htmlError.value = "";
  preparingHtml.value = false;
});

const text = computed(() =>
  props.body.stored ? pages.value.join(binary.value ? "\n" : "") : props.body.text,
);
const language = computed(() =>
  props.prefix
    ? "http"
    : binary.value || (!props.body.stored && props.body.encoding === "base64")
      ? "text"
      : detectCodeLanguage(text.value, props.contentType),
);
const canPreviewHtml = computed(
  () =>
    !props.prefix &&
    !binary.value &&
    (language.value === "html" || /^\s*(?:<!doctype html\b|<html\b)/i.test(text.value)),
);
const display = computed(() => {
  if (props.prefix) return props.prefix + text.value;
  if (language.value === "json" && !hasMore.value && pages.value.length <= 1 && text.value) {
    return formatBody({ ...props.body, text: text.value, encoding: "utf8" });
  }
  return text.value;
});
const hasBody = computed(() =>
  props.body.stored ? available.value > 0 : Boolean(props.body.text),
);

async function readText() {
  const api = window.trafficApi;
  if (!props.body.stored) return props.body.text;
  if (!api) throw new Error("正文读取接口不可用。");
  return readCompleteBody(api, { id: props.recordId, side: props.side });
}

async function copySource() {
  return (props.prefix ?? "") + (await readText());
}

async function toggleHtml() {
  if (htmlDocument.value) {
    htmlDocument.value = "";
    return;
  }
  const version = previewVersion;
  preparingHtml.value = true;
  htmlError.value = "";
  try {
    const html = await readText();
    if (version === previewVersion) htmlDocument.value = createHtmlPreview(html);
  } catch (cause) {
    if (version === previewVersion)
      htmlError.value = cause instanceof Error ? cause.message : "预览读取失败。";
  } finally {
    if (version === previewVersion) preparingHtml.value = false;
  }
}
</script>

<template>
  <section class="body-viewer">
    <CodeHighlight
      :code="htmlDocument ? '' : display"
      :language="language"
      :label="title"
      paged
      :copy-source="copySource"
      :can-copy="hasBody || !!prefix"
    >
      <template #heading>
        <div class="body-heading code-heading">
          <strong>{{ title }}</strong>
          <span
            >{{ formatBytes(body.bytes) }} ·
            {{
              body.stored
                ? binary
                  ? "Hex"
                  : "UTF-8"
                : body.encoding === "base64"
                  ? "Base64"
                  : "UTF-8"
            }}
          </span>
        </div>
      </template>
      <template #tools>
        <button
          v-if="canPreviewHtml"
          type="button"
          :aria-pressed="!!htmlDocument"
          :disabled="!hasBody || preparingHtml"
          @click="toggleHtml"
        >
          {{ preparingHtml ? "正在读取…" : htmlDocument ? "查看源码" : "HTML 预览" }}
        </button>
      </template>
      <template v-if="htmlDocument" #content>
        <iframe class="html-preview" sandbox="" :srcdoc="htmlDocument" title="HTML 预览" />
      </template>
      <p v-if="htmlError" class="muted section-empty">{{ htmlError }}</p>
      <template v-if="!htmlDocument && body.stored">
        <p class="muted section-empty">
          {{
            loading
              ? "读取正文中…"
              : available
                ? "已读取 " + formatBytes(offset) + " / " + formatBytes(available)
                : "等待正文"
          }}
        </p>
        <button v-if="error" class="text-blue-600" @click="load">{{ error }} · 重试</button>
        <ScrollLoad :enabled="hasMore && !loading && !error" @load="load" />
      </template>
      <p v-else-if="!hasBody && !prefix" class="muted section-empty">暂无正文</p>
    </CodeHighlight>
  </section>
</template>
