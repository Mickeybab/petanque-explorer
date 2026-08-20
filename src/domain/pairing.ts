import { createRng, shuffle, type Rng } from './rng'
import { computeStandings } from './standings'
import type { Match, Tournament } from './types'

/**
 * Borne la recherche d'appariement. Au-delà, on considère qu'aucune solution
 * sans revanche n'est atteignable en temps raisonnable et on se rabat sur un
 * appariement séquentiel.
 */
const NODE_BUDGET = 50_000

/** Clé d'opposition indépendante de l'ordre des deux équipes. */
export function opponentKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Oppositions déjà composées, scores saisis ou non. */
export function playedPairs(tournament: Tournament): Set<string> {
  const pairs = new Set<string>()
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.teamBId === null) continue
      pairs.add(opponentKey(match.teamAId, match.teamBId))
    }
  }
  return pairs
}

/** Nombre de fois où chaque équipe a déjà été exempte. */
export function byeCounts(tournament: Tournament): Map<string, number> {
  const counts = new Map<string, number>(tournament.teams.map((t) => [t.id, 0]))
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.teamBId !== null) continue
      counts.set(match.teamAId, (counts.get(match.teamAId) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Ordre dans lequel les équipes sont présentées à l'appariement.
 *
 * Tour 1 : tirage au sort pur. Tours suivants : ordre du classement, ce qui
 * fait se rencontrer les équipes de niveau proche (système suisse). Les ex
 * æquo stricts sont mélangés entre eux pour ne pas avantager toujours les
 * mêmes noms.
 */
function orderTeams(tournament: Tournament, roundNumber: number, rng: Rng): string[] {
  if (roundNumber <= 1) {
    return shuffle(
      tournament.teams.map((t) => t.id),
      rng,
    )
  }

  const standings = computeStandings(tournament)
  const ordered: string[] = []
  let groupe: string[] = []
  let cle: string | null = null

  for (const ligne of standings) {
    const sienne = `${ligne.won}/${ligne.diff}/${ligne.pointsFor}`
    if (sienne !== cle) {
      ordered.push(...shuffle(groupe, rng))
      groupe = []
      cle = sienne
    }
    groupe.push(ligne.teamId)
  }
  ordered.push(...shuffle(groupe, rng))

  return ordered
}

/**
 * Choisit l'équipe exempte : la plus basse au classement parmi celles qui
 * l'ont été le moins souvent. Renvoie son id et le reste de l'ordre.
 */
function extractBye(order: readonly string[], counts: Map<string, number>): {
  bye: string
  reste: string[]
} {
  let bye = order[order.length - 1] as string
  let minimum = Number.POSITIVE_INFINITY

  // Parcours du bas du classement vers le haut : à nombre de byes égal,
  // c'est la moins bien classée qui est exemptée.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i] as string
    const compte = counts.get(id) ?? 0
    if (compte < minimum) {
      minimum = compte
      bye = id
    }
  }

  return { bye, reste: order.filter((id) => id !== bye) }
}

/**
 * Appariement par retour arrière : on confronte la première équipe au meilleur
 * adversaire encore libre qu'elle n'a jamais joué, puis on apparie le reste ;
 * en cas d'impasse on essaie l'adversaire suivant.
 */
function pairWithoutRematch(
  remaining: readonly string[],
  played: ReadonlySet<string>,
  budget: { reste: number },
): [string, string][] | null {
  if (remaining.length === 0) return []
  if (budget.reste-- <= 0) return null

  const a = remaining[0] as string
  for (let i = 1; i < remaining.length; i++) {
    const b = remaining[i] as string
    if (played.has(opponentKey(a, b))) continue

    const autres = remaining.filter((_, index) => index !== 0 && index !== i)
    const suite = pairWithoutRematch(autres, played, budget)
    if (suite !== null) return [[a, b], ...suite]
  }

  return null
}

/** Repli : on apparie dans l'ordre, revanches comprises. */
function pairSequentially(remaining: readonly string[]): [string, string][] {
  const pairs: [string, string][] = []
  for (let i = 0; i + 1 < remaining.length; i += 2) {
    pairs.push([remaining[i] as string, remaining[i + 1] as string])
  }
  return pairs
}

/**
 * Compose les oppositions d'un tour. Fonction pure : elle lit le tournoi mais
 * ne le modifie pas, c'est à l'appelant d'ajouter le tour obtenu.
 */
export function pairRound(tournament: Tournament, roundNumber: number): Match[] {
  const rng = createRng(tournament.seed + roundNumber * 7919)
  const order = orderTeams(tournament, roundNumber, rng)
  if (order.length === 0) return []

  const played = playedPairs(tournament)

  let byeTeamId: string | null = null
  let aApparier: readonly string[] = order
  if (order.length % 2 === 1) {
    const { bye, reste } = extractBye(order, byeCounts(tournament))
    byeTeamId = bye
    aApparier = reste
  }

  const sansRevanche = pairWithoutRematch(aApparier, played, { reste: NODE_BUDGET })
  const pairs = sansRevanche ?? pairSequentially(aApparier)

  const matches: Match[] = pairs.map(([teamAId, teamBId], index) => {
    const match: Match = {
      id: `r${roundNumber}-m${index + 1}`,
      round: roundNumber,
      teamAId,
      teamBId,
      scoreA: null,
      scoreB: null,
    }
    if (played.has(opponentKey(teamAId, teamBId))) match.isRematch = true
    return match
  })

  if (byeTeamId !== null) {
    matches.push({
      id: `r${roundNumber}-bye`,
      round: roundNumber,
      teamAId: byeTeamId,
      teamBId: null,
      scoreA: null,
      scoreB: null,
    })
  }

  return matches
}
