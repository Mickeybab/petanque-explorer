import { isMatchPlayed } from './standings'
import { BYE_SCORE_AGAINST, BYE_SCORE_FOR, type Tournament } from './types'

/**
 * Où en est une équipe. `assigned` compte les matchs attribués (terminés ou
 * non), `played` seulement ceux dont le score est saisi : la différence dit si
 * l'équipe est en train de jouer.
 */
export type Progress = {
  teamId: string
  assigned: number
  played: number
  won: number
  lost: number
  drawn: number
  byes: number
  busy: boolean
  finished: boolean
}

/** Le bilan qui définit le groupe d'appariement : gagnants avec gagnants. */
export type Record = { played: number; won: number; lost: number }

export function recordKey(record: Record): string {
  return `${record.played}/${record.won}/${record.lost}`
}

/**
 * Les bilans qu'une équipe occupée peut afficher une fois son match terminé :
 * victoire, défaite ou égalité. Sert à savoir si une équipe libre peut encore
 * espérer un adversaire de son groupe.
 */
export function possibleNextKeys(record: Record): Set<string> {
  const { played, won, lost } = record
  return new Set([
    recordKey({ played: played + 1, won: won + 1, lost }),
    recordKey({ played: played + 1, won, lost: lost + 1 }),
    recordKey({ played: played + 1, won, lost }),
  ])
}

export function teamProgress(tournament: Tournament): Map<string, Progress> {
  const avancement = new Map<string, Progress>(
    tournament.teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        assigned: 0,
        played: 0,
        won: 0,
        lost: 0,
        drawn: 0,
        byes: 0,
        busy: false,
        finished: false,
      },
    ]),
  )

  const enregistrer = (teamId: string, pour: number | null, contre: number | null): void => {
    const p = avancement.get(teamId)
    if (!p) return
    p.assigned += 1
    if (pour === null || contre === null) return
    p.played += 1
    if (pour > contre) p.won += 1
    else if (pour < contre) p.lost += 1
    else p.drawn += 1
  }

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.teamBId === null) {
        enregistrer(match.teamAId, BYE_SCORE_FOR, BYE_SCORE_AGAINST)
        const p = avancement.get(match.teamAId)
        if (p) p.byes += 1
        continue
      }
      const termine = isMatchPlayed(match)
      enregistrer(match.teamAId, termine ? match.scoreA : null, termine ? match.scoreB : null)
      enregistrer(match.teamBId, termine ? match.scoreB : null, termine ? match.scoreA : null)
    }
  }

  for (const p of avancement.values()) {
    p.busy = p.assigned > p.played
    p.finished = p.played >= tournament.totalRounds
  }

  return avancement
}
