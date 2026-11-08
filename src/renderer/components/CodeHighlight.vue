<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import type { CodeLanguage, tokenizeCode } from "../utils/highlightCode";

const props = withDefaults(
  defineProps<{
    code: string;
    language?: CodeLanguage;
    label?: string;
    paged?: boolean;
    copySource?: () => Promise<string>;
    canCopy?: boolean;
  }>(),
  {
    language: "text",
    label: "代码预览",
    canCopy: true,
  },
);
const wrap = ref(true);
const copyStatus = ref("");
const copying = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
let mounted = true;
onBeforeUnmount(() => {
  mounted = false;
  clearTimeout(copyTimer);
});
async function copy() {
  if (copying.value) return;
  const api = window.trafficApi;
  if (!api) return;
  clearTimeout(copyTimer);
  copying.value = true;
  try {
    await api.copyText(props.copySource ? await props.copySource() : props.code);
    copyStatus.value = "已复制";
  } catch {
    copyStatus.value = "复制失败";
  } finally {
    copying.value = false;
    if (mounted)
      copyTimer = setTimeout(() => {
        copyStatus.value = "";
      }, 2000);
  }
}
const plainLines = computed(() => props.code.split(/\r\n|\r|\n/));
const highlightInput = computed(() =>
  props.language === "text"
    ? ""
    : props.code
        .slice(0, 96 * 1024)
        .split(/\r\n|\r|\n/, 1800)
        .join("\n"),
);
const highlightLines = computed(() => highlightInput.value.split("\n"));
const tokenized = shallowRef<{
  code: string;
  language: CodeLanguage;
  lines: Awaited<ReturnType<typeof tokenizeCode>>;
}>();
const lines = computed(() =>
  tokenized.value?.code === highlightInput.value && tokenized.value.language === props.language
    ? tokenized.value.lines
    : undefined,
);

watch(
  [highlightInput, () => props.language],
  ([code, language], _, cleanup) => {
    if (!code || language === "text") return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const { tokenizeCode } = await import("../utils/highlightCode");
        if (current) {
          const tokens = await tokenizeCode(code, language);
          if (current) tokenized.value = { code, language, lines: tokens };
        }
      } catch {
        // Unsupported payloads remain readable as plain text.
      }
    }, 70);
    cleanup(() => {
      current = false;
      clearTimeout(timer);
    });
  },
  { immediate: true },
);
</script>

<template>
  <section class="code-view" :class="{ 'code-paged': paged }" :aria-label="label">
    <div class="code-header">
      <slot name="heading" />
      <div class="code-tools">
        <span>{{ language.toUpperCase() }}</span>
        <div class="code-actions">
          <slot name="tools" />
          <button type="button" :aria-pressed="wrap" @click="wrap = !wrap">自动换行</button>
          <button type="button" :disabled="copying || !canCopy" aria-label="复制内容" @click="copy">
            {{ copying ? "复制中…" : copyStatus || "Copy" }}
          </button>
        </div>
      </div>
    </div>
    <slot name="content">
      <pre
        :class="{ 'code-wrap': wrap }"
      ><code><span v-for="(line, index) in plainLines" :key="index" class="code-line"><span class="code-gutter" aria-hidden="true">{{ index + 1 }}</span><span class="code-content"><template v-if="lines?.[index]"><span v-for="(token, key) in lines[index]" :key="key" :style="{ '--token-light': token.htmlStyle?.color, '--token-dark': token.htmlStyle?.['--shiki-dark'] }">{{ token.content }}</span>{{ line.slice(highlightLines[index]?.length ?? 0) }}</template><template v-else>{{ line }}</template></span></span></code></pre>
    </slot>
    <slot />
  </section>
</template>
