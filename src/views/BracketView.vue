<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useData } from '../composables/useData'
import type { Team } from '../types'
import { flagUrl } from '../flags'
import {
  allocateThirds,
  bracketLayout,
  parseThirdSlots,
  resolveBracket,
} from '../simulate'
import { decodeShare, encodeShare } from '../share'

const { data, error, loading } = useData()
const route = useRoute()

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
const QUALIFYING_THIRDS = 8
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

// Build picks from a winner-side map (0 = team1 advances, 1 = team2), resolving
// matches in order so each side maps to a concrete team.
function rebuildPicks(
  ord: Record<string, string[]>,
  thirds: string[],
  sides: Record<number, 0 | 1>,
): Record<number, string | null> {
  if (!data.value) return {}
  const r1 = Object.fromEntries(Object.entries(ord).map(([g, ts]) => [g, ts[0]]))
  const r2 = Object.fromEntries(Object.entries(ord).map(([g, ts]) => [g, ts[1]]))
  const qual = thirds.slice(0, QUALIFYING_THIRDS)
  const tbg = Object.fromEntries(qual.map((g) => [g, ord[g][2]]))
  const alloc = allocateThirds(parseThirdSlots(data.value.bracket), qual)
  const res = resolveBracket({
    bracket: data.value.bracket,
    rank1: r1,
    rank2: r2,
    thirdByGroup: tbg,
    thirdAlloc: alloc,
    picks: {},
    strength: () => 0,
    decide: (t1, t2, no) => (sides[no] === 1 ? t2 : t1),
  })
  const np: Record<number, string | null> = {}
  res.forEach((r, no) => {
    if (r.winner) np[no] = r.winner
  })
  return np
}

let applying = false
function applyState(
  ord: Record<string, string[]>,
  thirds: string[],
  basisVal: 'elo' | 'fifa',
  sides: Record<number, 0 | 1>,
) {
  applying = true
  basis.value = basisVal
  order.value = ord
  thirdsRank.value = thirds
  picks.value = rebuildPicks(ord, thirds, sides)
  applying = false
}

// Rebuild the prediction from a shared code (?p=...). Returns false if invalid.
function applyShare(code: string): boolean {
  if (!data.value) return false
  const nos = data.value.bracket.map((m) => m.match_no)
  const dec = decodeShare(code, data.value.groups, nos)
  if (!dec) return false
  applyState(dec.order, dec.thirdsRank, dec.basis, dec.sides)
  return true
}

// The winner-side of every knockout match in the current bracket.
function currentSides(): Record<number, 0 | 1> {
  const sides: Record<number, 0 | 1> = {}
  if (!data.value) return sides
  for (const m of data.value.bracket) {
    const r = resolved.value.get(m.match_no)
    sides[m.match_no] = r && r.winner && r.team2 && r.winner === r.team2 ? 1 : 0
  }
  return sides
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const cloneOrder = (o: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(o).map(([g, a]) => [g, [...a]]))

// Fully random prediction: shuffle every group, the thirds order, and coin-flip
// each knockout match.
function randomize() {
  if (!data.value) return
  const ord: Record<string, string[]> = {}
  for (const g of data.value.groups) ord[g.group] = shuffle(g.teams.map((t) => t.team))
  const thirds = shuffle(data.value.groups.map((g) => g.group))
  const sides: Record<number, 0 | 1> = {}
  for (const m of data.value.bracket) sides[m.match_no] = Math.random() < 0.5 ? 1 : 0
  applyState(ord, thirds, basis.value, sides)
}

// Keep the current prediction but inject a few random upsets.
function tweak() {
  if (!data.value) return
  const ord = cloneOrder(order.value)
  const letters = data.value.groups.map((g) => g.group)
  // swap an adjacent pair in 3 random groups
  for (const g of shuffle(letters).slice(0, 3)) {
    const i = Math.floor(Math.random() * 3)
    ;[ord[g][i], ord[g][i + 1]] = [ord[g][i + 1], ord[g][i]]
  }
  // nudge the thirds cut by one
  const thirds = [...thirdsRank.value]
  const j = Math.floor(Math.random() * (thirds.length - 1))
  ;[thirds[j], thirds[j + 1]] = [thirds[j + 1], thirds[j]]
  // flip 3 random knockout results
  const sides = currentSides()
  const nos = data.value.bracket.map((m) => m.match_no)
  for (const no of shuffle(nos).slice(0, 3)) sides[no] = sides[no] === 1 ? 0 : 1
  applyState(ord, thirds, basis.value, sides)
}

// On data load: apply a shared code if present, otherwise seed from Elo.
const pendingCode = typeof route.query.p === 'string' ? route.query.p : null
watch(
  data,
  () => {
    if (!data.value) return
    if (pendingCode && applyShare(pendingCode)) return
    seed()
  },
  { immediate: true },
)
// User-driven basis change re-seeds (ignored while applying a shared code).
watch(basis, () => {
  if (!applying) seed()
})

// Group-stage + thirds editor is collapsed by default so the bracket leads.
const editing = ref(false)

// --- share link --------------------------------------------------------------
const shareUrl = ref('')
const copied = ref(false)
function makeShareLink() {
  if (!data.value) return
  const nos = data.value.bracket.map((m) => m.match_no)
  const code = encodeShare(
    { basis: basis.value, order: order.value, thirdsRank: thirdsRank.value, sides: currentSides() },
    data.value.groups,
    nos,
  )
  const url = `${location.origin}${location.pathname}#/bracket?p=${code}`
  shareUrl.value = url
  copied.value = false
  navigator.clipboard?.writeText(url).then(
    () => {
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    },
    () => {},
  )
}

// --- export to image (flags only) -------------------------------------------
const imageError = ref('')
async function generateImage() {
  if (!data.value || !layout.value) return
  imageError.value = ''
  const lay = layout.value
  const res = resolved.value
  const bracket = data.value.bracket
  const byNo = new Map(bracket.map((m) => [m.match_no, m]))

  const M = { top: 70, left: 16, right: 196, bottom: 52 }
  const COLW = 96
  const ROW = 66
  const FW = 34
  const FH = 22
  const GAP = 6 // between the two flags in a match
  const PAD = 6 // card inner padding
  const CW = FW + PAD * 2 // card width
  const CH = FH * 2 + GAP + PAD * 2 // card height
  const cols = COLUMN_ROUNDS
  const colIndex = (r: string) => {
    const i = cols.indexOf(r)
    return i === -1 ? cols.length - 1 : i
  }
  const cardX = (ri: number) => M.left + ri * COLW
  const cardYc = (no: number) => M.top + (lay.pos(no) + 0.5) * ROW
  const plotH = lay.leafOrder.length * ROW
  const W = M.left + cols.length * COLW + M.right
  const H = M.top + plotH + M.bottom
  const champ = res.get(lay.root)?.winner ?? null
  const thirdPlaceNo = bracket.find((b) => b.feeds_into == null && b.match_no !== lay.root)?.match_no

  // preload the flags we'll draw (CORS so the canvas isn't tainted)
  const need = new Set<string>()
  for (const m of bracket)
    for (const k of ['team1', 'team2'] as const) {
      const t = res.get(m.match_no)?.[k]
      if (t && flagUrl(t)) need.add(t)
    }
  const imgs = new Map<string, HTMLImageElement>()
  await Promise.all(
    [...need].map(
      (t) =>
        new Promise<void>((resolve) => {
          const im = new Image()
          im.crossOrigin = 'anonymous'
          im.onload = () => {
            imgs.set(t, im)
            resolve()
          }
          im.onerror = () => resolve()
          im.src = flagUrl(t, 80)!
        }),
    ),
  )

  const scale = 2
  const cv = document.createElement('canvas')
  cv.width = W * scale
  cv.height = H * scale
  const ctx = cv.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  const rrect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r)
    else ctx.rect(x, y, w, h)
  }

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#111827'
  ctx.font = '700 18px system-ui, sans-serif'
  ctx.fillText('World Cup 2026 — Predicted Bracket', M.left, 28)
  ctx.fillStyle = '#6b7280'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText(`Seeded by ${BASIS_LABEL[basis.value]}`, M.left, 48)

  ctx.fillStyle = '#9ca3af'
  ctx.font = '700 10px system-ui, sans-serif'
  cols.forEach((r, ri) => ctx.fillText(r.toUpperCase(), cardX(ri), M.top - 12))

  // connectors (drawn first, under the cards)
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1.5
  for (const m of bracket) {
    if (m.feeds_into == null || !byNo.has(m.feeds_into)) continue
    const x1 = cardX(colIndex(m.round)) + CW
    const y1 = cardYc(m.match_no)
    const x2 = cardX(colIndex(byNo.get(m.feeds_into)!.round))
    const y2 = cardYc(m.feeds_into)
    const midX = (x1 + x2) / 2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(midX, y1)
    ctx.lineTo(midX, y2)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  const drawSlot = (t: string | null, fx: number, y: number, win: boolean) => {
    if (win) {
      ctx.fillStyle = '#dcfce7'
      ctx.strokeStyle = '#16a34a'
      ctx.lineWidth = 1.5
      rrect(fx - 4, y - 3, FW + 8, FH + 6, 4)
      ctx.fill()
      ctx.stroke()
    }
    ctx.globalAlpha = t && !win ? 0.45 : 1
    const im = t ? imgs.get(t) : null
    if (im) ctx.drawImage(im, fx, y, FW, FH)
    else {
      ctx.fillStyle = '#eef2f7'
      ctx.fillRect(fx, y, FW, FH)
    }
    ctx.strokeStyle = win ? '#16a34a' : '#d1d5db'
    ctx.lineWidth = 1
    ctx.strokeRect(fx, y, FW, FH)
    ctx.globalAlpha = 1
  }

  const drawMatch = (no: number, x: number, yc: number) => {
    const r = res.get(no)
    // card
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    rrect(x, yc - CH / 2, CW, CH, 7)
    ctx.fill()
    ctx.stroke()
    const fx = x + (CW - FW) / 2
    const y1 = yc - CH / 2 + PAD
    drawSlot(r?.team1 ?? null, fx, y1, !!r?.winner && r?.team1 === r?.winner)
    drawSlot(r?.team2 ?? null, fx, y1 + FH + GAP, !!r?.winner && r?.team2 === r?.winner)
  }

  for (const m of bracket) {
    if (m.match_no === thirdPlaceNo) continue // drawn separately below the champion
    drawMatch(m.match_no, cardX(colIndex(m.round)), cardYc(m.match_no))
  }

  // champion callout to the right of the (centered) final
  {
    const x = cardX(cols.length - 1)
    const yc = cardYc(lay.root)
    const cx = x + CW + 26
    ctx.fillStyle = '#b45309'
    ctx.font = '700 11px system-ui, sans-serif'
    ctx.fillText('CHAMPION', cx, yc - FH)
    const cim = champ ? imgs.get(champ) : null
    const bw = FW * 1.7
    const bh = FH * 1.7
    if (cim) {
      ctx.drawImage(cim, cx, yc - FH + 8, bw, bh)
      ctx.strokeStyle = '#fcd34d'
      ctx.lineWidth = 2
      ctx.strokeRect(cx, yc - FH + 8, bw, bh)
    }
    ctx.fillStyle = '#111827'
    ctx.font = '700 16px system-ui, sans-serif'
    ctx.fillText(champ ?? '—', cx + (cim ? bw + 10 : 0), yc + 8)

    // third-place playoff block under the champion
    if (thirdPlaceNo != null) {
      const ty = yc + CH + 70
      ctx.fillStyle = '#6b7280'
      ctx.font = '700 10px system-ui, sans-serif'
      ctx.fillText('THIRD PLACE', x, ty - CH / 2 - 8)
      drawMatch(thirdPlaceNo, x, ty)
    }
  }

  try {
    const url = cv.toDataURL('image/jpeg', 0.92)
    const a = document.createElement('a')
    a.download = 'wc2026-bracket.jpg'
    a.href = url
    a.click()
  } catch {
    imageError.value =
      'Could not export the image — the flag CDN blocked canvas access in this browser.'
  }
}

// --- derived standings -------------------------------------------------------
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
const byMatchNo = computed(
  () => new Map((data.value?.bracket ?? []).map((m) => [m.match_no, m])),
)

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

// --- bracket analysis (the 4 teams feeding each Round-of-16 match) ----------
// A "bracket" = two R32 ties → one R16 match; its winner reaches the QF.
const analysisOpen = ref(false)

interface BracketStat {
  r16: number
  feeders: number[]
  teams: { name: string; s: number }[] // sorted strongest → weakest
  total: number
  stdev: number
  favorite: string | null
  edge: number // favorite strength − average of the other three (how much it outclasses the field)
  complete: boolean
}

const bracketAnalysis = computed(() => {
  if (!data.value) return null
  const all = data.value.bracket
  const r16 = all.filter((b) => b.round === 'Round of 16')

  const brackets: BracketStat[] = r16.map((m) => {
    const feeders = all.filter((b) => b.feeds_into === m.match_no)
    const names: string[] = []
    for (const f of feeders) {
      const r = resolved.value.get(f.match_no)
      if (r?.team1) names.push(r.team1)
      if (r?.team2) names.push(r.team2)
    }
    const teams = names.map((n) => ({ name: n, s: strengthOf(n) })).sort((a, b) => b.s - a.s)
    const vals = teams.map((t) => t.s)
    const total = vals.reduce((a, b) => a + b, 0)
    const mean = vals.length ? total / vals.length : 0
    const stdev = vals.length
      ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
      : 0
    // How much the favourite outclasses the rest, in absolute strength.
    const edge =
      vals.length >= 2 ? vals[0] - vals.slice(1).reduce((a, b) => a + b, 0) / (vals.length - 1) : 0
    return {
      r16: m.match_no,
      feeders: feeders.map((f) => f.match_no),
      teams,
      total,
      stdev,
      favorite: teams[0]?.name ?? null,
      edge,
      complete: names.length === 4,
    }
  })

  const done = brackets.filter((b) => b.complete)
  const pick = (sel: (b: BracketStat) => number, dir: 'min' | 'max') =>
    done.length
      ? done.reduce((best, b) =>
          (dir === 'min' ? sel(b) < sel(best) : sel(b) > sel(best)) ? b : best,
        )
      : null
  const weakest = pick((b) => b.total, 'min')
  const strongest = pick((b) => b.total, 'max')
  const competitive = pick((b) => b.stdev, 'min')
  const easiest = pick((b) => b.edge, 'max')

  // First-assigned category wins, so a bracket gets one colour (priority below).
  const catByMatch: Record<number, string> = {}
  const tag = (b: BracketStat | null, cat: string) => {
    if (!b) return
    for (const no of [b.r16, ...b.feeders]) if (!catByMatch[no]) catByMatch[no] = cat
  }
  tag(easiest, 'easy')
  tag(competitive, 'comp')
  tag(strongest, 'strong')
  tag(weakest, 'weak')

  return { brackets, weakest, strongest, competitive, easiest, catByMatch }
})

// Category colour class for a knockout card (only while the analysis is open).
function catClass(matchNo: number): string {
  if (!analysisOpen.value || !bracketAnalysis.value) return ''
  const c = bracketAnalysis.value.catByMatch[matchNo]
  return c ? `cat-${c}` : ''
}

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
// Re-sort only the thirds list by the active basis (3rd-placed team's strength),
// leaving group orders and knockout picks untouched.
function resetThirds() {
  if (!data.value) return
  thirdsRank.value = data.value.groups
    .map((g) => g.group)
    .sort((a, b) => strengthOf(order.value[b][2]) - strengthOf(order.value[a][2]))
}

// --- drag & drop reordering (group lists + the thirds list) ------------------
type DragKind = 'group' | 'thirds'
const drag = ref<{ kind: DragKind; group: string; index: number } | null>(null)
const dragOver = ref<string | null>(null) // `${kind}:${group}:${index}` being hovered

function moveIn(arr: string[], from: number, to: number): string[] {
  const a = [...arr]
  const [item] = a.splice(from, 1)
  a.splice(to, 0, item)
  return a
}
function onDragStart(kind: DragKind, group: string, index: number, e: DragEvent) {
  drag.value = { kind, group, index }
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index)) // Firefox needs payload
  }
}
function onDragOver(kind: DragKind, group: string, index: number, e: DragEvent) {
  const d = drag.value
  if (!d || d.kind !== kind || (kind === 'group' && d.group !== group)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOver.value = `${kind}:${group}:${index}`
}
function onDrop(kind: DragKind, group: string, index: number) {
  const d = drag.value
  dragOver.value = null
  drag.value = null
  if (!d || d.kind !== kind) return
  if (kind === 'group') {
    if (d.group !== group || d.index === index) return
    order.value = { ...order.value, [group]: moveIn(order.value[group], d.index, index) }
  } else {
    if (d.index === index) return
    thirdsRank.value = moveIn(thirdsRank.value, d.index, index)
  }
}
function onDragEnd() {
  drag.value = null
  dragOver.value = null
}
const isDragging = (kind: DragKind, group: string, i: number) =>
  drag.value?.kind === kind && drag.value.group === group && drag.value.index === i
const isDropping = (kind: DragKind, group: string, i: number) =>
  dragOver.value === `${kind}:${group}:${i}`

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

// Short origin tag for a Round-of-32 slot: group winner E1, runner-up F2,
// or the third-placed team's allocated group G3. Empty for later rounds.
function slotOrigin(matchNo: number, key: 'team1' | 'team2'): string {
  const m = byMatchNo.value.get(matchNo)
  if (!m) return ''
  const desc = key === 'team1' ? m.team1_desc : m.team2_desc
  let mm = /^Winner Group ([A-L])$/.exec(desc)
  if (mm) return `${mm[1]}1`
  mm = /^Runner-up Group ([A-L])$/.exec(desc)
  if (mm) return `${mm[1]}2`
  if (/^3rd Group/.test(desc)) {
    const g = thirdAlloc.value[`${matchNo}-${key}`]
    return g ? `${g}3` : '3rd'
  }
  return ''
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
        <button class="reset" @click="tweak">🔀 Tweak</button>
        <button class="reset" @click="randomize">🎲 Random</button>
        <button class="reset" @click="makeShareLink">🔗 Share</button>
        <button class="reset" @click="generateImage">🖼 Image</button>
        <button class="reset" @click="seed">↺ Reset</button>
      </div>

      <div v-if="shareUrl" class="sharebox">
        <input class="shareinput" type="text" :value="shareUrl" readonly @focus="($event.target as HTMLInputElement).select()" />
        <span class="sharemsg">{{ copied ? '✓ Copied to clipboard' : 'Copy this link to share your prediction' }}</span>
      </div>
      <p v-if="imageError" class="status error">{{ imageError }}</p>

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
              draggable="true"
              :class="{
                q: i < 2,
                third: i === 2,
                out: i === 3,
                dragging: isDragging('group', g, i),
                dropping: isDropping('group', g, i),
              }"
              @dragstart="onDragStart('group', g, i, $event)"
              @dragover="onDragOver('group', g, i, $event)"
              @drop.prevent="onDrop('group', g, i)"
              @dragend="onDragEnd"
            >
              <span class="handle" aria-hidden="true">⠿</span>
              <span class="rank">{{ posLabel(i) }}</span>
              <img
                v-if="flagUrl(team)"
                class="flag"
                :src="flagUrl(team)!"
                :alt="team"
                draggable="false"
              />
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
      <div class="subhead">
        <h3>
          Best third-placed teams — top {{ QUALIFYING_THIRDS }} of {{ thirdsList.length }} advance
        </h3>
        <button class="reset reset-sm" @click="resetThirds">↺ Reset order</button>
      </div>
      <ol class="thirds">
        <li
          v-for="(t, i) in thirdsList"
          :key="t.group"
          draggable="true"
          :class="{
            q: t.qualifies,
            cut: i === QUALIFYING_THIRDS - 1,
            dragging: isDragging('thirds', '', i),
            dropping: isDropping('thirds', '', i),
          }"
          @dragstart="onDragStart('thirds', '', i, $event)"
          @dragover="onDragOver('thirds', '', i, $event)"
          @drop.prevent="onDrop('thirds', '', i)"
          @dragend="onDragEnd"
        >
          <span class="handle" aria-hidden="true">⠿</span>
          <span class="rank">{{ i + 1 }}</span>
          <span class="gtag">{{ t.group }}</span>
          <img
            v-if="flagUrl(t.team)"
            class="flag"
            :src="flagUrl(t.team)!"
            :alt="t.team"
            draggable="false"
          />
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
            :class="[{ third: c.isThird }, catClass(c.m.match_no)]"
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
                <span
                  v-if="slotOrigin(c.m.match_no, key as 'team1' | 'team2')"
                  class="origin"
                >{{ slotOrigin(c.m.match_no, key as 'team1' | 'team2') }}</span>
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

      <!-- ===================== BRACKET ANALYSIS ===================== -->
      <div class="analysis-bar">
        <button class="reset" :class="{ on: analysisOpen }" @click="analysisOpen = !analysisOpen">
          {{ analysisOpen ? '▲ Hide bracket analysis' : '▼ Show bracket analysis' }}
        </button>
      </div>

      <section v-if="analysisOpen && bracketAnalysis" class="analysis">
        <p class="hint">
          A “bracket” is the four teams in two Round-of-32 ties feeding one Round-of-16 match —
          the winner reaches the quarter-final. Strength uses {{ BASIS_LABEL[basis] }}. Matching
          colours are shown on the bracket above.
        </p>

        <div class="acards">
          <div v-if="bracketAnalysis.easiest" class="acard">
            <span class="atag easy">Easiest</span>
            <div class="aflags">
              <img
                v-for="t in bracketAnalysis.easiest.teams"
                :key="t.name"
                class="flag"
                :class="{ fav: t.name === bracketAnalysis.easiest.favorite }"
                :src="flagUrl(t.name) || ''"
                :alt="t.name"
                :title="t.name"
              />
            </div>
            <p>
              <strong>{{ bracketAnalysis.easiest.favorite }}</strong> towers over the other
              three — a clear run to the quarter-final.
            </p>
          </div>

          <div v-if="bracketAnalysis.competitive" class="acard">
            <span class="atag comp">Most competitive</span>
            <div class="aflags">
              <img
                v-for="t in bracketAnalysis.competitive.teams"
                :key="t.name"
                class="flag"
                :src="flagUrl(t.name) || ''"
                :alt="t.name"
                :title="t.name"
              />
            </div>
            <p>Four closely-matched sides — no clear favourite for the quarter-final spot.</p>
          </div>

          <div v-if="bracketAnalysis.strongest" class="acard">
            <span class="atag strong">Strongest</span>
            <div class="aflags">
              <img
                v-for="t in bracketAnalysis.strongest.teams"
                :key="t.name"
                class="flag"
                :src="flagUrl(t.name) || ''"
                :alt="t.name"
                :title="t.name"
              />
            </div>
            <p>Highest combined strength — the toughest four-team group to come through.</p>
          </div>

          <div v-if="bracketAnalysis.weakest" class="acard">
            <span class="atag weak">Weakest</span>
            <div class="aflags">
              <img
                v-for="t in bracketAnalysis.weakest.teams"
                :key="t.name"
                class="flag"
                :src="flagUrl(t.name) || ''"
                :alt="t.name"
                :title="t.name"
              />
            </div>
            <p>Lowest combined strength — the most winnable path to the quarter-final.</p>
          </div>
        </div>

        <ul class="alist">
          <li v-for="b in bracketAnalysis.brackets" :key="b.r16">
            <span
              class="cdot"
              :class="bracketAnalysis.catByMatch[b.r16] ? 'cat-' + bracketAnalysis.catByMatch[b.r16] : ''"
            />
            <span class="aflags sm">
              <img
                v-for="t in b.teams"
                :key="t.name"
                class="flag"
                :class="{ fav: t.name === b.favorite }"
                :src="flagUrl(t.name) || ''"
                :alt="t.name"
                :title="`${t.name} · ${seedVal(t.name)}`"
              />
            </span>
            <span class="afav">→ {{ b.favorite }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 100%;
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
@media (max-width: 640px) {
  .sub {
    max-width: none;
  }
  .topbar {
    gap: 0.5rem;
  }
  .basis {
    margin-left: 0;
  }
  .champ {
    flex: 1 1 100%;
  }
}
.sharebox {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin: -0.5rem 0 1rem;
}
.shareinput {
  flex: 1;
  min-width: 240px;
  max-width: 560px;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.82rem;
  color: #374151;
  background: #f9fafb;
}
.sharemsg {
  font-size: 0.78rem;
  color: #16a34a;
  font-weight: 600;
}
.section {
  margin: 1.5rem 0 0.75rem;
  font-size: 1.1rem;
}
.subhead {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin: 1.5rem 0 0.75rem;
}
.subhead h3 {
  margin: 0;
  font-size: 1.1rem;
}
.reset-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.78rem;
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
  cursor: grab;
  user-select: none;
}
.gcard li:active,
.thirds li:active {
  cursor: grabbing;
}
.gcard li.dragging,
.thirds li.dragging {
  opacity: 0.4;
}
.gcard li.dropping,
.thirds li.dropping {
  box-shadow: inset 0 2px 0 #2563eb;
}
.handle {
  flex: none;
  color: #cbd5e1;
  font-size: 0.9rem;
  line-height: 1;
  cursor: grab;
}
.gcard li:hover .handle,
.thirds li:hover .handle {
  color: #9ca3af;
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
  -webkit-overflow-scrolling: touch;
  width: 100%;
  min-width: 0;
  max-width: 100%;
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
.match.cat-easy {
  border-left: 4px solid #f59e0b;
}
.match.cat-comp {
  border-left: 4px solid #2563eb;
}
.match.cat-weak {
  border-left: 4px solid #64748b;
}
.match.cat-strong {
  border-left: 4px solid #7c3aed;
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
.slot .origin {
  flex: none;
  font-size: 0.6rem;
  font-weight: 700;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 4px;
  padding: 0.05rem 0.2rem;
  min-width: 1.45rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.slot.win .origin {
  background: #bbf7d0;
  color: #166534;
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

/* bracket analysis */
.analysis-bar {
  margin: 1rem 0 0;
}
.analysis {
  margin-top: 0.75rem;
}
.acards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.acard {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 0.8rem 0.9rem;
}
.acard p {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: #374151;
  line-height: 1.35;
}
.atag {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  color: #fff;
}
.atag.easy {
  background: #f59e0b;
}
.atag.comp {
  background: #2563eb;
}
.atag.weak {
  background: #64748b;
}
.atag.strong {
  background: #7c3aed;
}
.aflags {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.55rem;
  flex-wrap: wrap;
}
.aflags.sm {
  margin-top: 0;
}
.aflags .flag {
  width: 30px;
  height: auto;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
}
.aflags.sm .flag {
  width: 24px;
}
.aflags .flag.fav {
  outline: 2px solid #f59e0b;
  outline-offset: 1px;
}
.alist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.4rem 1rem;
}
.alist li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cdot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #e5e7eb;
}
.cdot.cat-easy {
  background: #f59e0b;
}
.cdot.cat-comp {
  background: #2563eb;
}
.cdot.cat-weak {
  background: #64748b;
}
.cdot.cat-strong {
  background: #7c3aed;
}
.afav {
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
