import type { Group } from './types'
import type { Metric } from './metrics'

/**
 * Per-group shape statistics for one metric. A group's 4 team values are sorted
 * and the gaps between consecutive values examined. One gap "dominating" the
 * others reveals the group's shape:
 *   - dominant gap at an END  → one-sided (one team far ahead / adrift)
 *   - dominant gap in the MIDDLE → a clean top-2 / bottom-2 split
 *   - no dominant gap + small spread → competitive (everyone close)
 *
 * `dominance = (largestGap - secondLargestGap) / range` measures how much the
 * single biggest gap stands out, so a group only qualifies when one gap clearly
 * dominates — not merely when it happens to be the largest.
 */
export interface GroupStat {
  group: string
  n: number
  min: number
  max: number
  range: number
  stdev: number
  dominance: number
  category: 'one-sided' | 'split'
  /** One-sided only: the isolated team and which end it sits at. */
  outlierTeam: string
  outlierKind: 'leader' | 'trailer'
  outlierGap: number
  /** Split only: the gap separating the top two from the bottom two. */
  midGap: number
}

export interface GroupInsights {
  oneSided: GroupStat[]
  split: GroupStat[]
  competitive: GroupStat[]
}

// A gap must beat the next-biggest by at least this share of the range to count
// as "dominant" — keeps gradients (no clear break) out of either category.
const DOMINANCE_MIN = 0.4
// Groups within this multiple of the tightest stdev are all "most competitive".
const COMPETITIVE_MARGIN = 1.15

function stdev(xs: number[], mean: number): number {
  if (xs.length < 2) return 0
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
}

function statForGroup(g: Group, metric: Metric): GroupStat | null {
  const vt = g.teams
    .map((t) => ({ team: t.team, v: metric.value(t) }))
    .filter((d): d is { team: string; v: number } => d.v != null)
    .sort((a, b) => a.v - b.v) // ascending raw value
  const n = vt.length
  if (n < 3) return null

  const values = vt.map((d) => d.v)
  const mean = values.reduce((a, b) => a + b, 0) / n
  const min = values[0]
  const max = values[n - 1]
  const range = max - min

  const gaps = values.slice(1).map((v, i) => v - values[i])
  let maxIdx = 0
  for (let i = 1; i < gaps.length; i++) if (gaps[i] > gaps[maxIdx]) maxIdx = i
  const maxGap = gaps[maxIdx]
  const secondGap = Math.max(...gaps.filter((_, i) => i !== maxIdx), 0)
  const dominance = range > 0 ? (maxGap - secondGap) / range : 0

  const midIdx = Math.floor((gaps.length - 1) / 2)
  const isMiddle = maxIdx !== 0 && maxIdx !== gaps.length - 1
  const lower = !!metric.lowerIsBetter

  // The isolated team for one-sided groups: at the high end it's the top raw
  // value, at the low end the bottom raw value. Quality depends on direction.
  const atHighEnd = maxIdx === gaps.length - 1
  const outlierTeam = atHighEnd ? vt[n - 1].team : vt[0].team
  const outlierKind: 'leader' | 'trailer' = atHighEnd
    ? lower
      ? 'trailer'
      : 'leader'
    : lower
      ? 'leader'
      : 'trailer'

  return {
    group: g.group,
    n,
    min,
    max,
    range,
    stdev: stdev(values, mean),
    dominance,
    category: isMiddle ? 'split' : 'one-sided',
    outlierTeam,
    outlierKind,
    outlierGap: maxGap,
    midGap: gaps[midIdx],
  }
}

export function computeGroupInsights(groups: Group[], metric: Metric): GroupInsights {
  const stats = groups
    .map((g) => statForGroup(g, metric))
    .filter((s): s is GroupStat => s != null)

  const byDominance = (a: GroupStat, b: GroupStat) => b.dominance - a.dominance
  const minStdev = stats.length ? Math.min(...stats.map((s) => s.stdev)) : 0

  return {
    oneSided: stats
      .filter((s) => s.category === 'one-sided' && s.dominance >= DOMINANCE_MIN)
      .sort(byDominance),
    split: stats
      .filter((s) => s.category === 'split' && s.dominance >= DOMINANCE_MIN)
      .sort(byDominance),
    competitive: stats
      .filter((s) => s.stdev <= minStdev * COMPETITIVE_MARGIN)
      .sort((a, b) => a.stdev - b.stdev),
  }
}
