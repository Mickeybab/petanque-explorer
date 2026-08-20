/** Fabriques réservées aux tests : construire un tournoi lisiblement. */
import type { Match, Round, Team, Tournament } from '../types'

/** [équipe A, équipe B (null = exempte), score A, score B] */
export type SpecMatch = [string, string | null, number | null, number | null]

export function makeTeams(noms: readonly string[]): Team[] {
  return noms.map((name, i) => ({ id: `t${i + 1}`, name }))
}

export function makeTournament(
  noms: readonly string[],
  tours: readonly (readonly SpecMatch[])[] = [],
  overrides: Partial<Tournament> = {},
): Tournament {
  const teams = makeTeams(noms)
  const idDe = (name: string): string => {
    const team = teams.find((t) => t.name === name)
    if (!team) throw new Error(`Équipe inconnue dans la fixture : ${name}`)
    return team.id
  }

  const rounds: Round[] = tours.map((matchs, i) => ({
    number: i + 1,
    matches: matchs.map(([a, b, scoreA, scoreB], j): Match => ({
      id: `r${i + 1}m${j + 1}`,
      round: i + 1,
      teamAId: idDe(a),
      teamBId: b === null ? null : idDe(b),
      scoreA,
      scoreB,
    })),
  }))

  return {
    name: 'Tournoi test',
    createdAt: '2026-08-20T10:00:00.000Z',
    totalRounds: 4,
    seed: 1,
    teams,
    rounds,
    ...overrides,
  }
}
