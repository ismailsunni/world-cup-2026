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

const { data, error, loading } = useData()
const metric = ref<Metric>(DEFAULT_METRIC)
const confederations = Object.entries(CONFEDERATION_COLOR)

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
