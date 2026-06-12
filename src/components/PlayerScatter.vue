<script setup lang="ts">
import { computed, ref } from 'vue'
import { scaleLinear } from 'd3-scale'
import type { PlayerPoint } from '../players'
import { posColor, teamCode } from '../flags'

const props = defineProps<{
  // Dots to draw (already filtered by the parent).
  points: PlayerPoint[]
  // Full set used to fix the default axis domain.
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
const X0 = MARGIN.left
const X1 = MARGIN.left + PLOT_W
const Y0 = MARGIN.top
const Y1 = MARGIN.top + PLOT_H

const X = (p: PlayerPoint) => p.age
const Y = (p: PlayerPoint) => p.caps

function extent(vals: number[], fallback: [number, number]): [number, number] {
  if (!vals.length) return fallback
  return [Math.min(...vals), Math.max(...vals)]
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Default (full) domain, derived once from the whole dataset.
const fullDomain = computed(() => {
  const ages = props.domainPoints.map(X).filter((v): v is number => v != null)
  const caps = props.domainPoints.map(Y).filter((v): v is number => v != null)
  const [axMin, axMax] = extent(ages, [17, 43])
  const [, cyMax] = extent(caps, [0, 1])
  const xPad = (axMax - axMin) * 0.04 || 1
  return {
    x: [axMin - xPad, axMax + xPad] as [number, number],
    y: [0, cyMax * 1.04 || 1] as [number, number],
  }
})

// Zoom window overrides (data space). null = use full domain.
const xView = ref<[number, number] | null>(null)
const yView = ref<[number, number] | null>(null)
const zoomed = computed(() => xView.value !== null || yView.value !== null)

const model = computed(() => {
  const xDomain = xView.value ?? fullDomain.value.x
  const yDomain = yView.value ?? fullDomain.value.y
  const x = scaleLinear().domain(xDomain).range([0, PLOT_W])
  const y = scaleLinear().domain(yDomain).range([PLOT_H, 0])

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
  return { dots, xTicks, yTicks, x, y, xDomain, yDomain }
})

const isSelected = (p: PlayerPoint) =>
  !!props.selected && props.selected.name === p.name && props.selected.team === p.team

// ---- pointer interaction: drag-to-zoom, wheel-zoom, hover, click-select ----
const svgRef = ref<SVGSVGElement | null>(null)
const dragStart = ref<{ ux: number; uy: number } | null>(null)
const dragCur = ref<{ ux: number; uy: number } | null>(null)
const hovered = ref<{ data: PlayerPoint; x: number; y: number } | null>(null)

function userCoords(e: MouseEvent) {
  const svg = svgRef.value!
  const r = svg.getBoundingClientRect()
  const ux = ((e.clientX - r.left) * width) / r.width
  const uy = ((e.clientY - r.top) * height) / r.height
  return { ux: clamp(ux, X0, X1), uy: clamp(uy, Y0, Y1) }
}

function nearest(ux: number, uy: number) {
  let best: (typeof model.value.dots)[number] | null = null
  let bestD = 14 * 14
  for (const d of model.value.dots) {
    const dd = (d.cx - ux) ** 2 + (d.cy - uy) ** 2
    if (dd < bestD) {
      bestD = dd
      best = d
    }
  }
  return best
}

const dragBox = computed(() => {
  if (!dragStart.value || !dragCur.value) return null
  const a = dragStart.value
  const b = dragCur.value
  return {
    x: Math.min(a.ux, b.ux),
    y: Math.min(a.uy, b.uy),
    w: Math.abs(a.ux - b.ux),
    h: Math.abs(a.uy - b.uy),
  }
})

function onDown(e: MouseEvent) {
  dragStart.value = userCoords(e)
  dragCur.value = dragStart.value
  hovered.value = null
}
function onMove(e: MouseEvent) {
  const p = userCoords(e)
  if (dragStart.value) {
    dragCur.value = p
    return
  }
  const d = nearest(p.ux, p.uy)
  hovered.value = d ? { data: d.data, x: d.cx, y: d.cy } : null
}
function onUp(e: MouseEvent) {
  const a = dragStart.value
  dragStart.value = null
  dragCur.value = null
  if (!a) return
  const b = userCoords(e)
  // Treat a near-stationary press as a click → select the nearest dot.
  if (Math.abs(b.ux - a.ux) < 5 && Math.abs(b.uy - a.uy) < 5) {
    const d = nearest(b.ux, b.uy)
    if (d) emit('select', d.data)
    return
  }
  const { x, y } = model.value
  xView.value = [
    x.invert(Math.min(a.ux, b.ux) - MARGIN.left),
    x.invert(Math.max(a.ux, b.ux) - MARGIN.left),
  ]
  yView.value = [
    y.invert(Math.max(a.uy, b.uy) - MARGIN.top),
    y.invert(Math.min(a.uy, b.uy) - MARGIN.top),
  ]
}
function onLeave() {
  hovered.value = null
  dragStart.value = null
  dragCur.value = null
}
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const p = userCoords(e)
  const { x, y, xDomain, yDomain } = model.value
  const f = e.deltaY < 0 ? 0.8 : 1.25 // in = shrink window, out = grow
  const cx = x.invert(p.ux - MARGIN.left)
  const cy = y.invert(p.uy - MARGIN.top)
  xView.value = [cx - (cx - xDomain[0]) * f, cx + (xDomain[1] - cx) * f]
  yView.value = [cy - (cy - yDomain[0]) * f, cy + (yDomain[1] - cy) * f]
}
function resetView() {
  xView.value = null
  yView.value = null
}

const tipStyle = computed(() =>
  hovered.value
    ? {
        left: `${(hovered.value.x / width) * 100}%`,
        top: `${(hovered.value.y / height) * 100}%`,
      }
    : {},
)
</script>

<template>
  <div class="scatter-wrap">
    <button v-if="zoomed" class="reset-zoom" type="button" @click="resetView">
      ⤢ Reset zoom
    </button>

    <svg
      ref="svgRef"
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      class="scatter"
      role="img"
      aria-label="Player scatter plot: caps versus age, colored by position"
      @mousemove="onMove"
      @mouseleave="onLeave"
      @wheel="onWheel"
      @dblclick="resetView"
    >
      <defs>
        <clipPath id="scatter-clip">
          <rect :x="X0" :y="Y0" :width="PLOT_W" :height="PLOT_H" />
        </clipPath>
      </defs>

      <!-- gridlines -->
      <g class="grid">
        <line
          v-for="t in model.yTicks"
          :key="`gy-${t.label}`"
          class="h"
          :x1="X0"
          :x2="X1"
          :y1="t.y"
          :y2="t.y"
        />
        <line
          v-for="t in model.xTicks"
          :key="`gx-${t.label}`"
          class="v"
          :x1="t.x"
          :x2="t.x"
          :y1="Y0"
          :y2="Y1"
        />
      </g>

      <!-- axis tick labels -->
      <g class="axis">
        <text
          v-for="t in model.yTicks"
          :key="`y-${t.label}`"
          :x="X0 - 8"
          :y="t.y + 4"
          text-anchor="end"
        >
          {{ t.label }}
        </text>
        <text
          v-for="t in model.xTicks"
          :key="`x-${t.label}`"
          :x="t.x"
          :y="Y1 + 20"
          text-anchor="middle"
        >
          {{ t.label }}
        </text>
      </g>

      <!-- axis titles -->
      <text class="axis-title" :x="X0 + PLOT_W / 2" :y="height - 6" text-anchor="middle">
        Age (years)
      </text>
      <text
        class="axis-title"
        :transform="`translate(14,${Y0 + PLOT_H / 2}) rotate(-90)`"
        text-anchor="middle"
      >
        Caps (international appearances)
      </text>

      <!-- dots (clipped to the plot area so zoomed-out points don't spill) -->
      <g clip-path="url(#scatter-clip)">
        <g
          v-for="(d, i) in model.dots"
          :key="`${d.data.team}-${d.data.name}-${i}`"
          class="dot"
          :class="{ sel: isSelected(d.data) }"
          tabindex="0"
          role="button"
          :aria-label="`${d.data.name}, ${d.data.team}: ${d.data.caps} caps at age ${d.data.age}`"
          @keydown.enter.prevent="emit('select', d.data)"
          @keydown.space.prevent="emit('select', d.data)"
        >
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
      </g>

      <!-- drag-zoom selection rectangle -->
      <rect
        v-if="dragBox && (dragBox.w > 2 || dragBox.h > 2)"
        class="zoombox"
        :x="dragBox.x"
        :y="dragBox.y"
        :width="dragBox.w"
        :height="dragBox.h"
      />

      <!-- transparent capture layer for drag/click/hover -->
      <rect
        class="overlay"
        :x="X0"
        :y="Y0"
        :width="PLOT_W"
        :height="PLOT_H"
        @mousedown="onDown"
        @mouseup="onUp"
      />
    </svg>

    <!-- hover tooltip -->
    <div v-if="hovered" class="tip" :style="tipStyle">
      <strong>{{ hovered.data.name }}</strong>
      <span v-if="hovered.data.captain" class="cap">(C)</span><br />
      {{ teamCode(hovered.data.team) }} · {{ hovered.data.position }}<br />
      {{ hovered.data.age }} yrs · {{ hovered.data.caps }} caps
    </div>
  </div>
</template>

<style scoped>
.scatter-wrap {
  position: relative;
  display: block;
}
.scatter {
  max-width: 100%;
  height: auto;
  font-family: system-ui, sans-serif;
  user-select: none;
  touch-action: none;
}
.grid line.h {
  stroke: #d1d5db;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.grid line.v {
  stroke: #f1f5f9;
  stroke-width: 1;
}
.axis text {
  font-size: 11px;
  fill: #4b5563;
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
}
.dot .halo {
  fill-opacity: 0;
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
.overlay {
  fill: transparent;
  cursor: crosshair;
}
.zoombox {
  fill: rgba(37, 99, 235, 0.12);
  stroke: #2563eb;
  stroke-width: 1;
  stroke-dasharray: 4 2;
  pointer-events: none;
}
.reset-zoom {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 0.3rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  color: #374151;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.reset-zoom:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}
.tip {
  position: absolute;
  transform: translate(-50%, -120%);
  pointer-events: none;
  background: #111827;
  color: #fff;
  font-size: 0.72rem;
  line-height: 1.3;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  z-index: 3;
}
.tip .cap {
  color: #fbbf24;
  font-weight: 700;
  margin-left: 0.2rem;
}
</style>
