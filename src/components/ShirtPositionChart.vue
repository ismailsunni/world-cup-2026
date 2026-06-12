<script setup lang="ts">
import { computed } from 'vue'
import { scaleBand, scaleLinear } from 'd3-scale'
import type { PlayerPoint } from '../players'
import { posColor } from '../flags'

const props = defineProps<{
  points: PlayerPoint[]
  // Full set used to fix the x axis (shirt numbers) so empty columns still show.
  domainPoints: PlayerPoint[]
  // 'count' = absolute players; 'percent' = 100%-stacked share per number.
  mode: 'count' | 'percent'
  // Positions to stack (and their bottom-to-top order). Hidden ones are dropped.
  positions: string[]
  // Currently selected shirt number (its column is highlighted).
  selected?: number | null
}>()

const emit = defineEmits<{ select: [number] }>()

// Layout constants
const MARGIN = { top: 16, right: 18, bottom: 46, left: 52 }
const PLOT_W = 720
const PLOT_H = 420
const width = MARGIN.left + PLOT_W + MARGIN.right
const height = MARGIN.top + PLOT_H + MARGIN.bottom

const model = computed(() => {
  // All shirt numbers across the full dataset, ascending — kept on the axis even
  // when the active filter leaves some of them with no players (empty columns).
  const numbers = [
    ...new Set(
      props.domainPoints
        .map((p) => p.shirt_number)
        .filter((n): n is number => n != null),
    ),
  ].sort((a, b) => a - b)

  // counts[number][position]
  const counts = new Map<number, Record<string, number>>()
  for (const p of props.points) {
    if (p.shirt_number == null) continue
    if (!props.positions.includes(p.position)) continue
    const row = counts.get(p.shirt_number) ?? {}
    row[p.position] = (row[p.position] ?? 0) + 1
    counts.set(p.shirt_number, row)
  }

  const totals = numbers.map((n) =>
    props.positions.reduce((s, pos) => s + (counts.get(n)?.[pos] ?? 0), 0),
  )
  const maxTotal = Math.max(1, ...totals)

  const x = scaleBand<number>()
    .domain(numbers)
    .range([0, PLOT_W])
    .paddingInner(0.18)
    .paddingOuter(0.1)
  const y = scaleLinear()
    .domain([0, props.mode === 'percent' ? 100 : maxTotal])
    .range([PLOT_H, 0])

  const bw = x.bandwidth()
  const cols = numbers.map((n, i) => {
    const row = counts.get(n) ?? {}
    const total = totals[i] || 0
    let acc = 0 // running value from the bottom up
    const segs = props.positions
      .map((pos) => {
        const c = row[pos] ?? 0
        if (c === 0) return null
        const val = props.mode === 'percent' ? (total ? (c / total) * 100 : 0) : c
        const y0 = acc
        acc += val
        const yTop = MARGIN.top + y(acc)
        const yBot = MARGIN.top + y(y0)
        return {
          pos,
          count: c,
          color: posColor(pos),
          x: MARGIN.left + (x(n) ?? 0),
          y: yTop,
          w: bw,
          h: Math.max(0, yBot - yTop),
          pct: total ? Math.round((c / total) * 100) : 0,
        }
      })
      .filter((s): s is NonNullable<typeof s> => s != null)
    const left = MARGIN.left + (x(n) ?? 0)
    return { number: n, left, x: left + bw / 2, w: bw, total, segs }
  })

  const yTicks = y.ticks(props.mode === 'percent' ? 5 : Math.min(maxTotal, 6)).map((t) => ({
    y: MARGIN.top + y(t),
    label: props.mode === 'percent' ? `${t}%` : String(t),
  }))

  return { cols, yTicks }
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    class="bars"
    role="img"
    aria-label="Stacked bar chart of player positions by shirt number"
  >
    <!-- y gridlines + labels -->
    <g class="grid">
      <line
        v-for="t in model.yTicks"
        :key="`g-${t.label}`"
        :x1="MARGIN.left"
        :x2="MARGIN.left + PLOT_W"
        :y1="t.y"
        :y2="t.y"
      />
    </g>
    <g class="axis">
      <text
        v-for="t in model.yTicks"
        :key="`y-${t.label}`"
        :x="MARGIN.left - 8"
        :y="t.y + 4"
        text-anchor="end"
      >
        {{ t.label }}
      </text>
    </g>

    <!-- stacked bars -->
    <g
      v-for="col in model.cols"
      :key="col.number"
      class="col"
      :class="{ sel: selected === col.number }"
      tabindex="0"
      role="button"
      :aria-label="`Shirt number ${col.number}: ${col.total} player${col.total === 1 ? '' : 's'} — show list`"
      @click="emit('select', col.number)"
      @keydown.enter.prevent="emit('select', col.number)"
      @keydown.space.prevent="emit('select', col.number)"
    >
      <!-- full-height hit area so empty columns are clickable too -->
      <rect
        class="hit"
        :x="col.left"
        :y="MARGIN.top"
        :width="col.w"
        :height="PLOT_H"
      />
      <rect
        v-for="seg in col.segs"
        :key="seg.pos"
        class="seg"
        :x="seg.x"
        :y="seg.y"
        :width="seg.w"
        :height="seg.h"
        :fill="seg.color"
      >
        <title>
          #{{ col.number }} · {{ seg.pos }}: {{ seg.count }} player{{ seg.count === 1 ? '' : 's' }}
          ({{ seg.pct }}% of #{{ col.number }})
        </title>
      </rect>
      <text class="xlab" :x="col.x" :y="MARGIN.top + PLOT_H + 18" text-anchor="middle">
        {{ col.number }}
      </text>
    </g>

    <!-- axis titles -->
    <text class="axis-title" :x="MARGIN.left + PLOT_W / 2" :y="height - 4" text-anchor="middle">
      Shirt number
    </text>
    <text
      class="axis-title"
      :transform="`translate(12,${MARGIN.top + PLOT_H / 2}) rotate(-90)`"
      text-anchor="middle"
    >
      {{ mode === 'percent' ? 'Share of players (%)' : 'Players' }}
    </text>
  </svg>
</template>

<style scoped>
.bars {
  max-width: 100%;
  height: auto;
  font-family: system-ui, sans-serif;
}
.grid line {
  stroke: #f1f5f9;
  stroke-width: 1;
}
.axis text {
  font-size: 11px;
  fill: #6b7280;
}
.xlab {
  font-size: 10px;
  fill: #6b7280;
}
.axis-title {
  font-size: 12px;
  font-weight: 600;
  fill: #374151;
}
.col {
  cursor: pointer;
}
.col:focus {
  outline: none;
}
.hit {
  fill: transparent;
}
.col:hover .hit {
  fill: #f3f4f6;
}
.col.sel .hit {
  fill: #eff6ff;
  stroke: #2563eb;
  stroke-width: 1;
}
.col:focus .hit {
  stroke: #93c5fd;
  stroke-width: 2;
}
.col.sel .xlab {
  fill: #2563eb;
  font-weight: 700;
}
.seg {
  stroke: #fff;
  stroke-width: 0.75;
  transition: opacity 0.12s ease;
}
.col:hover .seg {
  opacity: 0.82;
}
</style>
