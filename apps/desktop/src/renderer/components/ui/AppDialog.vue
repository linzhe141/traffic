<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "reka-ui";
import { X } from "@lucide/vue";
import IconButton from "./IconButton.vue";
defineProps<{ open: boolean; title: string; description: string }>();
defineEmits<{ "update:open": [value: boolean] }>();
</script>
<template>
  <DialogRoot :open="open" @update:open="$emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" />
      <DialogContent
        class="settings-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(620px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden"
      >
        <div class="settings-dialog-header flex items-center justify-between px-5 py-3">
          <div>
            <DialogTitle class="text-[13px] font-semibold">
              {{ title }}
            </DialogTitle>
            <DialogDescription class="mt-0.5 text-[11px] text-neutral-500">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <IconButton label="关闭抓取设置"><X :size="16" /></IconButton>
          </DialogClose>
        </div>
        <div class="min-h-0 overflow-auto"><slot /></div>
        <div class="settings-dialog-footer flex justify-end px-5 py-2.5">
          <DialogClose as-child>
            <button class="app-button" data-variant="primary">完成</button>
          </DialogClose>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
