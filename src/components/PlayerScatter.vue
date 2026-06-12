<script setup lang="ts">
import { computed } from 'vue'
import { scaleLinear } from 'd3-scale'
import type { PlayerPoint } from '../players'
import { posColor, teamCode } from '../flags'

const props = defineProps<{
  // Dots to draw (already filtered by the parent).
  points: PlayerPoint[]
  // Full set used to fix the axis domain so it stays stable while filtering.
  domainPoints: PlayerPoint[]
  selected?: PlayerPoint | null
  // When true, captains get a dark halo ring so they stand out.
  markCaptains?: boolean
}>()

const emit = defineEmits<{ select: [PlayerPoint] }>()

// Layout constants
const MARGIN = { top: 16, right: 18, bottom: 46, left: 56 }
const PLOT_W = 720
const PLOT_H = 440
const width = MARGIN.left + PLOT_W + MARGIN.right
const height = MARGIN.top + PLOT_H + MARGIN.bottom

const X = (p: PlayerPoint) => p.age
const Y = (p: PlayerPoint) => p.caps

function extent(vals: number[], fallback: [number, number]): [number, number] {
  if (!vals.length) return fallback
  return [Math.min(...vals), Math.max(...vals)]
}

const model = computed(() => {
  const ages = props.domainPoints.map(X).filter((v): v is number => v != null)
  const caps = props.domainPoints.map(Y).filter((v): v is number => v != null)
  const [axMin, axMax] = extent(ages, [17, 43])
  const [cyMin, cyMax] = extent(caps, [0, 1])
  const xPad = (axMax - axMin) * 0.04 || 1

  const x = scaleLinear()
    .domain([axMin - xPad, axMax + xPad])
    .range([0, PLOT_W])
  const y = scaleLinear()
    .domain([0, cyMax * 1.04 || 1])
    .range([PLOT_H, 0])
  void cyMin

  const dots = props.points
    .filter((p) => p.age != null && p.caps != null)
    .map((p) => ({
      cx: MARGIN.left + x(p.age as number),
      cy: MARGIN.top + y(p.caps as number),
      color: posColor(p.position),
      data: p,
    }))

  const xTicks = x.ticks(8).map((t) => ({ x: MARGIN.left + x(t), label: String(t) }))
  const yTicks = y.ticks(6).map((t) => ({ y: MARGIN.top + y(t), label: String(t) }))
  return { dots, xTicks, yTicks }
})

const isSelected = (p: PlayerPoint) =>
  !!props.selected &&
  props.selected.name === p.name &&
  props.selected.team === p.team
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    class="scatter"
    role="img"
    aria-label="Player scatter plot: caps versus age, colored by position"
  >
    <!-- gridlines + axes -->
    <g class="grid">
      <line
        v-for="t in model.yTicks"
        :key="`gy-${t.label}`"
        :x1="MARGIN.left"
        :x2="MARGIN.left + PLOT_W"
        :y1="t.y"
        :y2="t.y"
      />
      <line
        v-for="t in model.xTicks"
        :key="`gx-${t.label}`"
        :x1="t.x"
        :x2="t.x"
        :y1="MARGIN.top"
        :y2="MARGIN.top + PLOT_H"
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
      <text
        v-for="t in model.xTicks"
        :key="`x-${t.label}`"
        :x="t.x"
        :y="MARGIN.top + PLOT_H + 20"
        text-anchor="middle"
      >
        {{ t.label }}
      </text>
    </g>

    <!-- axis titles -->
    <text
      class="axis-title"
      :x="MARGIN.left + PLOT_W / 2"
      :y="height - 6"
      text-anchor="middle"
    >
      Age (years)
    </text>
    <text
      class="axis-title"
      :transform="`translate(14,${MARGIN.top + PLOT_H / 2}) rotate(-90)`"
      text-anchor="middle"
    >
      Caps (international appearances)
    </text>

    <!-- dots -->
    <g
      v-for="(d, i) in model.dots"
      :key="`${d.data.team}-${d.data.name}-${i}`"
      class="dot"
      :class="{ sel: isSelected(d.data) }"
      tabindex="0"
      role="button"
      :aria-label="`${d.data.name}, ${d.data.team}: ${d.data.caps} caps at age ${d.data.age}`"
      @click="emit('select', d.data)"
      @keydown.enter.prevent="emit('select', d.data)"
      @keydown.space.prevent="emit('select', d.data)"
    >
      <title>
        {{ d.data.name }}{{ d.data.captain ? ' (captain)' : '' }} ({{ teamCode(d.data.team) }}) ·
        {{ d.data.position }} · {{ d.data.age }} yrs · {{ d.data.caps }} caps
      </title>
      <!-- captain halo -->
      <circle
        v-if="markCaptains && d.data.captain"
        class="halo"
        :cx="d.cx"
        :cy="d.cy"
        :r="isSelected(d.data) ? 10 : 7.5"
        fill="none"
        stroke="#111827"
        stroke-width="1.5"
      />
      <circle
        :cx="d.cx"
        :cy="d.cy"
        :r="isSelected(d.data) ? 7 : 4.5"
        :fill="d.color"
        :stroke="isSelected(d.data) ? '#111827' : '#fff'"
        :stroke-width="isSelected(d.data) ? 2 : 1"
      />
    </g>
  </svg>
</template>

<style scoped>
.scatter {
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
.axis-title {
  font-size: 12px;
  font-weight: 600;
  fill: #374151;
}
.dot {
  cursor: pointer;
}
.dot circle {
  fill-opacity: 0.72;
  transition: r 0.12s ease;
}
.dot .halo {
  fill-opacity: 0;
  pointer-events: none;
}
.dot:hover circle:not(.halo) {
  fill-opacity: 1;
  r: 7;
}
.dot:focus {
  outline: none;
}
.dot:focus circle:not(.halo) {
  stroke: #111827;
  stroke-width: 2;
}
.dot.sel circle {
  fill-opacity: 1;
}
</style>
