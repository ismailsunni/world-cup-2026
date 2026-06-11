<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Column } from '../tables'

const props = defineProps<{
  columns: Column[]
  rows: Record<string, unknown>[]
  initialFilters?: Record<string, string>
  hideControls?: boolean // for small inline tables (search/filters not needed)
}>()

const search = ref('')
const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')
const filters = ref<Record<string, string>>({ ...(props.initialFilters ?? {}) })

const filterCols = computed(() => props.columns.filter((c) => c.filter))

function distinct(key: string): string[] {
  const s = new Set<string>()
  for (const r of props.rows) {
    const v = r[key]
    if (v != null && v !== '') s.add(String(v))
  }
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const view = computed(() => {
  let out = props.rows

  for (const [k, v] of Object.entries(filters.value)) {
    if (v) out = out.filter((r) => String(r[k]) === v)
  }

  const q = search.value.trim().toLowerCase()
  if (q) {
    out = out.filter((r) =>
      props.columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)),
    )
  }

  if (sortKey.value) {
    const col = props.columns.find((c) => c.key === sortKey.value)
    const num = !!(col?.numeric || col?.bool)
    const dir = sortDir.value === 'asc' ? 1 : -1
    const key = sortKey.value
    out = [...out].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (num) return (Number(av) - Number(bv)) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }
  return out
})

const hasFilters = computed(
  () => search.value !== '' || Object.values(filters.value).some(Boolean) || sortKey.value,
)

function reset() {
  search.value = ''
  filters.value = {}
  sortKey.value = null
  sortDir.value = 'asc'
}

function cell(c: Column, v: unknown): string {
  if (c.bool) return v ? '✓' : '—'
  if (v == null || v === '') return '—'
  return String(v)
}
</script>

<template>
  <div class="dt">
    <div v-if="!hideControls" class="dt-controls">
      <input
        v-model="search"
        class="dt-search"
        type="search"
        placeholder="Search…"
        aria-label="Search table"
      />
      <label v-for="c in filterCols" :key="c.key" class="dt-filter">
        <span>{{ c.label }}</span>
        <select v-model="filters[c.key]">
          <option value="">All</option>
          <option v-for="opt in distinct(c.key)" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </label>
      <button v-if="hasFilters" class="dt-reset" @click="reset">Reset</button>
      <span class="dt-count">{{ view.length }} / {{ rows.length }}</span>
    </div>

    <div class="dt-scroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              :class="{ num: c.numeric, sorted: sortKey === c.key }"
              @click="toggleSort(c.key)"
            >
              {{ c.label }}
              <span class="arrow">{{
                sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : ''
              }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in view" :key="i">
            <td v-for="c in columns" :key="c.key" :class="{ num: c.numeric, bool: c.bool }">
              {{ cell(c, r[c.key]) }}
            </td>
          </tr>
          <tr v-if="!view.length">
            <td :colspan="columns.length" class="empty">No rows match.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.dt {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.dt-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem 0.75rem;
  padding: 0 0 0.75rem;
}
.dt-search {
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  min-width: 200px;
}
.dt-filter {
  display: inline-flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.7rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.dt-filter select {
  padding: 0.3rem 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
}
.dt-reset {
  padding: 0.4rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.dt-reset:hover {
  background: #f3f4f6;
}
.dt-count {
  margin-left: auto;
  font-size: 0.8rem;
  color: #9ca3af;
  white-space: nowrap;
}
.dt-scroll {
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  flex: 1;
  min-height: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
thead th {
  position: sticky;
  top: 0;
  background: #f9fafb;
  z-index: 1;
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 2px solid #e5e7eb;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
thead th:hover {
  color: #111827;
}
thead th.sorted {
  color: #2563eb;
}
.arrow {
  font-size: 0.65rem;
}
td {
  padding: 0.38rem 0.6rem;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap;
}
td.num,
th.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
td.bool {
  text-align: center;
  color: #16a34a;
}
tbody tr:hover {
  background: #f9fafb;
}
.empty {
  text-align: center;
  color: #9ca3af;
  padding: 1.5rem;
}
</style>
