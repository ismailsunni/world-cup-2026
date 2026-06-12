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
    <button
      v-if="insights.mostCompetitive"
      class="card"
      @click="onSelectGroup(insights.mostCompetitive.group)"
    >
      <span class="tag competitive">Most competitive</span>
      <span class="grp">Group {{ insights.mostCompetitive.group }}</span>
      <span class="desc">
        Tightest race — all four within
        {{ val(insights.mostCompetitive.range) }}
        ({{ val(insights.mostCompetitive.min) }}–{{ val(insights.mostCompetitive.max) }}).
      </span>
      <span class="fig">σ {{ num(insights.mostCompetitive.stdev) }}</span>
    </button>

    <button
      v-if="insights.mostOneSided"
      class="card"
      @click="onSelectGroup(insights.mostOneSided.group)"
    >
      <span class="tag onesided">Most one-sided</span>
      <span class="grp">Group {{ insights.mostOneSided.group }}</span>
      <span class="desc">
        <template v-if="insights.mostOneSided.oneSidedKind === 'leader'">
          <strong>{{ insights.mostOneSided.bestTeam }}</strong> runs away from the pack
          ({{ val(insights.mostOneSided.leaderGap) }} clear of the rest).
        </template>
        <template v-else>
          <strong>{{ insights.mostOneSided.worstTeam }}</strong> is adrift at the bottom
          ({{ val(insights.mostOneSided.trailerGap) }} behind the rest).
        </template>
      </span>
      <span class="fig">{{ Math.round(insights.mostOneSided.oneSidedRatio * 100) }}% of spread</span>
    </button>

    <button
      v-if="insights.mostSplit"
      class="card"
      @click="onSelectGroup(insights.mostSplit.group)"
    >
      <span class="tag split">Clearest top-2 / bottom-2</span>
      <span class="grp">Group {{ insights.mostSplit.group }}</span>
      <span class="desc">
        A clean 2-2 split — {{ val(insights.mostSplit.midGap) }} separates the top two
        from the bottom two.
      </span>
      <span class="fig">{{ Math.round(insights.mostSplit.splitRatio * 100) }}% of spread</span>
    </button>
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  text-align: left;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 0.8rem 0.9rem;
  cursor: pointer;
  font: inherit;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}
.card:hover {
  border-color: #9ca3af;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.tag {
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
.grp {
  font-size: 1.15rem;
  font-weight: 800;
  color: #111827;
}
.desc {
  font-size: 0.85rem;
  color: #374151;
  line-height: 1.35;
}
.fig {
  margin-top: 0.1rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
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
