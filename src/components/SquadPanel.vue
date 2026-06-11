<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { Group, Team } from '../types'
import type { Metric } from '../metrics'
import { confColor, flagUrl } from '../flags'

const props = defineProps<{ team: Team; group: Group; metric: Metric }>()
const emit = defineEmits<{ close: [] }>()

const POSITION_ORDER = ['GK', 'DF', 'MF', 'FW']

const grouped = computed(() => {
  const byPos = new Map<string, Team['squad']>()
  for (const p of props.team.squad) {
    const arr = byPos.get(p.position) ?? []
    arr.push(p)
    byPos.set(p.position, arr)
  }
  const order = [
    ...POSITION_ORDER.filter((p) => byPos.has(p)),
    ...[...byPos.keys()].filter((p) => !POSITION_ORDER.includes(p)),
  ]
  return order.map((pos) => ({
    pos,
    players: (byPos.get(pos) ?? []).sort(
      (a, b) => (a.shirt_number ?? 99) - (b.shirt_number ?? 99),
    ),
  }))
})

const clubCount = computed(() => new Set(props.team.squad.map((p) => p.club)).size)

const fmtNum = (n: number) => {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
const withUnit = (s: string) => (props.metric.unit ? `${s} ${props.metric.unit}` : s)
const display = (n: number) =>
  withUnit(props.metric.format ? props.metric.format(n) : fmtNum(n))

// Team value vs its group's average for the active metric.
const comparison = computed(() => {
  const v = props.metric.value(props.team)
  const vals = props.group.teams
    .map((t) => props.metric.value(t))
    .filter((x): x is number => x != null)
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  if (v == null || avg == null) return null
  const delta = v - avg
  return {
    value: display(v),
    avg: display(avg),
    deltaLabel: `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${fmtNum(Math.abs(delta))}`,
    above: delta > 0.05,
    below: delta < -0.05,
  }
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="panel" :aria-label="`${team.team} squad`">
    <header class="head" :style="{ borderColor: confColor(team.confederation) }">
      <img v-if="flagUrl(team.team)" class="flag" :src="flagUrl(team.team)!" :alt="team.team" />
      <div class="titles">
        <h2>{{ team.team }} <span class="grouptag">Group {{ group.group }}</span></h2>
        <p class="meta">
          {{ team.confederation }} · FIFA #{{ team.fifa_ranking ?? '—' }}
          <template v-if="team.coach"> · Coach: {{ team.coach }}</template>
          · {{ team.squad.length }} players · {{ clubCount }} clubs
        </p>
      </div>
      <button class="close" aria-label="Close" @click="emit('close')">×</button>
    </header>

    <div v-if="comparison" class="compare">
      <div class="stat">
        <span class="stat-label">{{ metric.label }}</span>
        <span class="stat-val">{{ comparison.value }}</span>
      </div>
      <div
        class="delta"
        :class="{ above: comparison.above, below: comparison.below }"
      >
        {{ comparison.deltaLabel }}
        <span class="delta-sub">
          vs Group {{ group.group }} avg ({{ comparison.avg }})
        </span>
      </div>
      <span v-if="metric.lowerIsBetter" class="note">lower is better</span>
    </div>

    <div class="grid">
      <section v-for="grp in grouped" :key="grp.pos" class="poscol">
        <h3>{{ grp.pos }}</h3>
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Player</th>
              <th class="r">Age</th>
              <th class="r">Caps</th>
              <th class="r">Gls</th>
              <th>Club</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in grp.players" :key="p.name + p.shirt_number">
              <td class="num">{{ p.shirt_number ?? '' }}</td>
              <td>
                {{ p.name }}
                <span v-if="p.captain" class="cap" title="Captain">(C)</span>
              </td>
              <td class="r">{{ p.age ?? '—' }}</td>
              <td class="r">{{ p.caps ?? '—' }}</td>
              <td class="r">{{ p.goals ?? '—' }}</td>
              <td class="club">{{ p.club }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </section>
</template>

<style scoped>
.panel {
  margin-top: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  font-family: system-ui, sans-serif;
  overflow: hidden;
}
.head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.9rem 1.1rem;
  border-left: 6px solid #2563eb;
}
.flag {
  width: 44px;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}
.titles {
  flex: 1;
  min-width: 0;
}
.titles h2 {
  margin: 0;
  font-size: 1.25rem;
}
.grouptag {
  font-size: 0.7rem;
  font-weight: 600;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  vertical-align: middle;
  margin-left: 0.35rem;
}
.meta {
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
  color: #6b7280;
}
.close {
  border: none;
  background: none;
  font-size: 1.7rem;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
  padding: 0 0.25rem;
}
.close:hover {
  color: #111827;
}
.compare {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  padding: 0.6rem 1.1rem 0.9rem;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
  background: #f9fafb;
}
.stat {
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #9ca3af;
}
.stat-val {
  font-size: 1.4rem;
  font-weight: 700;
  color: #111827;
}
.delta {
  font-size: 1.05rem;
  font-weight: 700;
  color: #6b7280;
}
.delta.above {
  color: #b91c1c;
}
.delta.below {
  color: #1d4ed8;
}
.delta-sub {
  font-size: 0.8rem;
  font-weight: 500;
  color: #6b7280;
}
.note {
  font-size: 0.75rem;
  color: #9ca3af;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0 1.5rem;
  padding: 0.25rem 1.1rem 1.25rem;
}
h3 {
  margin: 0.9rem 0 0.35rem;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9ca3af;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
th,
td {
  text-align: left;
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid #f1f5f9;
}
th {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #9ca3af;
  font-weight: 600;
}
.num {
  width: 2rem;
  color: #9ca3af;
}
.r {
  text-align: right;
  width: 2.8rem;
  font-variant-numeric: tabular-nums;
}
.club {
  color: #6b7280;
}
.cap {
  color: #b45309;
  font-weight: 700;
  font-size: 0.75rem;
}
</style>
