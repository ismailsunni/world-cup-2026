<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHistory, type HistoryResult } from '../composables/useHistory'
import { useData } from '../composables/useData'
import { flagUrl } from '../flags'

const { data, error, loading } = useHistory()
const { data: wc } = useData()

// Points per finishing depth (and how each result is shown).
const META: Record<HistoryResult, { label: string; full: string; points: number }> = {
  W: { label: 'W', full: 'Champion', points: 8 },
  RU: { label: 'RU', full: 'Runner-up', points: 4 },
  SF: { label: 'SF', full: 'Semi-final', points: 2 },
  QF: { label: 'QF', full: 'Quarter-final', points: 1 },
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
  points: number
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
        points: 0,
        apps: 0,
        titles: 0,
        best: 'QF',
        inWC2026: false,
      }
      map.set(r.country, row)
    }
    row.byYear[r.year] = r.result
    row.points += META[r.result].points
    row.apps += 1
    if (r.result === 'W') row.titles += 1
    if (META[r.result].points > META[row.best].points) row.best = r.result
  }
  const out = [...map.values()]
  for (const r of out) r.inWC2026 = wc2026.value.has(r.country)
  return out
})

// --- sorting -----------------------------------------------------------------
const sortKey = ref<string>('points') // 'country' | 'points' | 'apps' | '<year>'
const sortDir = ref<'asc' | 'desc'>('desc')

function sortVal(r: Row, key: string): number | string {
  if (key === 'country') return r.country
  if (key === 'points') return r.points
  if (key === 'apps') return r.apps
  const res = r.byYear[Number(key)] // year column: rank by depth, missing last
  return res ? META[res].points : -1
}
function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = key === 'country' ? 'asc' : 'desc'
  }
}
function sortRows(list: Row[]): Row[] {
  const dir = sortDir.value === 'asc' ? 1 : -1
  const key = sortKey.value
  return [...list].sort((a, b) => {
    const av = sortVal(a, key)
    const bv = sortVal(b, key)
    const cmp =
      typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return cmp * dir || a.country.localeCompare(b.country)
  })
}
const arrow = (key: string) => (sortKey.value === key ? (sortDir.value === 'asc' ? '▲' : '▼') : '')

// One table when unfiltered; when the 2026 filter is on, split into a 2026
// table and a second table for the other historical quarter-finalists.
const sections = computed(() =>
  onlyWC2026.value
    ? [
        { title: 'In the 2026 World Cup', rows: sortRows(rows.value.filter((r) => r.inWC2026)) },
        {
          title: 'Other historical quarter-finalists',
          rows: sortRows(rows.value.filter((r) => !r.inWC2026)),
        },
      ]
    : [{ title: '', rows: sortRows(rows.value) }],
)
</script>

<template>
  <div class="page">
    <h2>Historical QF</h2>
    <p class="sub">
      How nations have fared deep in the World Cup knockout stage — every team to reach the
      <strong>quarter-final or further</strong>, from 1998 to 2022. Cells darken with depth; gold
      marks the champions. <strong>Points</strong>: W = 8, RU = 4, SF = 2, QF = 1. Click a column
      header to sort.
    </p>

    <div class="controls">
      <ul class="legend" aria-label="Result key">
        <li v-for="r in ORDER" :key="r">
          <span class="chip" :class="'res-' + r">{{ META[r].label }}</span>
          {{ META[r].full }} ({{ META[r].points }})
        </li>
      </ul>
      <label class="toggle">
        <input type="checkbox" v-model="onlyWC2026" />
        Only 2026 teams
      </label>
    </div>

    <p v-if="loading" class="status">Loading data…</p>
    <p v-else-if="error" class="status error">Failed to load data: {{ error }}</p>
    <template v-else>
      <section v-for="(sec, si) in sections" :key="si" class="tablewrap">
        <h3 v-if="sec.title" class="tabletitle">
          {{ sec.title }} <span class="cnt">{{ sec.rows.length }}</span>
        </h3>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="rank">#</th>
                <th class="cty sortable" :class="{ sorted: sortKey === 'country' }" @click="toggleSort('country')">
                  Country <span class="arr">{{ arrow('country') }}</span>
                </th>
                <th
                  v-for="y in years"
                  :key="y"
                  class="yr sortable"
                  :class="{ sorted: sortKey === String(y) }"
                  @click="toggleSort(String(y))"
                >
                  {{ y }} <span class="arr">{{ arrow(String(y)) }}</span>
                </th>
                <th class="num sortable" :class="{ sorted: sortKey === 'points' }" @click="toggleSort('points')">
                  Pts <span class="arr">{{ arrow('points') }}</span>
                </th>
                <th
                  class="num sortable"
                  :class="{ sorted: sortKey === 'apps' }"
                  title="Tournaments reaching the quarter-final or further"
                  @click="toggleSort('apps')"
                >
                  QF+ runs <span class="arr">{{ arrow('apps') }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in sec.rows" :key="r.country" :class="{ wc: r.inWC2026 }">
                <td class="rank">{{ i + 1 }}</td>
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
                <td class="num pts">{{ r.points }}</td>
                <td class="num">{{ r.apps }}</td>
              </tr>
              <tr v-if="!sec.rows.length">
                <td :colspan="years.length + 4" class="empty">No teams.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
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
  max-width: 72ch;
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
.tablewrap + .tablewrap {
  margin-top: 1.5rem;
}
.tabletitle {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: #374151;
}
.tabletitle .cnt {
  font-size: 0.78rem;
  font-weight: 600;
  color: #9ca3af;
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
.rank {
  text-align: right;
  width: 2rem;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
th.sortable {
  cursor: pointer;
  user-select: none;
}
th.sortable:hover {
  color: #111827;
}
th.sorted {
  color: #2563eb;
}
.arr {
  font-size: 0.6rem;
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
td.pts {
  font-weight: 700;
  color: #111827;
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
