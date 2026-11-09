<script setup lang="ts">
defineProps<{ modelValue?: string }>();
defineEmits<{ "update:modelValue": [value: string] }>();
</script>
<template>
  <input
    class="app-input min-w-0"
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
