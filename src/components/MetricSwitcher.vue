<script setup lang="ts">
import { METRICS, type Metric } from '../metrics'

defineProps<{ modelValue: Metric }>()
const emit = defineEmits<{ 'update:modelValue': [Metric] }>()

function onChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  const m = METRICS.find((x) => x.id === id)
  if (m) emit('update:modelValue', m)
}
</script>

<template>
  <label class="switcher">
    <span>Metric</span>
    <select :value="modelValue.id" @change="onChange">
      <option v-for="m in METRICS" :key="m.id" :value="m.id">{{ m.label }}</option>
    </select>
  </label>
</template>

<style scoped>
.switcher {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: system-ui, sans-serif;
  font-size: 0.95rem;
}
.switcher span {
  color: #6b7280;
  font-weight: 600;
}
select {
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.95rem;
  background: #fff;
}
</style>
