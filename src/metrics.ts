import type { Team } from './types'

export interface Metric {
  id: string
  label: string
  unit?: string
  /** Pure function over a team. Return null when not computable. */
  value: (team: Team) => number | null
  format?: (n: number) => string
  /** When true, a lower raw value is "better" (e.g. FIFA ranking #1). */
  lowerIsBetter?: boolean
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

const ages = (t: Team) => t.squad.map((p) => p.age).filter((a): a is number => a != null)
const caps = (t: Team) => t.squad.map((p) => p.caps).filter((c): c is number => c != null)
const goals = (t: Team) => t.squad.map((p) => p.goals).filter((g): g is number => g != null)

/**
 * The metric registry. To add a metric, append one entry here — no chart changes.
 */
export const METRICS: Metric[] = [
  {
    id: 'avg_age',
    label: 'Average squad age',
    unit: 'yrs',
    value: (t) => mean(ages(t)),
    format: (n) => n.toFixed(1),
  },
  {
    id: 'distinct_clubs',
    label: 'Number of distinct clubs',
    value: (t) => new Set(t.squad.map((p) => p.club)).size,
    format: (n) => String(Math.round(n)),
  },
  {
    id: 'fifa_ranking',
    label: 'FIFA ranking',
    value: (t) => t.fifa_ranking,
    format: (n) => `#${Math.round(n)}`,
    lowerIsBetter: true,
  },
  {
    id: 'elo_rating',
    label: 'Elo rating',
    value: (t) => t.elo_rating,
    format: (n) => String(Math.round(n)),
  },
  {
    id: 'elo_rank',
    label: 'Elo ranking',
    value: (t) => t.elo_rank,
    format: (n) => `#${Math.round(n)}`,
    lowerIsBetter: true,
  },
  {
    id: 'total_caps',
    label: 'Total squad caps',
    value: (t) => sum(caps(t)),
    format: (n) => String(Math.round(n)),
  },
  {
    id: 'total_goals',
    label: 'Total squad goals',
    value: (t) => sum(goals(t)),
    format: (n) => String(Math.round(n)),
  },
]

export const DEFAULT_METRIC = METRICS[0]
