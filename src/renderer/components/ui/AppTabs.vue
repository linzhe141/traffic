<script setup lang="ts">
import { TabsRoot, TabsList, TabsTrigger } from "reka-ui";
defineProps<{ modelValue: string; items: string[] }>();
defineEmits<{ "update:modelValue": [value: string] }>();
</script>
<template>
  <TabsRoot
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', String($event))"
  >
    <TabsList class="flex items-center gap-0.5 rounded-md bg-black/5 p-0.5" aria-label="请求详情">
      <TabsTrigger
        v-for="item in items"
        :key="item"
        :value="item"
        class="native-tab rounded px-3 py-0.5 text-[11px] text-neutral-500 data-[state=active]:bg-white data-[state=active]:text-neutral-800 data-[state=active]:shadow-sm"
      >
        {{ item }}
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
