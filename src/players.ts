import type { Player, WorldCup } from './types'

/** A squad player flattened with its team/group context — the unit of the scatter plot. */
export interface PlayerPoint extends Player {
  team: string
  group: string
  confederation: string
}

export function buildPlayerPoints(data: WorldCup): PlayerPoint[] {
  const out: PlayerPoint[] = []
  for (const g of data.groups) {
    for (const t of g.teams) {
      for (const p of t.squad) {
        out.push({
          ...p,
          team: t.team,
          group: g.group,
          confederation: t.confederation,
        })
      }
    }
  }
  return out
}
