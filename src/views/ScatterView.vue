<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useData } from '../composables/useData'
import { buildPlayerPoints, type PlayerPoint } from '../players'
import { POSITIONS, posColor } from '../flags'
import PlayerScatter from '../components/PlayerScatter.vue'
import PlayerDetail from '../components/PlayerDetail.vue'

const { data, error, loading } = useData()

const allPoints = computed<PlayerPoint[]>(() =>
  data.value ? buildPlayerPoints(data.value) : [],
)

const group = ref('') // '' = all groups
const country = ref('') // '' = all countries
const hidden = ref<Set<string>>(new Set()) // positions toggled off via the legend
const markCaptains = ref(true) // halo on captain dots
const selected = ref<PlayerPoint | null>(null)

const ZOOM_STEP = 1.5
const ZOOM_MAX = 6
const zoom = ref(1)
function zoomIn() {
  zoom.value = Math.min(ZOOM_MAX, Math.round(zoom.value * ZOOM_STEP * 100) / 100)
}
function zoomOut() {
  zoom.value = Math.max(1, Math.round((zoom.value / ZOOM_STEP) * 100) / 100)
}

const groups = computed(() =>
  [...new Set(allPoints.value.map((p) => p.group))].sort(),
)

// Countries available depend on the active group filter.
const countries = computed(() =>
  [
    ...new Set(
      allPoints.value
        .filter((p) => !group.value || p.group === group.value)
        .map((p) => p.team),
    ),
  ].sort((a, b) => a.localeCompare(b)),
)

// Reset a now-invalid country when the group filter changes.
watch(group, () => {
  if (country.value && !countries.value.includes(country.value)) country.value = ''
})

const filtered = computed(() =>
  allPoints.value.filter(
    (p) =>
      (!group.value || p.group === group.value) &&
      (!country.value || p.team === country.value) &&
      !hidden.value.has(p.position),
  ),
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
  markCaptains.value = true
  selected.value = null
  zoom.value = 1
}

const hasFilters = computed(
  () => !!group.value || !!country.value || hidden.value.size > 0 || !markCaptains.value,
)
</script>

<template>
  <div class="page">
    <h2>Player chart</h2>
    <p class="sub">
      Every selected player as a dot — <strong>caps</strong> (international appearances)
      against <strong>age</strong>, colored by position. Use the legend to toggle
      positions, filter by group or country, and click a dot for the player's details.
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
      <button
        class="toggle"
        :class="{ on: markCaptains }"
        :aria-pressed="markCaptains"
        @click="markCaptains = !markCaptains"
      >
        <span class="cdot" aria-hidden="true" />Mark captains
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
      <div class="plot-toolbar">
        <div class="zoom" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" :disabled="zoom <= 1" @click="zoomOut">−</button>
          <span class="zlevel">{{ Math.round(zoom * 100) }}%</span>
          <button aria-label="Zoom in" :disabled="zoom >= ZOOM_MAX" @click="zoomIn">+</button>
          <button class="zreset" :disabled="zoom === 1" @click="zoom = 1">Reset</button>
        </div>
        <span v-if="zoom > 1" class="zhint">scroll to pan</span>
      </div>
      <div class="plot-wrap">
        <PlayerScatter
          :points="filtered"
          :domain-points="allPoints"
          :selected="selected"
          :mark-captains="markCaptains"
          :zoom="zoom"
          @select="selected = $event"
        />
      </div>
      <PlayerDetail v-if="selected" :player="selected" @close="selected = null" />
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
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
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
  border-color: #111827;
  color: #111827;
}
.cdot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #9ca3af;
  box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px #9ca3af;
}
.toggle.on .cdot {
  background: #2563eb;
  box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px #111827;
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
.plot-toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}
.zoom {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.zoom button {
  min-width: 2rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1;
  color: #374151;
}
.zoom button.zreset {
  font-size: 0.8rem;
  font-weight: 600;
}
.zoom button:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}
.zoom button:disabled {
  opacity: 0.4;
  cursor: default;
}
.zlevel {
  min-width: 3rem;
  text-align: center;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  color: #6b7280;
}
.zhint {
  font-size: 0.78rem;
  color: #9ca3af;
}
.plot-wrap {
  overflow: auto;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
}
.status {
  color: #6b7280;
}
.status.error {
  color: #b91c1c;
}
</style>
