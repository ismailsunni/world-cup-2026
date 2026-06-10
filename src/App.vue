<script setup lang="ts">
import { ref } from 'vue'
import { useData } from './composables/useData'
import { DEFAULT_METRIC, type Metric } from './metrics'
import GroupDotPlot from './components/GroupDotPlot.vue'
import MetricSwitcher from './components/MetricSwitcher.vue'

const { data, error, loading } = useData()
const metric = ref<Metric>(DEFAULT_METRIC)
</script>

<template>
  <main class="app">
    <header>
      <h1>World Cup 2026 — Groups</h1>
      <p class="sub">
        Each group is a line; each dot is a team, placed by the selected metric. Hover a
        dot for the value.
      </p>
    </header>

    <div class="controls">
      <MetricSwitcher v-model="metric" />
      <span v-if="metric.lowerIsBetter" class="hint">← better</span>
    </div>

    <p v-if="loading" class="status">Loading data…</p>
    <p v-else-if="error" class="status error">Failed to load data: {{ error }}</p>
    <GroupDotPlot v-else-if="data" :groups="data.groups" :metric="metric" />
  </main>
</template>

<style scoped>
.app {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  font-family: system-ui, sans-serif;
  color: #111827;
}
h1 {
  margin: 0 0 0.25rem;
  font-size: 1.6rem;
}
.sub {
  margin: 0 0 1.25rem;
  color: #6b7280;
}
.controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.hint {
  color: #9ca3af;
  font-size: 0.85rem;
}
.status {
  color: #6b7280;
}
.status.error {
  color: #b91c1c;
}
</style>
