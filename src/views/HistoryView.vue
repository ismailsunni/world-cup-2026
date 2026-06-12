<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHistory, type HistoryResult } from '../composables/useHistory'
import { useData } from '../composables/useData'
import { flagUrl } from '../flags'

const { data, error, loading } = useHistory()
const { data: wc } = useData()

// How far each result is + how it's shown.
const META: Record<HistoryResult, { label: string; full: string; weight: number }> = {
  W: { label: 'W', full: 'Champion', weight: 4 },
  RU: { label: 'RU', full: 'Runner-up', weight: 3 },
  SF: { label: 'SF', full: 'Semi-final', weight: 2 },
  QF: { label: 'QF', full: 'Quarter-final', weight: 1 },
}
const ORDER: HistoryResult[] = ['W', 'RU', 'SF', 'QF']

const onlyWC2026 = ref(false)
const wc2026 = computed(
  () => new Set((wc.value?.groups ?? []).flatMap((g) => g.teams.map((t) => t.team))),
)

const years = computed(() =>
  data.value ? [...new Set(data.value.map((r) => r.year))].sort((a, b) => a - b) : [],
)

interface Row {
  country: string
  byYear: Record<number, HistoryResult>
  weight: number
  apps: number
  titles: number
  best: HistoryResult
  inWC2026: boolean
}

const rows = computed<Row[]>(() => {
  if (!data.value) return []
  const map = new Map<string, Row>()
  for (const r of data.value) {
    let row = map.get(r.country)
    if (!row) {
      row = {
        country: r.country,
        byYear: {},
        weight: 0,
        apps: 0,
        titles: 0,
        best: 'QF',
        inWC2026: false,
      }
      map.set(r.country, row)
    }
    row.byYear[r.year] = r.result
    row.weight += META[r.result].weight
    row.apps += 1
    if (r.result === 'W') row.titles += 1
    if (META[r.result].weight > META[row.best].weight) row.best = r.result
  }
  const out = [...map.values()]
  for (const r of out) r.inWC2026 = wc2026.value.has(r.country)
  return out
    .filter((r) => !onlyWC2026.value || r.inWC2026)
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        b.titles - a.titles ||
        b.apps - a.apps ||
        a.country.localeCompare(b.country),
    )
})
</script>

<template>
  <div class="page">
    <h2>1/8 Final</h2>
    <p class="sub">
      How nations have fared deep in the World Cup knockout stage — every team to reach the
      <strong>quarter-final or further</strong>, from 1998 to 2022. Cells get darker the further
      a team went; gold marks the champions.
    </p>

    <div class="controls">
      <ul class="legend" aria-label="Result key">
        <li v-for="r in ORDER" :key="r">
          <span class="chip" :class="'res-' + r">{{ META[r].label }}</span>
          {{ META[r].full }}
        </li>
      </ul>
      <label class="toggle">
        <input type="checkbox" v-model="onlyWC2026" />
        Only 2026 teams
      </label>
    </div>

    <p v-if="loading" class="status">Loading data…</p>
    <p v-else-if="error" class="status error">Failed to load data: {{ error }}</p>
    <div v-else class="scroll">
      <table>
        <thead>
          <tr>
            <th class="cty">Country</th>
            <th v-for="y in years" :key="y" class="yr">{{ y }}</th>
            <th class="num">Apps</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.country" :class="{ wc: r.inWC2026 }">
            <td class="cty">
              <img v-if="flagUrl(r.country)" class="flag" :src="flagUrl(r.country)!" :alt="r.country" />
              <span class="name">{{ r.country }}</span>
              <span v-if="r.titles" class="stars" :title="`${r.titles} title${r.titles > 1 ? 's' : ''}`">
                {{ '★'.repeat(r.titles) }}
              </span>
            </td>
            <td v-for="y in years" :key="y" class="cell">
              <span
                v-if="r.byYear[y]"
                class="chip"
                :class="'res-' + r.byYear[y]"
                :title="`${y}: ${META[r.byYear[y]].full}`"
              >
                {{ META[r.byYear[y]].label }}
              </span>
            </td>
            <td class="num">{{ r.apps }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="years.length + 2" class="empty">No teams match.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
}
h2 {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
}
.sub {
  margin: 0 0 1rem;
  color: #6b7280;
  max-width: 70ch;
}
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin-bottom: 1rem;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.8rem;
  color: #374151;
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #374151;
  white-space: nowrap;
}
.scroll {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
table {
  border-collapse: collapse;
  font-size: 0.85rem;
  width: 100%;
}
thead th {
  position: sticky;
  top: 0;
  background: #f9fafb;
  text-align: center;
  padding: 0.5rem 0.4rem;
  border-bottom: 2px solid #e5e7eb;
  font-size: 0.72rem;
  color: #6b7280;
  font-weight: 700;
  white-space: nowrap;
}
th.cty {
  text-align: left;
}
td {
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid #f1f5f9;
}
td.cty {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  white-space: nowrap;
}
.flag {
  width: 24px;
  height: auto;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
  flex: none;
}
.name {
  font-weight: 600;
  color: #111827;
}
.stars {
  color: #f59e0b;
  font-size: 0.72rem;
}
td.cell {
  text-align: center;
  padding: 0.25rem;
}
td.num,
th.num {
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: #6b7280;
}
tbody tr.wc {
  background: #fffdf5;
}
tbody tr:hover {
  background: #f3f4f6;
}
.chip {
  display: inline-block;
  min-width: 1.9rem;
  text-align: center;
  padding: 0.12rem 0.3rem;
  border-radius: 5px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.res-W {
  background: #f59e0b;
  color: #fff;
}
.res-RU {
  background: #6366f1;
  color: #fff;
}
.res-SF {
  background: #a5b4fc;
  color: #1e1b4b;
}
.res-QF {
  background: #e0e7ff;
  color: #3730a3;
}
.status {
  color: #6b7280;
}
.status.error {
  color: #b91c1c;
}
.empty {
  text-align: center;
  color: #9ca3af;
  padding: 1.5rem;
}
</style>
