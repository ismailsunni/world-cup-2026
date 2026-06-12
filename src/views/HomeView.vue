<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from '../composables/useData'
import { DEFAULT_METRIC, type Metric } from '../metrics'
import type { Group, Team } from '../types'
import GroupDotPlot from '../components/GroupDotPlot.vue'
import MetricSwitcher from '../components/MetricSwitcher.vue'
import SquadPanel from '../components/SquadPanel.vue'
import DataTable from '../components/DataTable.vue'
import { CONFEDERATION_COLOR } from '../flags'
import { COUNTRY_COLUMNS, buildCountryRows } from '../tables'
import { computeGroupInsights } from '../insights'

const { data, error, loading } = useData()
const metric = ref<Metric>(DEFAULT_METRIC)
const confederations = Object.entries(CONFEDERATION_COLOR)

// Group-shape findings for the active metric.
const insights = computed(() =>
  data.value ? computeGroupInsights(data.value.groups, metric.value) : null,
)

// Plain number formatter for gaps/spread (metric.format would mis-format a
// delta, e.g. render a ranking gap as "#20").
const num = (n: number) => {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
const val = (n: number) => (metric.value.format ? metric.value.format(n) : num(n))

const selected = ref<Team | null>(null)
const groupName = ref<string | null>(null)

const selectedGroup = computed<Group | null>(() => {
  if (!selected.value || !data.value) return null
  return (
    data.value.groups.find((g) => g.teams.some((t) => t.team === selected.value!.team)) ?? null
  )
})

const groupRows = computed(() => {
  if (!groupName.value || !data.value) return []
  return buildCountryRows(data.value).filter((r) => r.group === groupName.value)
})

function onSelectTeam(t: Team) {
  selected.value = t
  groupName.value = null
}
function onSelectGroup(g: string) {
  groupName.value = g
  selected.value = null
}
</script>

<template>
  <p class="sub">
    Each group is a line; each flag is a team, placed by the selected metric. The dashed
    tick marks the group average — the right-hand column flags the highest (▲ max) and
    lowest (▼ min). Click a team for its squad, or a group row for its teams.
  </p>

  <div class="controls">
    <MetricSwitcher v-model="metric" />
    <span v-if="metric.lowerIsBetter" class="hint">← better</span>
    <span class="spacer" />
    <router-link class="tbtn" to="/teams">All teams</router-link>
    <router-link class="tbtn" to="/players">All players</router-link>
  </div>

  <ul class="legend" aria-label="Confederation colors">
    <li v-for="[conf, color] in confederations" :key="conf">
      <span class="swatch" :style="{ background: color }" />{{ conf }}
    </li>
  </ul>

  <p v-if="loading" class="status">Loading data…</p>
  <p v-else-if="error" class="status error">Failed to load data: {{ error }}</p>
  <GroupDotPlot
    v-else-if="data"
    :groups="data.groups"
    :metric="metric"
    @select="onSelectTeam"
    @select-group="onSelectGroup"
  />

  <section v-if="insights" class="insights" aria-label="Group findings">
    <div class="card">
      <span class="tag competitive">Most competitive</span>
      <p class="cardsub">Smallest spread — all four bunched together.</p>
      <ul class="rows">
        <li v-for="s in insights.competitive" :key="s.group">
          <button class="row" @click="onSelectGroup(s.group)">
            <span class="grp">{{ s.group }}</span>
            <span class="rowdesc">{{ val(s.min) }}–{{ val(s.max) }}</span>
            <span class="fig">σ {{ num(s.stdev) }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div class="card">
      <span class="tag onesided">One-sided</span>
      <p class="cardsub">One team far ahead of, or adrift from, the other three.</p>
      <ul v-if="insights.oneSided.length" class="rows">
        <li v-for="s in insights.oneSided" :key="s.group">
          <button class="row" @click="onSelectGroup(s.group)">
            <span class="grp">{{ s.group }}</span>
            <span class="rowdesc">
              <strong>{{ s.outlierTeam }}</strong>
              {{ s.outlierKind === 'leader' ? 'runs clear' : 'adrift' }}
              ({{ num(s.outlierGap) }} gap)
            </span>
            <span class="fig">{{ Math.round(s.dominance * 100) }}%</span>
          </button>
        </li>
      </ul>
      <p v-else class="none">No group stands clearly apart.</p>
    </div>

    <div class="card">
      <span class="tag split">Top-2 / bottom-2</span>
      <p class="cardsub">A clean break between the top two and bottom two.</p>
      <ul v-if="insights.split.length" class="rows">
        <li v-for="s in insights.split" :key="s.group">
          <button class="row" @click="onSelectGroup(s.group)">
            <span class="grp">{{ s.group }}</span>
            <span class="rowdesc">{{ num(s.midGap) }} between the pairs</span>
            <span class="fig">{{ Math.round(s.dominance * 100) }}%</span>
          </button>
        </li>
      </ul>
      <p v-else class="none">No clean 2-2 split.</p>
    </div>
  </section>

  <section v-if="groupName" class="group-panel">
    <header class="group-head">
      <h2>Group {{ groupName }} — teams</h2>
      <button class="close" aria-label="Close" @click="groupName = null">×</button>
    </header>
    <DataTable :columns="COUNTRY_COLUMNS" :rows="groupRows" hide-controls />
  </section>

  <SquadPanel
    v-if="selected && selectedGroup"
    :team="selected"
    :group="selectedGroup"
    :metric="metric"
    @close="selected = null"
  />
</template>

<style scoped>
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
.spacer {
  flex: 1;
}
.tbtn {
  padding: 0.45rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
  text-decoration: none;
}
.tbtn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  list-style: none;
  margin: 0 0 1.25rem;
  padding: 0;
  font-size: 0.8rem;
  color: #374151;
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}
.status {
  color: #6b7280;
}
.status.error {
  color: #b91c1c;
}
.insights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
  margin-top: 1.25rem;
}
.card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 0.8rem 0.9rem;
}
.tag {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  color: #fff;
}
.tag.competitive {
  background: #16a34a;
}
.tag.onesided {
  background: #b91c1c;
}
.tag.split {
  background: #7c3aed;
}
.cardsub {
  margin: 0.4rem 0 0.5rem;
  font-size: 0.78rem;
  color: #6b7280;
  line-height: 1.3;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
  padding: 0.3rem 0.35rem;
  border-radius: 6px;
}
.row:hover {
  background: #f3f4f6;
}
.grp {
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #111827;
  color: #fff;
  font-weight: 800;
  font-size: 0.82rem;
}
.rowdesc {
  flex: 1;
  min-width: 0;
  font-size: 0.82rem;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fig {
  flex: none;
  font-size: 0.78rem;
  font-weight: 700;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.none {
  margin: 0;
  font-size: 0.82rem;
  color: #9ca3af;
}
.group-panel {
  margin-top: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 0.9rem 1.1rem 1.1rem;
}
.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}
.group-head h2 {
  margin: 0;
  font-size: 1.2rem;
}
.group-head .close {
  border: none;
  background: none;
  font-size: 1.7rem;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
}
.group-head .close:hover {
  color: #111827;
}
</style>
