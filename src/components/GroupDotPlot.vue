<script setup lang="ts">
import { computed } from 'vue'
import { scaleLinear } from 'd3-scale'
import type { Group, Team } from '../types'
import type { Metric } from '../metrics'
import { confColor, flagUrl, teamCode } from '../flags'

const props = defineProps<{
  groups: Group[]
  metric: Metric
}>()

const emit = defineEmits<{ select: [Team] }>()

// Layout constants
const ROW_H = 56
const MARGIN = { top: 38, right: 74, bottom: 10, left: 56 }
const PLOT_W = 760
const width = MARGIN.left + PLOT_W + MARGIN.right
const FW = 26 // flag width
const FH = 18 // flag height
const LABEL_DY = FH / 2 + 14 // label baseline below the flag
const LABEL_GAP = 30 // min horizontal spacing between labels

const fmt = (n: number) => (props.metric.format ? props.metric.format(n) : String(n))
const abbr = (name: string) => teamCode(name)

interface Dot {
  team: string
  conf: string
  raw: number
  x: number // true position on the line
  labelX: number // de-overlapped label position
  flag: string | null
  data: Team
}
interface Row {
  group: string
  y: number
  dots: Dot[]
  avg: number | null // mean metric value across the group's teams
  avgX: number | null
}

/** Spread label x-positions so they keep a minimum gap, staying within [lo, hi]. */
function dodge(xs: number[], minGap: number, lo: number, hi: number): number[] {
  const n = xs.length
  if (n === 0) return []
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x)
  const placed = order.map((o) => o.x)
  for (let k = 1; k < n; k++)
    if (placed[k] < placed[k - 1] + minGap) placed[k] = placed[k - 1] + minGap
  if (placed[n - 1] > hi) {
    const shift = placed[n - 1] - hi
    for (let k = 0; k < n; k++) placed[k] -= shift
    for (let k = n - 2; k >= 0; k--)
      if (placed[k] > placed[k + 1] - minGap) placed[k] = placed[k + 1] - minGap
  }
  if (placed[0] < lo) {
    placed[0] = lo
    for (let k = 1; k < n; k++)
      if (placed[k] < placed[k - 1] + minGap) placed[k] = placed[k - 1] + minGap
  }
  const out = new Array<number>(n)
  order.forEach((o, k) => {
    out[o.i] = placed[k]
  })
  return out
}

const model = computed(() => {
  // Shared domain across ALL teams so group lines are comparable.
  const all: number[] = []
  for (const g of props.groups)
    for (const t of g.teams) {
      const v = props.metric.value(t)
      if (v != null) all.push(v)
    }
  const min = all.length ? Math.min(...all) : 0
  const max = all.length ? Math.max(...all) : 1
  const pad = (max - min) * 0.05 || 1
  const domain: [number, number] = [min - pad, max + pad]
  const x = scaleLinear()
    .domain(props.metric.lowerIsBetter ? [domain[1], domain[0]] : domain)
    .range([0, PLOT_W])

  const rows: Row[] = props.groups.map((g, i) => {
    const base = g.teams
      .map((t) => {
        const raw = props.metric.value(t)
        return raw == null
          ? null
          : { team: t.team, conf: t.confederation, raw, x: x(raw), flag: flagUrl(t.team), data: t }
      })
      .filter((d): d is Omit<Dot, 'labelX'> => d != null)
    const labelXs = dodge(
      base.map((d) => d.x),
      LABEL_GAP,
      LABEL_GAP / 2,
      PLOT_W - LABEL_GAP / 2,
    )
    const avg = base.length
      ? base.reduce((s, d) => s + d.raw, 0) / base.length
      : null
    return {
      group: g.group,
      y: MARGIN.top + i * ROW_H,
      dots: base.map((d, k) => ({ ...d, labelX: labelXs[k] })),
      avg,
      avgX: avg == null ? null : x(avg),
    }
  })

  const ticks = x.ticks(6).map((t) => ({ x: x(t), label: fmt(t) }))
  const height = MARGIN.top + props.groups.length * ROW_H + MARGIN.bottom
  return { rows, ticks, height }
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${model.height}`"
    :width="width"
    :height="model.height"
    class="dotplot"
    role="img"
    :aria-label="`Group dot plot by ${metric.label}`"
  >
    <!-- axis ticks -->
    <g class="axis">
      <text
        v-for="t in model.ticks"
        :key="`t-${t.label}`"
        :x="MARGIN.left + t.x"
        :y="MARGIN.top - 22"
        text-anchor="middle"
      >
        {{ t.label }}
      </text>
    </g>
    <!-- group-average column header -->
    <text class="col-head" :x="MARGIN.left + PLOT_W + 8" :y="MARGIN.top - 22">
      group avg
    </text>

    <!-- one row per group -->
    <g v-for="row in model.rows" :key="row.group" :transform="`translate(0,${row.y})`">
      <text class="group-label" :x="MARGIN.left - 18" y="4" text-anchor="end">
        {{ row.group }}
      </text>
      <line
        class="group-line"
        :x1="MARGIN.left"
        :x2="MARGIN.left + PLOT_W"
        y1="0"
        y2="0"
      />
      <!-- group average: vertical tick on the line + value in the right column -->
      <line
        v-if="row.avgX != null"
        class="avg-tick"
        :x1="MARGIN.left + row.avgX"
        :x2="MARGIN.left + row.avgX"
        y1="-12"
        y2="12"
      />
      <text
        v-if="row.avg != null"
        class="avg-value"
        :x="MARGIN.left + PLOT_W + 8"
        y="4"
      >
        {{ fmt(row.avg) }}
      </text>
      <g
        v-for="d in row.dots"
        :key="d.team"
        class="dot"
        tabindex="0"
        role="button"
        :aria-label="`${d.team}: show squad`"
        @click="emit('select', d.data)"
        @keydown.enter.prevent="emit('select', d.data)"
        @keydown.space.prevent="emit('select', d.data)"
      >
        <title>{{ d.team }} ({{ d.conf }}) — {{ fmt(d.raw) }}{{ metric.unit ? ' ' + metric.unit : '' }}</title>
        <!-- connector from flag to displaced label -->
        <line
          v-if="Math.abs(d.labelX - d.x) > 1"
          class="connector"
          :x1="MARGIN.left + d.x"
          :y1="FH / 2"
          :x2="MARGIN.left + d.labelX"
          :y2="LABEL_DY - 9"
        />
        <!-- flag marker with confederation-colored border -->
        <image
          v-if="d.flag"
          :href="d.flag"
          :x="MARGIN.left + d.x - FW / 2"
          :y="-FH / 2"
          :width="FW"
          :height="FH"
          preserveAspectRatio="xMidYMid slice"
        />
        <rect
          class="flag-border"
          :x="MARGIN.left + d.x - FW / 2"
          :y="-FH / 2"
          :width="FW"
          :height="FH"
          rx="3"
          :stroke="confColor(d.conf)"
          :fill="d.flag ? 'none' : confColor(d.conf)"
        />
        <text
          class="dot-label"
          :x="MARGIN.left + d.labelX"
          :y="LABEL_DY"
          text-anchor="middle"
          :fill="confColor(d.conf)"
        >
          {{ abbr(d.team) }}
        </text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.dotplot {
  max-width: 100%;
  height: auto;
  font-family: system-ui, sans-serif;
}
.axis text {
  font-size: 11px;
  fill: #6b7280;
}
.group-label {
  font-size: 14px;
  font-weight: 700;
  fill: #111827;
}
.group-line {
  stroke: #e5e7eb;
  stroke-width: 2;
}
.avg-tick {
  stroke: #111827;
  stroke-width: 2;
  stroke-dasharray: 2 2;
}
.avg-value {
  font-size: 12px;
  font-weight: 700;
  fill: #111827;
}
.col-head {
  font-size: 10px;
  font-weight: 600;
  fill: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dot {
  cursor: pointer;
}
.dot:focus {
  outline: none;
}
.dot:focus .flag-border {
  stroke-width: 3;
}
.dot image,
.dot rect {
  transition: x 0.5s ease;
}
.dot text {
  transition: x 0.5s ease;
}
.flag-border {
  stroke-width: 2;
  fill-opacity: 0.9;
}
.connector {
  stroke: #cbd5e1;
  stroke-width: 1;
}
.dot-label {
  font-size: 10px;
  font-weight: 700;
  pointer-events: none;
}
.dot:hover .flag-border {
  stroke-width: 3;
}
</style>
