<script setup lang="ts">
import AppBadge from "./ui/AppBadge.vue";
defineProps<{ method: string }>();
</script>

<template>
  <AppBadge class="method-badge" :class="method.toLowerCase()">
    {{ method }}
  </AppBadge>
</template>

<style scoped>
.method-badge {
  display: inline-block;
  min-width: 35px;
  width: max-content;
  padding: 1px 5px;
  border: 1px solid #d6e3f8;
  border-radius: 4px;
  background: #edf4ff;
  color: #3676ce;
  font: 10px/15px var(--mono);
  text-align: center;
}
.post {
  background: #edf7ef;
  border-color: #d1e9d8;
  color: #3d9657;
}
.put,
.patch {
  background: #fff6e7;
  border-color: #f1dfba;
  color: #ad7a27;
}
.delete {
  background: #fff0ef;
  border-color: #efd2cf;
  color: #ba5b51;
}
.connect {
  background: #f3f3f4;
  border-color: #dddde0;
  color: #85858c;
}
.options {
  background: #edf9fa;
  border-color: #cdebef;
  color: #4a9fa9;
}
</style>
