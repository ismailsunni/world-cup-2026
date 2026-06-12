import type { BracketMatch } from './types'

/** A knockout slot whose occupant is one of several groups' third-placed team. */
export interface ThirdSlot {
  matchNo: number
  key: 'team1' | 'team2'
  groups: string[] // candidate groups, e.g. ['A','B','C','D','F']
}

export interface ResolvedMatch {
  team1: string | null
  team2: string | null
  winner: string | null
  loser: string | null
}

const RE_WINNER_GROUP = /^Winner Group ([A-L])$/
const RE_RUNNER_GROUP = /^Runner-up Group ([A-L])$/
const RE_THIRD = /^3rd Group ([A-L/]+)$/
const RE_WINNER_MATCH = /^Winner Match (\d+)$/
const RE_LOSER_MATCH = /^Loser Match (\d+)$/

/** Find every "3rd Group X/Y/Z" slot in the bracket. */
export function parseThirdSlots(bracket: BracketMatch[]): ThirdSlot[] {
  const slots: ThirdSlot[] = []
  for (const m of bracket) {
    for (const key of ['team1', 'team2'] as const) {
      const desc = key === 'team1' ? m.team1_desc : m.team2_desc
      const mm = RE_THIRD.exec(desc)
      if (mm) slots.push({ matchNo: m.match_no, key, groups: mm[1].split('/') })
    }
  }
  return slots
}

/**
 * Assign each third-place slot a distinct qualifying group, respecting each
 * slot's candidate-group list. Uses Kuhn's bipartite-matching algorithm — the
 * candidate lists are built so any set of 8 qualifying groups has a perfect
 * matching (a valid, consistent allocation; not necessarily FIFA's exact one).
 * Returns a map of `"<matchNo>-<key>"` → group letter.
 */
export function allocateThirds(
  slots: ThirdSlot[],
  qualifiedGroups: string[],
): Record<string, string> {
  const qset = new Set(qualifiedGroups)
  const adj = slots.map((s) => s.groups.filter((g) => qset.has(g)))
  const groupToSlot: Record<string, number> = {}
  const slotGroup: (string | null)[] = slots.map(() => null)

  function augment(si: number, seen: Set<string>): boolean {
    for (const g of adj[si]) {
      if (seen.has(g)) continue
      seen.add(g)
      const occ = groupToSlot[g]
      if (occ === undefined || augment(occ, seen)) {
        groupToSlot[g] = si
        slotGroup[si] = g
        return true
      }
    }
    return false
  }
  for (let i = 0; i < slots.length; i++) augment(i, new Set())

  const out: Record<string, string> = {}
  slots.forEach((s, i) => {
    if (slotGroup[i]) out[`${s.matchNo}-${s.key}`] = slotGroup[i]!
  })
  return out
}

export interface ResolveOpts {
  bracket: BracketMatch[]
  /** group letter → team name finishing 1st / 2nd / 3rd. */
  rank1: Record<string, string>
  rank2: Record<string, string>
  thirdByGroup: Record<string, string>
  /** `"<matchNo>-<key>"` → group letter (from allocateThirds). */
  thirdAlloc: Record<string, string>
  /** User's winner pick per match number (overrides the seeded default). */
  picks: Record<number, string | null>
  /** Higher = stronger; decides the default winner when unset. */
  strength: (team: string) => number
}

/**
 * Resolve every knockout match into concrete teams + winner/loser, propagating
 * results up the tree. Matches are processed in ascending match number, which
 * is a valid topological order (feeders always have lower numbers).
 */
export function resolveBracket(opts: ResolveOpts): Map<number, ResolvedMatch> {
  const { bracket, rank1, rank2, thirdByGroup, thirdAlloc, picks, strength } = opts
  const resolved = new Map<number, ResolvedMatch>()
  const byNo = new Map(bracket.map((m) => [m.match_no, m]))

  const teamFor = (desc: string, matchNo: number, key: 'team1' | 'team2'): string | null => {
    let mm = RE_WINNER_GROUP.exec(desc)
    if (mm) return rank1[mm[1]] ?? null
    mm = RE_RUNNER_GROUP.exec(desc)
    if (mm) return rank2[mm[1]] ?? null
    if (RE_THIRD.test(desc)) {
      const g = thirdAlloc[`${matchNo}-${key}`]
      return g ? (thirdByGroup[g] ?? null) : null
    }
    mm = RE_WINNER_MATCH.exec(desc)
    if (mm) return resolved.get(Number(mm[1]))?.winner ?? null
    mm = RE_LOSER_MATCH.exec(desc)
    if (mm) return resolved.get(Number(mm[1]))?.loser ?? null
    return null
  }

  for (const matchNo of [...byNo.keys()].sort((a, b) => a - b)) {
    const m = byNo.get(matchNo)!
    const team1 = teamFor(m.team1_desc, matchNo, 'team1')
    const team2 = teamFor(m.team2_desc, matchNo, 'team2')

    let winner: string | null = null
    let loser: string | null = null
    if (team1 && team2) {
      const pick = picks[matchNo]
      if (pick === team1 || pick === team2) winner = pick
      else winner = strength(team1) >= strength(team2) ? team1 : team2
      loser = winner === team1 ? team2 : team1
    } else if (team1 && !team2) {
      winner = team1
    } else if (team2 && !team1) {
      winner = team2
    }
    resolved.set(matchNo, { team1, team2, winner, loser })
  }
  return resolved
}

/** Vertical bracket layout: leaf order + a fractional row position per match. */
export function bracketLayout(bracket: BracketMatch[]) {
  const childrenOf = (n: number) =>
    bracket
      .filter((b) => b.feeds_into === n)
      .map((b) => b.match_no)
      .sort((a, b) => a - b)

  const leaves = (n: number): number[] => {
    const c = childrenOf(n)
    return c.length ? c.flatMap(leaves) : [n]
  }

  // Root = the match nothing feeds out of that isn't the third-place playoff.
  const finals = bracket.filter((b) => b.feeds_into == null)
  const root = finals.reduce((a, b) => (a.match_no > b.match_no ? a : b)).match_no
  const leafOrder = leaves(root)
  const leafIndex = new Map(leafOrder.map((m, i) => [m, i]))

  const pos = (n: number): number => {
    const ls = leaves(n)
    return ls.reduce((s, x) => s + (leafIndex.get(x) ?? 0), 0) / ls.length
  }
  return { leafOrder, pos, childrenOf, root }
}
