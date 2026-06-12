import type { Group } from './types'
import type { Metric } from './metrics'

/**
 * Per-group shape statistics for one metric. Each group's 4 team values are
 * sorted; the gaps between consecutive values reveal the group's "shape":
 *   - a small spread  → competitive (everyone close)
 *   - a big gap at an end → one-sided (one team far ahead / adrift)
 *   - a big gap in the middle → a clean top-2 / bottom-2 split
 */
export interface GroupStat {
  group: string
  n: number
  min: number
  max: number
  range: number
  stdev: number
  /** Gap between the best team and the 2nd best (quality-aware). */
  leaderGap: number
  /** Gap between the worst team and the 3rd (quality-aware). */
  trailerGap: number
  /** Gap between the two middle teams — the top-2 / bottom-2 divide. */
  midGap: number
  /** max(leaderGap, trailerGap) / range — how isolated the lone outlier is. */
  oneSidedRatio: number
  /** midGap / range — how clean the 2-2 split is. */
  splitRatio: number
  /** Which end the lone outlier sits at. */
  oneSidedKind: 'leader' | 'trailer'
  bestTeam: string
  worstTeam: string
}

export interface GroupInsights {
  stats: GroupStat[]
  mostCompetitive?: GroupStat
  mostOneSided?: GroupStat
  mostSplit?: GroupStat
}

function stdev(xs: number[], mean: number): number {
  if (xs.length < 2) return 0
  const v = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length
  return Math.sqrt(v)
}

function statForGroup(g: Group, metric: Metric): GroupStat | null {
  const vt = g.teams
    .map((t) => ({ team: t.team, v: metric.value(t) }))
    .filter((d): d is { team: string; v: number } => d.v != null)
    .sort((a, b) => a.v - b.v) // ascending raw value
  const n = vt.length
  if (n < 2) return null

  const values = vt.map((d) => d.v)
  const mean = values.reduce((a, b) => a + b, 0) / n
  const min = values[0]
  const max = values[n - 1]
  const range = max - min

  // Consecutive gaps; for 4 teams: gaps[0]=bottom, gaps[mid]=middle, last=top.
  const gaps = values.slice(1).map((v, i) => v - values[i])
  const lowGap = gaps[0]
  const highGap = gaps[gaps.length - 1]
  const midGap = gaps[Math.floor((gaps.length - 1) / 2)]

  // Quality-aware: lower raw is "better" for rankings.
  const lower = !!metric.lowerIsBetter
  const leaderGap = lower ? lowGap : highGap
  const trailerGap = lower ? highGap : lowGap
  const bestTeam = lower ? vt[0].team : vt[n - 1].team
  const worstTeam = lower ? vt[n - 1].team : vt[0].team

  const safe = (num: number) => (range > 0 ? num / range : 0)
  return {
    group: g.group,
    n,
    min,
    max,
    range,
    stdev: stdev(values, mean),
    leaderGap,
    trailerGap,
    midGap,
    oneSidedRatio: safe(Math.max(leaderGap, trailerGap)),
    splitRatio: safe(midGap),
    oneSidedKind: leaderGap >= trailerGap ? 'leader' : 'trailer',
    bestTeam,
    worstTeam,
  }
}

function argBest<T>(xs: T[], score: (x: T) => number, dir: 'min' | 'max'): T | undefined {
  let best: T | undefined
  let bestScore = dir === 'min' ? Infinity : -Infinity
  for (const x of xs) {
    const s = score(x)
    if ((dir === 'min' && s < bestScore) || (dir === 'max' && s > bestScore)) {
      bestScore = s
      best = x
    }
  }
  return best
}

export function computeGroupInsights(groups: Group[], metric: Metric): GroupInsights {
  const stats = groups
    .map((g) => statForGroup(g, metric))
    .filter((s): s is GroupStat => s != null)

  const withRange = stats.filter((s) => s.range > 0)
  return {
    stats,
    mostCompetitive: argBest(stats, (s) => s.stdev, 'min'),
    mostOneSided: argBest(withRange, (s) => s.oneSidedRatio, 'max'),
    mostSplit: argBest(
      withRange.filter((s) => s.n >= 4),
      (s) => s.splitRatio,
      'max',
    ),
  }
}
