<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useData } from './composables/useData'
import { DEFAULT_METRIC, type Metric } from './metrics'
import type { Group, Team } from './types'
import GroupDotPlot from './components/GroupDotPlot.vue'
import MetricSwitcher from './components/MetricSwitcher.vue'
import SquadPanel from './components/SquadPanel.vue'
import DataTable from './components/DataTable.vue'
import { CONFEDERATION_COLOR } from './flags'
import {
  COUNTRY_COLUMNS,
  PLAYER_COLUMNS,
  buildCountryRows,
  buildPlayerRows,
  type Column,
} from './tables'

const { data, error, loading } = useData()
const metric = ref<Metric>(DEFAULT_METRIC)
const confederations = Object.entries(CONFEDERATION_COLOR)
const selected = ref<Team | null>(null)

const selectedGroup = computed<Group | null>(() => {
  if (!selected.value || !data.value) return null
  return (
    data.value.groups.find((g) => g.teams.some((t) => t.team === selected.value!.team)) ??
    null
  )
})

// --- Tables (all countries / all players, plus per-group drill-down) ---
interface TableState {
  title: string
  columns: Column[]
  rows: Record<string, unknown>[]
  initialFilters?: Record<string, string>
}
const table = ref<TableState | null>(null)

function openCountries(group?: string) {
  if (!data.value) return
  table.value = {
    title: group ? `Group ${group} — teams` : 'All teams',
    columns: COUNTRY_COLUMNS,
    rows: buildCountryRows(data.value),
    initialFilters: group ? { group } : undefined,
  }
}
function openPlayers() {
  if (!data.value) return
  table.value = {
    title: 'All players',
    columns: PLAYER_COLUMNS,
    rows: buildPlayerRows(data.value),
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') table.value = null
}
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <main class="app">
    <header>
      <h1>World Cup 2026 — Groups</h1>
      <p class="sub">
        Each group is a line; each flag is a team, placed by the selected metric. The
        dashed tick marks the group average — the right-hand column flags the highest
        (▲ max) and lowest (▼ min). Click a team for its squad, or a group row for its
        teams.
      </p>
    </header>

    <div class="controls">
      <MetricSwitcher v-model="metric" />
      <span v-if="metric.lowerIsBetter" class="hint">← better</span>
      <span class="spacer" />
      <button class="tbtn" :disabled="!data" @click="openCountries()">All teams</button>
      <button class="tbtn" :disabled="!data" @click="openPlayers()">All players</button>
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
      @select="selected = $event"
      @select-group="openCountries($event)"
    />

    <SquadPanel
      v-if="selected && selectedGroup"
      :team="selected"
      :group="selectedGroup"
      :metric="metric"
      @close="selected = null"
    />

    <div v-if="table" class="modal-backdrop" @click.self="table = null">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="table.title">
        <header class="modal-head">
          <h2>{{ table.title }}</h2>
          <button class="close" aria-label="Close" @click="table = null">×</button>
        </header>
        <DataTable
          :key="table.title"
          :columns="table.columns"
          :rows="table.rows"
          :initial-filters="table.initialFilters"
        />
      </div>
    </div>
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
}
.tbtn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}
.tbtn:disabled {
  opacity: 0.5;
  cursor: default;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5vh 2vw;
  z-index: 60;
}
.modal {
  background: #fff;
  border-radius: 12px;
  width: min(1100px, 100%);
  max-height: 95vh;
  display: flex;
  flex-direction: column;
  padding: 1rem 1.1rem 1.1rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.modal-head h2 {
  margin: 0;
  font-size: 1.2rem;
}
.modal-head .close {
  border: none;
  background: none;
  font-size: 1.7rem;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
}
.modal-head .close:hover {
  color: #111827;
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
</style>
