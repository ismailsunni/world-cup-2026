<script setup lang="ts">
import { computed } from 'vue'
import { scaleLinear } from 'd3-scale'
import type { Group } from '../types'
import type { Metric } from '../metrics'

const props = defineProps<{
  groups: Group[]
  metric: Metric
}>()

// Layout constants
const ROW_H = 44
const MARGIN = { top: 28, right: 32, bottom: 8, left: 56 }
const PLOT_W = 760
const width = MARGIN.left + PLOT_W + MARGIN.right

const fmt = (n: number) => (props.metric.format ? props.metric.format(n) : String(n))
const abbr = (name: string) => name.slice(0, 3).toUpperCase()

interface Dot {
  team: string
  raw: number
  x: number
}
interface Row {
  group: string
  y: number
  dots: Dot[]
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

  // lowerIsBetter metrics read left=best by inverting the range visually.
  const domain: [number, number] = [min - pad, max + pad]
  const x = scaleLinear()
    .domain(props.metric.lowerIsBetter ? [domain[1], domain[0]] : domain)
    .range([0, PLOT_W])

  const rows: Row[] = props.groups.map((g, i) => ({
    group: g.group,
    y: MARGIN.top + i * ROW_H,
    dots: g.teams
      .map((t) => {
        const raw = props.metric.value(t)
        return raw == null ? null : { team: t.team, raw, x: x(raw) }
      })
      .filter((d): d is Dot => d != null),
  }))

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
        :y="MARGIN.top - 12"
        text-anchor="middle"
      >
        {{ t.label }}
      </text>
    </g>

    <!-- one row per group -->
    <g v-for="row in model.rows" :key="row.group" :transform="`translate(0,${row.y})`">
      <text class="group-label" :x="MARGIN.left - 16" y="4" text-anchor="end">
        {{ row.group }}
      </text>
      <line
        class="group-line"
        :x1="MARGIN.left"
        :x2="MARGIN.left + PLOT_W"
        y1="0"
        y2="0"
      />
      <g
        v-for="d in row.dots"
        :key="d.team"
        class="dot"
        :transform="`translate(${MARGIN.left + d.x},0)`"
      >
        <title>{{ d.team }} — {{ fmt(d.raw) }}{{ metric.unit ? ' ' + metric.unit : '' }}</title>
        <circle r="7" />
        <text class="dot-label" y="-12" text-anchor="middle">{{ abbr(d.team) }}</text>
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
.dot circle {
  fill: #2563eb;
  fill-opacity: 0.85;
  stroke: #fff;
  stroke-width: 1.5;
  /* animate repositioning when the metric changes */
  transition: transform 0.5s ease;
}
.dot {
  transition: transform 0.5s ease;
}
.dot-label {
  font-size: 10px;
  fill: #374151;
  pointer-events: none;
}
.dot:hover circle {
  fill: #1d4ed8;
  r: 9;
}
</style>
