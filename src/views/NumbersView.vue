<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useData } from '../composables/useData'
import { buildPlayerPoints, type PlayerPoint } from '../players'
import { POSITIONS, posColor } from '../flags'
import ShirtPositionChart from '../components/ShirtPositionChart.vue'
import DataTable from '../components/DataTable.vue'
import { PLAYER_COLUMNS } from '../tables'

const { data, error, loading } = useData()

const allPoints = computed<PlayerPoint[]>(() =>
  data.value ? buildPlayerPoints(data.value) : [],
)

const group = ref('')
const country = ref('')
const mode = ref<'count' | 'percent'>('count')
const captainsOnly = ref(false)
const hidden = ref<Set<string>>(new Set())

const groups = computed(() => [...new Set(allPoints.value.map((p) => p.group))].sort())

const countries = computed(() =>
  [
    ...new Set(
      allPoints.value
        .filter((p) => !group.value || p.group === group.value)
        .map((p) => p.team),
    ),
  ].sort((a, b) => a.localeCompare(b)),
)

watch(group, () => {
  if (country.value && !countries.value.includes(country.value)) country.value = ''
})

const filtered = computed(() =>
  allPoints.value.filter(
    (p) =>
      (!group.value || p.group === group.value) &&
      (!country.value || p.team === country.value) &&
      (!captainsOnly.value || p.captain),
  ),
)

const visiblePositions = computed(() => POSITIONS.filter((p) => !hidden.value.has(p)))

const selectedNumber = ref<number | null>(null)

// Players wearing the selected number, within the active filters/positions.
const selectedPlayers = computed(() =>
  selectedNumber.value == null
    ? []
    : filtered.value
        .filter(
          (p) => p.shirt_number === selectedNumber.value && visiblePositions.value.includes(p.position),
        )
        .sort(
          (a, b) =>
            POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) ||
            a.team.localeCompare(b.team),
        ),
)

// Drop the redundant "#" column — every row shares the selected number.
const listColumns = PLAYER_COLUMNS.filter((c) => c.key !== 'shirt_number')
const selectedRows = computed(() =>
  selectedPlayers.value.map((p) => ({
    player_name: p.name,
    position: p.position,
    team: p.team,
    group: p.group,
    age: p.age,
    caps: p.caps,
    goals: p.goals,
    captain: p.captain,
    club: p.club,
  })),
)

function togglePos(pos: string) {
  const next = new Set(hidden.value)
  if (next.has(pos)) next.delete(pos)
  else next.add(pos)
  hidden.value = next
}

function reset() {
  group.value = ''
  country.value = ''
  hidden.value = new Set()
  mode.value = 'count'
  captainsOnly.value = false
  selectedNumber.value = null
}

const hasFilters = computed(
  () =>
    !!group.value ||
    !!country.value ||
    hidden.value.size > 0 ||
    mode.value !== 'count' ||
    captainsOnly.value,
)
</script>

<template>
  <div class="page">
    <h2>Squad numbers</h2>
    <p class="sub">
      Each bar is a <strong>shirt number</strong>, split by the <strong>position</strong> of
      the players wearing it. The trend is clear: #1 is the goalkeeper, low numbers skew
      defensive, #9–#11 lean forward. Switch to <strong>percent</strong> to compare the
      position mix per number regardless of how often it's used.
    </p>

    <div class="controls">
      <label class="ctl">
        <span>Group</span>
        <select v-model="group">
          <option value="">All groups</option>
          <option v-for="g in groups" :key="g" :value="g">Group {{ g }}</option>
        </select>
      </label>
      <label class="ctl">
        <span>Country</span>
        <select v-model="country">
          <option value="">All countries</option>
          <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <div class="ctl">
        <span>Scale</span>
        <div class="seg-toggle" role="group" aria-label="Value scale">
          <button :class="{ on: mode === 'count' }" @click="mode = 'count'">Count</button>
          <button :class="{ on: mode === 'percent' }" @click="mode = 'percent'">Percent</button>
        </div>
      </div>
      <button
        class="toggle"
        :class="{ on: captainsOnly }"
        :aria-pressed="captainsOnly"
        @click="captainsOnly = !captainsOnly"
      >
        Captains only
      </button>
      <button v-if="hasFilters" class="reset" @click="reset">Reset</button>
      <span class="spacer" />
      <span class="count">{{ filtered.length }} players</span>
    </div>

    <ul class="legend" aria-label="Position colors (click to toggle)">
      <li v-for="pos in POSITIONS" :key="pos">
        <button
          class="legend-btn"
          :class="{ off: hidden.has(pos) }"
          :aria-pressed="!hidden.has(pos)"
          @click="togglePos(pos)"
        >
          <span class="swatch" :style="{ background: posColor(pos) }" />{{ pos }}
        </button>
      </li>
    </ul>

    <p v-if="loading" class="status">Loading data…</p>
    <p v-else-if="error" class="status error">Failed to load data: {{ error }}</p>
    <template v-else>
      <ShirtPositionChart
        :points="filtered"
        :domain-points="allPoints"
        :mode="mode"
        :positions="visiblePositions"
        :selected="selectedNumber"
        @select="selectedNumber = selectedNumber === $event ? null : $event"
      />

      <section v-if="selectedNumber != null" class="list-panel">
        <header class="list-head">
          <h3>
            <span class="numtag">#{{ selectedNumber }}</span>
            {{ selectedPlayers.length }} player{{ selectedPlayers.length === 1 ? '' : 's' }}
          </h3>
          <button class="close" aria-label="Close" @click="selectedNumber = null">×</button>
        </header>
        <DataTable
          v-if="selectedPlayers.length"
          :columns="listColumns"
          :rows="selectedRows"
          hide-controls
        />
        <p v-else class="empty">No players wear #{{ selectedNumber }} under the current filters.</p>
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
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem 0.85rem;
  margin-bottom: 0.85rem;
}
.ctl {
  display: inline-flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.7rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.ctl select {
  padding: 0.35rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
  min-width: 150px;
}
.seg-toggle {
  display: inline-flex;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
}
.seg-toggle button {
  padding: 0.35rem 0.7rem;
  border: none;
  background: #fff;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: #6b7280;
}
.seg-toggle button + button {
  border-left: 1px solid #d1d5db;
}
.seg-toggle button.on {
  background: #2563eb;
  color: #fff;
}
.reset {
  padding: 0.4rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.reset:hover {
  background: #f3f4f6;
}
.toggle {
  padding: 0.4rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b7280;
}
.toggle:hover {
  border-color: #9ca3af;
}
.toggle.on {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.spacer {
  flex: 1;
}
.count {
  font-size: 0.8rem;
  color: #9ca3af;
  white-space: nowrap;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.6rem;
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
}
.legend-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
}
.legend-btn:hover {
  border-color: #9ca3af;
}
.legend-btn.off {
  opacity: 0.4;
}
.legend-btn.off .swatch {
  filter: grayscale(1);
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
.list-panel {
  margin-top: 1.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 0.6rem 1rem 0.9rem;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.list-head h3 {
  margin: 0;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.numtag {
  background: #111827;
  color: #fff;
  border-radius: 6px;
  padding: 0.1rem 0.5rem;
  font-variant-numeric: tabular-nums;
}
.close {
  border: none;
  background: none;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
}
.close:hover {
  color: #111827;
}
.list-panel :deep(.dt) {
  margin-top: 0.6rem;
}
.empty {
  margin: 0.6rem 0 0;
  color: #9ca3af;
}
</style>
