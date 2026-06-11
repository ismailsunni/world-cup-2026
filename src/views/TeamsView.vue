<script setup lang="ts">
import { computed } from 'vue'
import { useData } from '../composables/useData'
import DataTable from '../components/DataTable.vue'
import { COUNTRY_COLUMNS, buildCountryRows } from '../tables'

const { data, error, loading } = useData()
const rows = computed(() => (data.value ? buildCountryRows(data.value) : []))
</script>

<template>
  <div class="page">
    <router-link class="back" to="/">← Back to chart</router-link>
    <h2>All teams</h2>
    <p v-if="loading" class="status">Loading data…</p>
    <p v-else-if="error" class="status error">Failed to load data: {{ error }}</p>
    <DataTable v-else :columns="COUNTRY_COLUMNS" :rows="rows" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  /* fill the viewport below the global header so the table scrolls internally */
  height: calc(100vh - 150px);
  min-height: 360px;
}
.back {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
}
.back:hover {
  text-decoration: underline;
}
h2 {
  margin: 0.4rem 0 0.75rem;
  font-size: 1.4rem;
}
.status {
  color: #6b7280;
}
.status.error {
  color: #b91c1c;
}
</style>
