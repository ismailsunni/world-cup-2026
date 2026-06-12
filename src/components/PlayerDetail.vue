<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { PlayerPoint } from '../players'
import { confColor, flagUrl, posColor } from '../flags'

const props = defineProps<{ player: PlayerPoint }>()
const emit = defineEmits<{ close: [] }>()

const POSITION_LABEL: Record<string, string> = {
  GK: 'Goalkeeper',
  DF: 'Defender',
  MF: 'Midfielder',
  FW: 'Forward',
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
void props
</script>

<template>
  <section class="panel" :aria-label="`${player.name} details`">
    <header class="head" :style="{ borderColor: posColor(player.position) }">
      <span class="pos" :style="{ background: posColor(player.position) }">
        {{ player.position }}
      </span>
      <div class="titles">
        <h2>
          {{ player.name }}
          <span v-if="player.captain" class="cap" title="Captain">(C)</span>
        </h2>
        <p class="meta">
          {{ POSITION_LABEL[player.position] ?? player.position }}
          <template v-if="player.shirt_number != null"> · #{{ player.shirt_number }}</template>
        </p>
      </div>
      <div class="teamtag">
        <img v-if="flagUrl(player.team)" class="flag" :src="flagUrl(player.team)!" :alt="player.team" />
        <div>
          <div class="team">{{ player.team }}</div>
          <div class="conf" :style="{ color: confColor(player.confederation) }">
            {{ player.confederation }} · Group {{ player.group }}
          </div>
        </div>
      </div>
      <button class="close" aria-label="Close" @click="emit('close')">×</button>
    </header>

    <div class="stats">
      <div class="stat">
        <span class="stat-label">Age</span>
        <span class="stat-val">{{ player.age ?? '—' }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Caps</span>
        <span class="stat-val">{{ player.caps ?? '—' }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Goals</span>
        <span class="stat-val">{{ player.goals ?? '—' }}</span>
      </div>
      <div class="stat club">
        <span class="stat-label">Club</span>
        <span class="stat-val sm">{{ player.club || '—' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  margin-top: 1.25rem;
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
.pos {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 8px;
  color: #fff;
  font-weight: 800;
  font-size: 0.85rem;
  flex: none;
}
.titles {
  flex: 1;
  min-width: 0;
}
.titles h2 {
  margin: 0;
  font-size: 1.25rem;
}
.cap {
  color: #b45309;
  font-weight: 700;
  font-size: 0.8rem;
}
.meta {
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
  color: #6b7280;
}
.teamtag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-align: left;
}
.flag {
  width: 38px;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}
.team {
  font-weight: 700;
  font-size: 0.92rem;
}
.conf {
  font-size: 0.75rem;
  font-weight: 600;
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
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem 1.5rem;
  padding: 0.85rem 1.1rem 1.1rem;
  border-top: 1px solid #f1f5f9;
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
.stat-val.sm {
  font-size: 1rem;
}
.stat.club {
  grid-column: 1 / -1;
}
</style>
