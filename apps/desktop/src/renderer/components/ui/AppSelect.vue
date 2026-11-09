<script setup lang="ts" generic="T extends string">
import { Check, ChevronDown } from "@lucide/vue";
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";

defineProps<{
  modelValue: T;
  options: readonly { value: T; label: string }[];
  label: string;
  disabled?: boolean;
  describedBy?: string;
}>();
defineEmits<{ "update:modelValue": [value: T] }>();
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="(value) => value && $emit('update:modelValue', value as T)"
  >
    <SelectTrigger class="app-select" :aria-label="label" :aria-describedby="describedBy">
      <SelectValue class="truncate" />
      <ChevronDown :size="13" class="shrink-0" aria-hidden="true" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="app-select-menu" position="popper" align="start" :side-offset="5">
        <SelectViewport>
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            class="app-select-option"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator><Check :size="13" /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
