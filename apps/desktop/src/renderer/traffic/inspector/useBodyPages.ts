import { computed, ref, shallowRef, watch, type Ref } from "vue";
import type { BodySide, CapturedBody } from "@local-traffic/protocol";

export function useBodyPages(
  id: Readonly<Ref<string>>,
  side: Readonly<Ref<BodySide>>,
  body: Readonly<Ref<CapturedBody>>,
) {
  const offset = ref(0);
  const pages = shallowRef<string[]>([]);
  const loading = ref(false);
  const error = ref("");
  let decoder = new TextDecoder();
  let revision = 0;
  const available = computed(() => body.value.stored?.available ?? 0);
  const binary = computed(() => body.value.stored?.binary ?? false);
  const hasMore = computed(() => offset.value < available.value);
  watch(
    [id, side, () => body.value.stored?.generation ?? 0],
    () => {
      revision++;
      decoder = new TextDecoder();
      offset.value = 0;
      pages.value = [];
      error.value = "";
      loading.value = false;
    },
    { flush: "sync" },
  );

  async function load() {
    if (loading.value || !hasMore.value) return;
    const current = revision;
    loading.value = true;
    error.value = "";
    try {
      const api = window.trafficApi;
      if (!api) throw new Error("正文读取接口不可用。");
      const page = await api.readBody({ id: id.value, side: side.value, offset: offset.value });
      if (current !== revision) return;
      if (!page) throw new Error("这条记录的正文已释放。");
      if (page.generation !== body.value.stored?.generation) {
        throw new Error("正文表示已更新，请重试读取。");
      }
      if (!page.data.length) return;
      const text = page.binary
        ? Array.from(page.data, (byte) => byte.toString(16).padStart(2, "0"))
            .join(" ")
            .replace(/(?:[a-f0-9]{2} ){16}/g, (row) => row.trimEnd() + "\n")
        : decoder.decode(page.data, { stream: true });
      pages.value = [...pages.value, text];
      offset.value = page.nextOffset;
    } catch (cause) {
      if (current === revision)
        error.value = cause instanceof Error ? cause.message : "正文读取失败。";
    } finally {
      if (current === revision) loading.value = false;
    }
  }
  return { pages, loading, error, load, hasMore, available, binary, offset };
}
