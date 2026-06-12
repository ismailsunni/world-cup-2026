import type { WorldCup } from './types'
import { posColor } from './flags'

export interface Column {
  key: string
  label: string
  numeric?: boolean
  bool?: boolean
  filter?: boolean // render a dropdown filter for this (enumerable) column
  /** When set, the cell value renders as a chip filled with this color. */
  colorBy?: (value: unknown) => string
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

export const COUNTRY_COLUMNS: Column[] = [
  { key: 'team', label: 'Team' },
  { key: 'group', label: 'Group', filter: true },
  { key: 'confederation', label: 'Confed.', filter: true },
  { key: 'fifa_ranking', label: 'FIFA #', numeric: true },
  { key: 'elo_rank', label: 'Elo #', numeric: true },
  { key: 'elo_rating', label: 'Elo', numeric: true },
  { key: 'pot', label: 'Pot', numeric: true, filter: true },
  { key: 'avg_age', label: 'Avg age', numeric: true },
  { key: 'squad_size', label: 'Squad', numeric: true },
  { key: 'clubs', label: 'Clubs', numeric: true },
  { key: 'wc_appearances_prev', label: 'Prev WCs', numeric: true },
  { key: 'host', label: 'Host', bool: true },
  { key: 'debut', label: 'Debut', bool: true },
  { key: 'coach', label: 'Coach' },
]

export const PLAYER_COLUMNS: Column[] = [
  { key: 'shirt_number', label: '#', numeric: true },
  { key: 'player_name', label: 'Player' },
  { key: 'position', label: 'Pos', filter: true, colorBy: (v) => posColor(String(v)) },
  { key: 'team', label: 'Team', filter: true },
  { key: 'group', label: 'Group', filter: true },
  { key: 'age', label: 'Age', numeric: true },
  { key: 'caps', label: 'Caps', numeric: true },
  { key: 'goals', label: 'Goals', numeric: true },
  { key: 'captain', label: 'Capt.', bool: true },
  { key: 'club', label: 'Club' },
]

export function buildCountryRows(data: WorldCup): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const g of data.groups) {
    for (const t of g.teams) {
      const ages = t.squad.map((p) => p.age).filter((a): a is number => a != null)
      const avg = mean(ages)
      rows.push({
        team: t.team,
        group: g.group,
        confederation: t.confederation,
        fifa_ranking: t.fifa_ranking,
        elo_rank: t.elo_rank,
        elo_rating: t.elo_rating,
        pot: t.pot,
        avg_age: avg == null ? null : Math.round(avg * 10) / 10,
        squad_size: t.squad.length,
        clubs: new Set(t.squad.map((p) => p.club)).size,
        wc_appearances_prev: t.wc_appearances_prev,
        host: t.host,
        debut: t.debut,
        coach: t.coach,
      })
    }
  }
  return rows
}

export function buildPlayerRows(data: WorldCup): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const g of data.groups) {
    for (const t of g.teams) {
      for (const p of t.squad) {
        rows.push({
          shirt_number: p.shirt_number,
          player_name: p.name,
          position: p.position,
          team: t.team,
          group: g.group,
          age: p.age,
          caps: p.caps,
          goals: p.goals,
          captain: p.captain,
          club: p.club,
        })
      }
    }
  }
  return rows
}
