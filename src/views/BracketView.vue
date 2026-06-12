<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useData } from '../composables/useData'
import type { Team } from '../types'
import { flagUrl } from '../flags'
import {
  allocateThirds,
  bracketLayout,
  parseThirdSlots,
  resolveBracket,
} from '../simulate'

const { data, error, loading } = useData()

// --- strength lookup ---------------------------------------------------------
const teamByName = computed(() => {
  const m = new Map<string, Team>()
  if (data.value) for (const g of data.value.groups) for (const t of g.teams) m.set(t.team, t)
  return m
})

// Which metric seeds the predictions. Both map to "higher = stronger": Elo
// directly, FIFA ranking inverted (a lower rank number is better).
const basis = ref<'elo' | 'fifa'>('elo')
const BASIS_LABEL = { elo: 'Elo rating', fifa: 'FIFA ranking' }

const strengthOf = (name: string) => {
  const t = teamByName.value.get(name)
  if (!t) return -Infinity
  return basis.value === 'elo' ? (t.elo_rating ?? -1) : -(t.fifa_ranking ?? 999)
}
const seedVal = (name: string) => {
  const t = teamByName.value.get(name)
  if (!t) return '—'
  if (basis.value === 'elo') return t.elo_rating != null ? String(t.elo_rating) : '—'
  return t.fifa_ranking != null ? `#${t.fifa_ranking}` : '—'
}

// --- editable prediction state ----------------------------------------------
const order = ref<Record<string, string[]>>({}) // group → team names, finish order
const thirdsRank = ref<string[]>([]) // group letters, best-third order (top 8 qualify)
const picks = ref<Record<number, string | null>>({}) // match → chosen winner

function seed() {
  if (!data.value) return
  const ord: Record<string, string[]> = {}
  for (const g of data.value.groups) {
    ord[g.group] = [...g.teams]
      .sort((a, b) => strengthOf(b.team) - strengthOf(a.team))
      .map((t) => t.team)
  }
  order.value = ord
  thirdsRank.value = data.value.groups
    .map((g) => g.group)
    .sort((a, b) => strengthOf(ord[b][2]) - strengthOf(ord[a][2]))
  picks.value = {}
}
// Seed on load and re-seed whenever the strength basis changes.
watch([data, basis], seed, { immediate: true })

// Group-stage + thirds editor is collapsed by default so the bracket leads.
const editing = ref(false)

// --- derived standings -------------------------------------------------------
const QUALIFYING_THIRDS = 8

const rank1 = computed(() =>
  Object.fromEntries(Object.entries(order.value).map(([g, ts]) => [g, ts[0]])),
)
const rank2 = computed(() =>
  Object.fromEntries(Object.entries(order.value).map(([g, ts]) => [g, ts[1]])),
)
const thirdByGroupAll = computed(() =>
  Object.fromEntries(Object.entries(order.value).map(([g, ts]) => [g, ts[2]])),
)

const qualifiedGroups = computed(() => thirdsRank.value.slice(0, QUALIFYING_THIRDS))
const thirdByGroup = computed(() =>
  Object.fromEntries(qualifiedGroups.value.map((g) => [g, thirdByGroupAll.value[g]])),
)

// thirds list for display (ranked, with qualify flag)
const thirdsList = computed(() =>
  thirdsRank.value.map((g, i) => ({
    group: g,
    team: thirdByGroupAll.value[g],
    qualifies: i < QUALIFYING_THIRDS,
  })),
)

// --- bracket resolution ------------------------------------------------------
const thirdSlots = computed(() => (data.value ? parseThirdSlots(data.value.bracket) : []))
const thirdAlloc = computed(() => allocateThirds(thirdSlots.value, qualifiedGroups.value))

const resolved = computed(() => {
  if (!data.value) return new Map()
  return resolveBracket({
    bracket: data.value.bracket,
    rank1: rank1.value,
    rank2: rank2.value,
    thirdByGroup: thirdByGroup.value,
    thirdAlloc: thirdAlloc.value,
    picks: picks.value,
    strength: strengthOf,
  })
})

// --- bracket geometry --------------------------------------------------------
const ROW = 72
const COLW = 214
const CARD_W = 188
const CARD_H = 58
const COLUMN_ROUNDS = ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final']

const layout = computed(() => (data.value ? bracketLayout(data.value.bracket) : null))

const geometry = computed(() => {
  if (!data.value || !layout.value) return null
  const lay = layout.value
  const finalNo = lay.root
  const thirdPlaceNo = data.value.bracket.find(
    (b) => b.feeds_into == null && b.match_no !== finalNo,
  )?.match_no
  const roundIndex = (r: string) => {
    const i = COLUMN_ROUNDS.indexOf(r)
    return i === -1 ? COLUMN_ROUNDS.length - 1 : i
  }
  const containerH = lay.leafOrder.length * ROW
  const containerW = COLUMN_ROUNDS.length * COLW - (COLW - CARD_W) + 16

  const finalYc = (lay.pos(finalNo) + 0.5) * ROW
  const cards = data.value.bracket.map((m) => {
    const ri = roundIndex(m.round)
    const yc =
      m.match_no === thirdPlaceNo ? finalYc + CARD_H + 96 : (lay.pos(m.match_no) + 0.5) * ROW
    return { m, ri, x: ri * COLW, yc, top: yc - CARD_H / 2, isThird: m.match_no === thirdPlaceNo }
  })
  const byNo = new Map(cards.map((c) => [c.m.match_no, c]))
  const connectors = cards
    .filter((c) => c.m.feeds_into != null && byNo.has(c.m.feeds_into!))
    .map((c) => {
      const p = byNo.get(c.m.feeds_into!)!
      const x1 = c.x + CARD_W
      const x2 = p.x
      const midX = x1 + (x2 - x1) / 2
      return { d: `M ${x1} ${c.yc} H ${midX} V ${p.yc} H ${x2}` }
    })
  return { containerH, containerW, cards, connectors, finalNo }
})

const champion = computed(() =>
  geometry.value ? (resolved.value.get(geometry.value.finalNo)?.winner ?? null) : null,
)

// --- interactions ------------------------------------------------------------
function reorder(arr: string[], i: number, dir: -1 | 1): string[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
function moveTeam(group: string, i: number, dir: -1 | 1) {
  order.value = { ...order.value, [group]: reorder(order.value[group], i, dir) }
}
function moveThird(i: number, dir: -1 | 1) {
  thirdsRank.value = reorder(thirdsRank.value, i, dir)
}
function pickWinner(matchNo: number, team: string | null) {
  if (!team) return
  picks.value = { ...picks.value, [matchNo]: team }
}

const groupLetters = computed(() => (data.value ? data.value.groups.map((g) => g.group) : []))
function posLabel(i: number) {
  return i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : '4'
}
function descOf(m: { team1_desc: string; team2_desc: string }, key: 'team1' | 'team2') {
  return key === 'team1' ? m.team1_desc : m.team2_desc
}
</script>

<template>
  <div class="page">
    <h2>Bracket simulator</h2>
    <p v-if="loading" class="status">Loading data…</p>
    <p v-else-if="error" class="status error">Failed to load data: {{ error }}</p>

    <template v-else-if="data">
      <p class="sub">
        Predictions are seeded by <strong>{{ BASIS_LABEL[basis] }}</strong>. Open the editor to
        reorder a group's teams or change which third-placed teams qualify, then click a team in
        any knockout match to send them through — results propagate up to the final.
      </p>

      <div class="topbar">
        <div v-if="champion" class="champ">
          <span class="champ-label">Predicted champion</span>
          <span class="champ-team">
            <img v-if="flagUrl(champion)" :src="flagUrl(champion)!" :alt="champion" />
            {{ champion }}
          </span>
        </div>
        <div class="basis" role="group" aria-label="Seeding basis">
          <span class="basis-label">Seed by</span>
          <button :class="{ on: basis === 'elo' }" @click="basis = 'elo'">Elo</button>
          <button :class="{ on: basis === 'fifa' }" @click="basis = 'fifa'">FIFA</button>
        </div>
        <button class="reset" :class="{ on: editing }" @click="editing = !editing">
          {{ editing ? '▲ Hide editor' : '▼ Edit groups & thirds' }}
        </button>
        <button class="reset" @click="seed">↺ Reset</button>
      </div>

      <!-- ===================== GROUP STAGE ===================== -->
      <template v-if="editing">
      <h3 class="section">Group stage — predicted finish</h3>
      <div class="groups">
        <div v-for="g in groupLetters" :key="g" class="gcard">
          <header>Group {{ g }}</header>
          <ol>
            <li
              v-for="(team, i) in order[g]"
              :key="team"
              :class="{ q: i < 2, third: i === 2, out: i === 3 }"
            >
              <span class="rank">{{ posLabel(i) }}</span>
              <img v-if="flagUrl(team)" class="flag" :src="flagUrl(team)!" :alt="team" />
              <span class="tname">{{ team }}</span>
              <span class="elo">{{ seedVal(team) }}</span>
              <span class="badge">
                <template v-if="i < 2">Q</template>
                <template v-else-if="i === 2">3rd</template>
              </span>
              <span class="arrows">
                <button :disabled="i === 0" aria-label="Move up" @click="moveTeam(g, i, -1)">▲</button>
                <button :disabled="i === 3" aria-label="Move down" @click="moveTeam(g, i, 1)">▼</button>
              </span>
            </li>
          </ol>
        </div>
      </div>

      <!-- ===================== BEST THIRDS ===================== -->
      <h3 class="section">
        Best third-placed teams — top {{ QUALIFYING_THIRDS }} of {{ thirdsList.length }} advance
      </h3>
      <ol class="thirds">
        <li
          v-for="(t, i) in thirdsList"
          :key="t.group"
          :class="{ q: t.qualifies, cut: i === QUALIFYING_THIRDS - 1 }"
        >
          <span class="rank">{{ i + 1 }}</span>
          <span class="gtag">{{ t.group }}</span>
          <img v-if="flagUrl(t.team)" class="flag" :src="flagUrl(t.team)!" :alt="t.team" />
          <span class="tname">{{ t.team }}</span>
          <span class="elo">{{ seedVal(t.team) }}</span>
          <span class="badge">{{ t.qualifies ? 'Qualifies' : 'Out' }}</span>
          <span class="arrows">
            <button :disabled="i === 0" aria-label="Move up" @click="moveThird(i, -1)">▲</button>
            <button
              :disabled="i === thirdsList.length - 1"
              aria-label="Move down"
              @click="moveThird(i, 1)"
            >
              ▼
            </button>
          </span>
        </li>
      </ol>
      </template>

      <!-- ===================== KNOCKOUT ===================== -->
      <h3 class="section">Knockout bracket</h3>
      <p class="hint">Scroll horizontally to see all rounds · click a team to advance them</p>
      <div class="bracket-scroll">
        <div
          v-if="geometry"
          class="bracket"
          :style="{ width: geometry.containerW + 'px', height: geometry.containerH + 'px' }"
        >
          <!-- round headers -->
          <div
            v-for="(r, ri) in COLUMN_ROUNDS"
            :key="r"
            class="round-head"
            :style="{ left: ri * COLW + 'px', width: CARD_W + 'px' }"
          >
            {{ r }}
          </div>

          <!-- connectors -->
          <svg class="links" :width="geometry.containerW" :height="geometry.containerH">
            <path v-for="(c, i) in geometry.connectors" :key="i" :d="c.d" />
          </svg>

          <!-- match cards -->
          <div
            v-for="c in geometry.cards"
            :key="c.m.match_no"
            class="match"
            :class="{ third: c.isThird }"
            :style="{ left: c.x + 'px', top: c.top + 'px', width: CARD_W + 'px' }"
          >
            <span class="mno">{{ c.isThird ? '3rd place' : 'M' + c.m.match_no }}</span>
            <template v-for="key in ['team1', 'team2']" :key="key">
              <button
                class="slot"
                :class="{
                  win: resolved.get(c.m.match_no)?.winner &&
                    resolved.get(c.m.match_no)?.[key as 'team1' | 'team2'] ===
                      resolved.get(c.m.match_no)?.winner,
                  unknown: !resolved.get(c.m.match_no)?.[key as 'team1' | 'team2'],
                }"
                :disabled="!resolved.get(c.m.match_no)?.[key as 'team1' | 'team2']"
                @click="pickWinner(c.m.match_no, resolved.get(c.m.match_no)?.[key as 'team1' | 'team2'] ?? null)"
              >
                <template v-if="resolved.get(c.m.match_no)?.[key as 'team1' | 'team2']">
                  <img
                    v-if="flagUrl(resolved.get(c.m.match_no)![key as 'team1' | 'team2']!)"
                    class="flag"
                    :src="flagUrl(resolved.get(c.m.match_no)![key as 'team1' | 'team2']!)!"
                    alt=""
                  />
                  <span class="sname">{{
                    resolved.get(c.m.match_no)![key as 'team1' | 'team2']
                  }}</span>
                </template>
                <span v-else class="sdesc">{{ descOf(c.m, key as 'team1' | 'team2') }}</span>
              </button>
            </template>
          </div>
        </div>
      </div>
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
  max-width: 70ch;
}
.status {
  color: #6b7280;
}
.status.error {
  color: #b91c1c;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.champ {
  display: flex;
  flex-direction: column;
  border: 1px solid #fcd34d;
  background: #fffbeb;
  border-radius: 10px;
  padding: 0.5rem 0.9rem;
}
.champ-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #b45309;
  font-weight: 700;
}
.champ-team {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 800;
  color: #111827;
}
.champ-team img {
  width: 30px;
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}
.basis {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.basis-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #9ca3af;
  font-weight: 700;
}
.basis button {
  padding: 0.4rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: #6b7280;
}
.basis button.on {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.reset {
  padding: 0.45rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
}
.reset:hover {
  background: #f3f4f6;
}
.reset.on {
  border-color: #2563eb;
  color: #2563eb;
}
.section {
  margin: 1.5rem 0 0.75rem;
  font-size: 1.1rem;
}
.hint {
  margin: -0.4rem 0 0.6rem;
  font-size: 0.78rem;
  color: #9ca3af;
}

/* group stage */
.groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}
.gcard {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}
.gcard header {
  background: #f9fafb;
  padding: 0.4rem 0.7rem;
  font-weight: 800;
  font-size: 0.9rem;
  border-bottom: 1px solid #e5e7eb;
}
.gcard ol {
  list-style: none;
  margin: 0;
  padding: 0.3rem 0.5rem;
}
.gcard li,
.thirds li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.28rem 0.3rem;
  border-radius: 6px;
  font-size: 0.85rem;
}
.gcard li.q {
  background: #f0fdf4;
}
.gcard li.third {
  background: #fffbeb;
}
.gcard li.out {
  color: #9ca3af;
}
.rank {
  width: 1.2rem;
  text-align: center;
  font-weight: 700;
  color: #6b7280;
  flex: none;
}
.flag {
  width: 22px;
  height: auto;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
  flex: none;
}
.tname {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.elo {
  font-size: 0.75rem;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
  flex: none;
}
.badge {
  width: 3.6rem;
  text-align: right;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #16a34a;
  flex: none;
}
.gcard li.third .badge {
  color: #b45309;
}
.arrows {
  display: inline-flex;
  flex-direction: column;
  flex: none;
}
.arrows button {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.6rem;
  line-height: 1;
  color: #9ca3af;
  padding: 0.05rem;
}
.arrows button:hover:not(:disabled) {
  color: #111827;
}
.arrows button:disabled {
  opacity: 0.25;
  cursor: default;
}

/* thirds */
.thirds {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  max-width: 560px;
  overflow: hidden;
}
.thirds li {
  border-bottom: 1px solid #f1f5f9;
}
.thirds li.q {
  background: #f0fdf4;
}
.thirds li:not(.q) .badge {
  color: #9ca3af;
}
.thirds li.cut {
  border-bottom: 2px solid #16a34a;
}
.gtag {
  width: 1.4rem;
  text-align: center;
  font-weight: 800;
  background: #111827;
  color: #fff;
  border-radius: 4px;
  font-size: 0.72rem;
  flex: none;
}

/* knockout bracket */
.bracket-scroll {
  overflow-x: auto;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 8px 0;
}
.bracket {
  position: relative;
  margin-top: 26px;
}
.round-head {
  position: absolute;
  top: -26px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
  text-align: center;
}
.links {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.links path {
  fill: none;
  stroke: #d1d5db;
  stroke-width: 1.5;
}
.match {
  position: absolute;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.match.third {
  border-style: dashed;
}
.mno {
  display: block;
  font-size: 0.6rem;
  color: #9ca3af;
  padding: 0.1rem 0.45rem 0;
  font-weight: 700;
}
.slot {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  border: none;
  background: none;
  text-align: left;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.25rem 0.45rem;
  cursor: pointer;
  border-top: 1px solid #f1f5f9;
}
.slot:first-of-type {
  border-top: none;
}
.slot:hover:not(:disabled) {
  background: #eff6ff;
}
.slot.win {
  background: #dcfce7;
  font-weight: 700;
}
.slot.win:hover {
  background: #dcfce7;
}
.slot.unknown {
  cursor: default;
}
.slot .sname {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slot .sdesc {
  flex: 1;
  min-width: 0;
  color: #9ca3af;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
