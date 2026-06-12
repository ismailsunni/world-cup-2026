import type { Group } from './types'

/**
 * Compact, restorable encoding of a bracket prediction for a share link.
 *
 * Layout (fixed-width string, version-prefixed):
 *   [0]      version '1'
 *   [1]      basis: 'e' (Elo) | 'f' (FIFA)
 *   [2..]    group orders: per group (A..L), 4 digits = team indices into the
 *            group's original team order, giving the predicted 1st→4th finish
 *   [..]     thirds order: 12 group letters, best→worst (top 8 qualify)
 *   [..]     sides: 8 hex chars = 32 bits, one per knockout match (ascending
 *            match number); 0 = team1 advances, 1 = team2 advances
 */
export interface ShareState {
  basis: 'elo' | 'fifa'
  order: Record<string, string[]> // group → team names, predicted order
  thirdsRank: string[] // group letters, best-third order
  sides: Record<number, 0 | 1> // knockout match number → advancing side
}

const VERSION = '1'

function sidesToHex(bits: number[]): string {
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) {
    let v = 0
    for (let j = 0; j < 4; j++) v = (v << 1) | (bits[i + j] || 0)
    hex += v.toString(16)
  }
  return hex
}

function hexToBits(hex: string): number[] {
  const bits: number[] = []
  for (const ch of hex) {
    const v = parseInt(ch, 16)
    for (let j = 3; j >= 0; j--) bits.push((v >> j) & 1)
  }
  return bits
}

const sortedLetters = (groups: Group[]) => groups.map((g) => g.group).sort()
const baseOrder = (groups: Group[]) =>
  Object.fromEntries(groups.map((g) => [g.group, g.teams.map((t) => t.team)])) as Record<
    string,
    string[]
  >
const knockoutNos = (matchNos: number[]) => [...matchNos].sort((a, b) => a - b)

export function encodeShare(state: ShareState, groups: Group[], matchNos: number[]): string {
  const letters = sortedLetters(groups)
  const base = baseOrder(groups)
  const nos = knockoutNos(matchNos)

  let s = VERSION + (state.basis === 'fifa' ? 'f' : 'e')
  for (const g of letters) {
    const predicted = state.order[g] ?? base[g]
    for (const name of predicted) s += String(base[g].indexOf(name))
  }
  s += state.thirdsRank.join('')
  s += sidesToHex(nos.map((no) => state.sides[no] ?? 0))
  return s
}

export function decodeShare(
  code: string,
  groups: Group[],
  matchNos: number[],
): ShareState | null {
  try {
    if (code[0] !== VERSION) return null
    const letters = sortedLetters(groups)
    const base = baseOrder(groups)
    const nos = knockoutNos(matchNos)

    let i = 1
    const basis: 'elo' | 'fifa' = code[i++] === 'f' ? 'fifa' : 'elo'

    const order: Record<string, string[]> = {}
    for (const g of letters) {
      const idx = code.slice(i, i + 4).split('').map(Number)
      i += 4
      const names = idx.map((k) => base[g][k])
      if (names.some((n) => n == null)) return null
      order[g] = names
    }

    const thirdsRank = code.slice(i, i + letters.length).split('')
    i += letters.length
    if (thirdsRank.length !== letters.length) return null

    const bits = hexToBits(code.slice(i))
    const sides: Record<number, 0 | 1> = {}
    nos.forEach((no, k) => {
      sides[no] = (bits[k] === 1 ? 1 : 0) as 0 | 1
    })

    return { basis, order, thirdsRank, sides }
  } catch {
    return null
  }
}
