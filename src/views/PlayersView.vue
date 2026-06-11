<script setup lang="ts">
import { computed } from 'vue'
import { useData } from '../composables/useData'
import DataTable from '../components/DataTable.vue'
import { PLAYER_COLUMNS, buildPlayerRows } from '../tables'

const { data, error, loading } = useData()
const rows = computed(() => (data.value ? buildPlayerRows(data.value) : []))
</script>

<template>
  <div class="page">
    <h2>All players</h2>
    <p v-if="loading" class="status">Loading data…</p>
    <p v-else-if="error" class="status error">Failed to load data: {{ error }}</p>
    <DataTable v-else :columns="PLAYER_COLUMNS" :rows="rows" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 150px);
  min-height: 360px;
}
h2 {
  margin: 0 0 0.75rem;
  font-size: 1.4rem;
}
.status {
  color: #6b7280;
}
.status.error {
  color: #b91c1c;
}
</style>
