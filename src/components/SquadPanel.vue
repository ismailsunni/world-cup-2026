<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { Team } from '../types'
import { confColor, flagUrl } from '../flags'

const props = defineProps<{ team: Team }>()
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

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <aside class="panel" role="dialog" aria-modal="true" :aria-label="`${team.team} squad`">
      <header class="head" :style="{ borderColor: confColor(team.confederation) }">
        <img v-if="flagUrl(team.team)" class="flag" :src="flagUrl(team.team)!" :alt="team.team" />
        <div class="titles">
          <h2>{{ team.team }}</h2>
          <p class="meta">
            {{ team.confederation }} · FIFA #{{ team.fifa_ranking ?? '—' }}
            <template v-if="team.coach"> · Coach: {{ team.coach }}</template>
          </p>
          <p class="meta">{{ team.squad.length }} players · {{ clubCount }} clubs</p>
        </div>
        <button class="close" aria-label="Close" @click="emit('close')">×</button>
      </header>

      <div class="body">
        <section v-for="grp in grouped" :key="grp.pos">
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
    </aside>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  justify-content: flex-end;
  z-index: 50;
}
.panel {
  width: min(560px, 100%);
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.15);
  font-family: system-ui, sans-serif;
}
.head {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem 1.1rem;
  border-bottom: 4px solid #2563eb;
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
  font-size: 1.3rem;
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
.body {
  overflow-y: auto;
  padding: 0.5rem 1.1rem 2rem;
}
h3 {
  margin: 1rem 0 0.35rem;
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
