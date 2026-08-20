import {
  BYE_SCORE_AGAINST,
  BYE_SCORE_FOR,
  type Match,
  type Standing,
  type Tournament,
} from './types'

/** Un match ne compte que si les deux scores sont saisis. */
export function isMatchPlayed(match: Match): boolean {
  if (match.teamBId === null) return true
  return match.scoreA !== null && match.scoreB !== null
}

/** Tous les matchs du tournoi, tours confondus. */
export function allMatches(tournament: Tournament): Match[] {
  return tournament.rounds.flatMap((round) => round.matches)
}

const comparerNoms = (a: string, b: string): number =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' })

/**
 * Classement du tournoi.
 *
 * Ordre de départage : parties gagnées, puis goal-average (« Total »),
 * puis points marqués (« Total + »), puis le nom pour un affichage stable.
 * Les équipes strictement à égalité sur les trois premiers critères
 * partagent le même rang.
 */
export function computeStandings(tournament: Tournament): Standing[] {
  const parId = new Map<string, Standing>(
    tournament.teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        name: team.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
        rank: 0,
      },
    ]),
  )

  const enregistrer = (teamId: string, pour: number, contre: number): void => {
    const ligne = parId.get(teamId)
    if (!ligne) return
    ligne.played += 1
    ligne.pointsFor += pour
    ligne.pointsAgainst += contre
    if (pour > contre) ligne.won += 1
    else if (pour < contre) ligne.lost += 1
    else ligne.drawn += 1
  }

  for (const match of allMatches(tournament)) {
    if (!isMatchPlayed(match)) continue

    if (match.teamBId === null) {
      enregistrer(match.teamAId, BYE_SCORE_FOR, BYE_SCORE_AGAINST)
      continue
    }

    const scoreA = match.scoreA as number
    const scoreB = match.scoreB as number
    enregistrer(match.teamAId, scoreA, scoreB)
    enregistrer(match.teamBId, scoreB, scoreA)
  }

  const classement = [...parId.values()]
  for (const ligne of classement) {
    ligne.diff = ligne.pointsFor - ligne.pointsAgainst
  }

  classement.sort(
    (a, b) =>
      b.won - a.won ||
      b.diff - a.diff ||
      b.pointsFor - a.pointsFor ||
      comparerNoms(a.name, b.name),
  )

  classement.forEach((ligne, index) => {
    const precedent = classement[index - 1]
    const exAequo =
      precedent !== undefined &&
      precedent.won === ligne.won &&
      precedent.diff === ligne.diff &&
      precedent.pointsFor === ligne.pointsFor
    ligne.rank = exAequo ? (precedent.rank as number) : index + 1
  })

  return classement
}
