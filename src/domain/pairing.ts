import { createRng, shuffle, type Rng } from './rng'
import { possibleNextKeys, recordKey, teamProgress } from './progress'
import { computeStandings } from './standings'
import type { Match, Round, Tournament } from './types'

/** Borne la recherche d'appariement pour qu'elle ne s'emballe jamais. */
const NODE_BUDGET = 20_000

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

/**
 * Ordre suisse : le classement courant, les ex æquo stricts étant mélangés
 * entre eux. Au premier tour toutes les équipes sont à égalité : c'est donc un
 * tirage au sort.
 */
function orderedTeamIds(tournament: Tournament, rng: Rng): string[] {
  const ordered: string[] = []
  let groupe: string[] = []
  let cle: string | null = null

  for (const ligne of computeStandings(tournament)) {
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
 * Appariement complet par retour arrière : chaque équipe reçoit un adversaire
 * qu'elle n'a jamais joué, ou bien la fonction renvoie `null`.
 */
function appariementComplet(
  remaining: readonly string[],
  played: ReadonlySet<string>,
  budget: { reste: number },
): [string, string][] | null {
  if (remaining.length === 0) return []
  if (remaining.length % 2 === 1) return null
  if (budget.reste-- <= 0) return null

  const a = remaining[0] as string
  for (let i = 1; i < remaining.length; i++) {
    const b = remaining[i] as string
    if (played.has(opponentKey(a, b))) continue

    const autres = remaining.filter((_, index) => index !== 0 && index !== i)
    const suite = appariementComplet(autres, played, budget)
    if (suite !== null) return [[a, b], ...suite]
  }

  return null
}

/**
 * Reste-t-il de quoi apparier tout ce monde sans revanche, en ne laissant de
 * côté que l'équipe imposée par la parité ? C'est ce contrôle qui empêche un
 * appariement immédiat de condamner les dernières équipes du tour.
 */
function resteAppariable(ids: readonly string[], played: ReadonlySet<string>): boolean {
  if (ids.length % 2 === 0) {
    return appariementComplet(ids, played, { reste: NODE_BUDGET }) !== null
  }
  // Nombre impair : une équipe sera exempte, on cherche laquelle en partant du
  // bas du classement.
  for (let i = ids.length - 1; i >= 0; i--) {
    const sansElle = ids.filter((_, index) => index !== i)
    if (appariementComplet(sansElle, played, { reste: NODE_BUDGET }) !== null) return true
  }
  return false
}

/**
 * Compose les matchs qui peuvent démarrer maintenant. Fonction pure : elle lit
 * le tournoi sans le modifier.
 *
 * Deux équipes ne s'affrontent que si elles ont exactement le même bilan et ne
 * se sont jamais rencontrées. Une équipe libre qui ne trouve personne attend,
 * tant qu'un match en cours peut encore produire une équipe de son groupe.
 */
function pairOnce(tournament: Tournament): Match[] {
  if (tournament.teams.length === 0) return []

  const avancement = teamProgress(tournament)
  const total = tournament.totalRounds
  const assignes = [...avancement.values()].map((p) => p.assigned)
  const minAssignes = Math.min(...assignes)

  const rng = createRng(tournament.seed + (assignes.reduce((a, b) => a + b, 0) + 1) * 7919)
  const ordre = orderedTeamIds(tournament, rng)

  // Une équipe n'entame sa partie N que si toutes les autres ont reçu la leur :
  // sans ce garde-fou, quelques équipes rapides joueraient le tournoi entre
  // elles. Toutes les équipes du vivier sont donc au même numéro de partie.
  const vivier = ordre.filter((id) => {
    const p = avancement.get(id)
    return p !== undefined && p.assigned <= minAssignes && p.assigned < total
  })
  if (vivier.length === 0) return []

  const played = playedPairs(tournament)
  const cleDe = (id: string): string => {
    const p = avancement.get(id)
    return p ? recordKey(p) : ''
  }

  /** Écart de bilan : 0 entre deux équipes du même groupe. */
  const ecart = (a: string, b: string): number => {
    const pa = avancement.get(a)
    const pb = avancement.get(b)
    if (!pa || !pb) return 99
    return Math.abs(pa.won - pb.won) + Math.abs(pa.lost - pb.lost)
  }

  const libres = vivier.filter((id) => avancement.get(id)?.busy === false)
  const occupees = vivier.filter((id) => avancement.get(id)?.busy === true)
  if (libres.length === 0) return []

  // Une équipe sans adversaire de son bilan patiente, tant qu'un match en cours
  // peut encore lui en fournir un : mieux vaut attendre que descendre.
  const memeBilanDispo = (id: string): boolean =>
    libres.some((o) => o !== id && cleDe(o) === cleDe(id) && !played.has(opponentKey(id, o)))
  const peutEncoreVenir = (id: string): boolean =>
    occupees.some((u) => {
      const p = avancement.get(u)
      return p !== undefined && !played.has(opponentKey(id, u)) && possibleNextKeys(p).has(cleDe(id))
    })

  const candidats = libres.filter((id) => memeBilanDispo(id) || !peutEncoreVenir(id))
  if (candidats.length === 0) return []

  const pris = new Set<string>()
  const paires: [string, string][] = []

  /** Écart maximal toléré pour un flotteur : le groupe immédiatement voisin. */
  const ECART_VOISIN = 2

  /**
   * Même question, mais en exigeant un adversaire *proche*. Attendre n'a de
   * sens que si un match en cours peut livrer mieux que ce qu'on a sous la
   * main ; sinon l'équipe risque de rester seule en fin de tour.
   */
  const peutAttendreProche = (id: string): boolean => {
    const mien = avancement.get(id)
    if (!mien) return false
    return occupees.some((u) => {
      const p = avancement.get(u)
      if (!p || played.has(opponentKey(id, u))) return false
      return [
        { won: p.won + 1, lost: p.lost },
        { won: p.won, lost: p.lost + 1 },
        { won: p.won, lost: p.lost },
      ].some(
        (issue) =>
          Math.abs(mien.won - issue.won) + Math.abs(mien.lost - issue.lost) <= ECART_VOISIN,
      )
    })
  }

  /**
   * On descend le classement : chaque équipe prend l'adversaire au bilan le
   * plus proche du sien, à condition que le reste du tour demeure appariable
   * sans revanche. C'est ce contrôle qui évite d'acculer les dernières équipes.
   */
  const marier = (prudent: boolean): void => {
    for (const a of candidats) {
      if (pris.has(a)) continue
      const possibles = candidats
        .filter((b) => b !== a && !pris.has(b) && !played.has(opponentKey(a, b)))
        .sort((x, y) => ecart(a, x) - ecart(a, y))
      const b = possibles.find(
        (autre) =>
          !prudent ||
          resteAppariable(
            vivier.filter((id) => id !== a && id !== autre && !pris.has(id)),
            played,
          ),
      )
      if (b === undefined) continue
      // Descendre de plus d'un cran fausserait le tour : tant qu'un match en
      // cours peut libérer un adversaire plus proche, on préfère patienter.
      if (prudent && ecart(a, b) > ECART_VOISIN && peutAttendreProche(a)) continue
      paires.push([a, b])
      pris.add(a)
      pris.add(b)
    }
  }

  marier(true)
  // Impasse : plus rien ne se joue et aucune paire ne préserve un tour complet.
  // Sur un petit effectif, les adversaires frais finissent par manquer.
  if (paires.length === 0 && occupees.length === 0) marier(false)

  // Ce qui reste ne se tranche qu'une fois le tour précédent entièrement joué :
  // tant qu'un match tourne, une équipe seule patiente. Décider plus tôt, c'est
  // risquer d'exempter deux équipes qui auraient pu se rencontrer.
  let orphelines = occupees.length === 0 ? candidats.filter((id) => !pris.has(id)) : []

  let byeTeamId: string | null = null
  if (orphelines.length % 2 === 1) {
    const byes = new Map([...avancement.values()].map((p) => [p.teamId, p.byes]))
    let minimum = Number.POSITIVE_INFINITY
    for (const id of [...orphelines].reverse()) {
      const compte = byes.get(id) ?? 0
      if (compte < minimum) {
        minimum = compte
        byeTeamId = id
      }
    }
    orphelines = orphelines.filter((id) => id !== byeTeamId)
  }
  // Dernier recours : ces équipes se sont déjà toutes affrontées. Une revanche
  // vaut mieux que de distribuer des victoires par forfait.
  for (let i = 0; i + 1 < orphelines.length; i += 2) {
    paires.push([orphelines[i] as string, orphelines[i + 1] as string])
  }

  if (paires.length === 0 && byeTeamId === null) return []

  // Toutes les équipes du vivier sont au même numéro de partie.
  const round = minAssignes + 1
  const dejaDansLeTour = tournament.rounds.find((r) => r.number === round)?.matches.length ?? 0

  const matches: Match[] = paires.map(([teamAId, teamBId], index) => {
    const match: Match = {
      id: `r${round}-m${dejaDansLeTour + index + 1}`,
      round,
      teamAId,
      teamBId,
      scoreA: null,
      scoreB: null,
    }
    if (played.has(opponentKey(teamAId, teamBId))) match.isRematch = true
    if (cleDe(teamAId) !== cleDe(teamBId)) match.isFloater = true
    return match
  })

  if (byeTeamId !== null) {
    matches.push({
      id: `r${round}-bye${dejaDansLeTour + matches.length + 1}`,
      round,
      teamAId: byeTeamId,
      teamBId: null,
      scoreA: null,
      scoreB: null,
    })
  }

  return matches
}

function withNewMatches(tournament: Tournament, matches: readonly Match[]): Tournament {
  const rounds: Round[] = tournament.rounds.map((r) => ({ ...r, matches: [...r.matches] }))

  for (const match of matches) {
    const round = rounds.find((r) => r.number === match.round)
    if (round) round.matches.push(match)
    else rounds.push({ number: match.round, matches: [match] })
  }
  rounds.sort((a, b) => a.number - b.number)

  return { ...tournament, rounds }
}

/**
 * Fait avancer le tournoi : crée tous les matchs qui peuvent démarrer, en
 * boucle — une équipe exempte se libère aussitôt et peut réenchaîner.
 */
export function advancePairings(tournament: Tournament): Tournament {
  const plafond = tournament.teams.length * tournament.totalRounds + 10
  let courant = tournament

  for (let i = 0; i < plafond; i++) {
    const nouveaux = pairOnce(courant)
    if (nouveaux.length === 0) return courant
    courant = withNewMatches(courant, nouveaux)
  }

  return courant
}
