/**
 * Sigil — ELO rating computation (§53)
 *
 * Standard ELO with K=32 for 4-player Commander:
 * - winner vs each loser as a separate match pair
 * - K scales by seat count (4-player gives more movement)
 */

export const DEFAULT_ELO = 1200

function expected(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

function updatePair(ratingA: number, ratingB: number, aWon: boolean, K = 32): [number, number] {
  const eA = expected(ratingA, ratingB)
  const eB = 1 - eA
  const sA = aWon ? 1 : 0
  const sB = aWon ? 0 : 1
  return [
    Math.round(ratingA + K * (sA - eA)),
    Math.round(ratingB + K * (sB - eB)),
  ]
}

export function computeEloDeltas(
  ratings: Record<string, number>,
  winnerUserId: string,
  allUserIds: string[]
): Record<string, number> {
  const current: Record<string, number> = {}
  for (const uid of allUserIds) {
    current[uid] = ratings[uid] ?? DEFAULT_ELO
  }
  const losers = allUserIds.filter((uid) => uid !== winnerUserId)
  const K = losers.length > 1 ? 20 : 32

  for (const loser of losers) {
    const [newWin, newLose] = updatePair(current[winnerUserId], current[loser], true, K)
    current[winnerUserId] = newWin
    current[loser] = newLose
  }

  return current
}

export function formatEloDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `−${Math.abs(delta)}`
  return '0'
}
