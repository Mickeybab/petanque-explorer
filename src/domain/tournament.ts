import { advancePairings } from './pairing'
import { teamProgress } from './progress'
import { isMatchPlayed } from './standings'
import type { Match, Tournament } from './types'

export const DEFAULT_TOTAL_ROUNDS = 4
export const MIN_TEAMS = 2

export type Action =
  | { type: 'addTeam'; name: string }
  | { type: 'renameTeam'; teamId: string; name: string }
  | { type: 'removeTeam'; teamId: string }
  | { type: 'renameTournament'; name: string }
  | { type: 'startTournament' }
  | { type: 'setScore'; matchId: string; scoreA: number | null; scoreB: number | null }
  | { type: 'reset' }
  | { type: 'load'; tournament: Tournament }

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function createTournament(name = 'Tournoi de pétanque'): Tournament {
  return {
    name,
    createdAt: new Date().toISOString(),
    totalRounds: DEFAULT_TOTAL_ROUNDS,
    seed: Math.floor(Math.random() * 2 ** 31),
    teams: [],
    rounds: [],
  }
}

// ---------------------------------------------------------------------------
// Lectures dérivées
// ---------------------------------------------------------------------------

export function hasStarted(tournament: Tournament): boolean {
  return tournament.rounds.length > 0
}

export function canStart(tournament: Tournament): boolean {
  return !hasStarted(tournament) && tournament.teams.length >= MIN_TEAMS
}

/** Les parties dont le score n'est pas encore saisi, dans l'ordre des tours. */
export function ongoingMatches(tournament: Tournament): Match[] {
  return tournament.rounds
    .flatMap((round) => round.matches)
    .filter((match) => match.teamBId !== null && !isMatchPlayed(match))
}

/** Pourquoi une équipe libre ne joue pas encore. */
export type Waiting = {
  teamId: string
  /**
   * `adversaire` : elle attend qu'une équipe de son bilan se libère.
   * `tour` : elle a déjà une partie d'avance et laisse les autres revenir.
   */
  reason: 'adversaire' | 'tour'
}

export function waitingTeams(tournament: Tournament): Waiting[] {
  if (!hasStarted(tournament)) return []
  const avancement = teamProgress(tournament)
  if (avancement.size === 0) return []

  const minAssignes = Math.min(...[...avancement.values()].map((p) => p.assigned))

  return [...avancement.values()]
    .filter((p) => !p.busy && !p.finished)
    .map((p) => ({
      teamId: p.teamId,
      reason: p.assigned > minAssignes ? ('tour' as const) : ('adversaire' as const),
    }))
}

export function isTournamentFinished(tournament: Tournament): boolean {
  if (!hasStarted(tournament)) return false
  const avancement = teamProgress(tournament)
  return [...avancement.values()].every((p) => p.played >= tournament.totalRounds)
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** Scores libres, mais toujours des entiers positifs. */
function normalizeScore(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

function updateMatch(
  tournament: Tournament,
  matchId: string,
  update: (match: Match) => Match,
): Tournament {
  // On ne recrée l'état que si la mise à jour change réellement quelque chose :
  // un no-op doit conserver l'identité, sinon l'interface se redessine pour rien.
  let modifie = false
  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => {
      if (match.id !== matchId) return match
      const suivant = update(match)
      if (suivant !== match) modifie = true
      return suivant
    }),
  }))
  return modifie ? { ...tournament, rounds } : tournament
}

export function reducer(state: Tournament, action: Action): Tournament {
  switch (action.type) {
    case 'addTeam': {
      const name = action.name.trim()
      // Les inscriptions sont closes dès le lancement : ajouter une équipe
      // après coup fausserait les oppositions déjà composées.
      if (name === '' || hasStarted(state)) return state
      return { ...state, teams: [...state.teams, { id: newId('team'), name }] }
    }

    case 'renameTeam': {
      const name = action.name.trim()
      if (name === '') return state
      return {
        ...state,
        teams: state.teams.map((team) => (team.id === action.teamId ? { ...team, name } : team)),
      }
    }

    case 'removeTeam': {
      if (hasStarted(state)) return state
      return { ...state, teams: state.teams.filter((team) => team.id !== action.teamId) }
    }

    case 'renameTournament': {
      const name = action.name.trim()
      return name === '' ? state : { ...state, name }
    }

    case 'startTournament':
      return canStart(state) ? advancePairings(state) : state

    case 'setScore': {
      const scoreA = normalizeScore(action.scoreA)
      const scoreB = normalizeScore(action.scoreB)
      const apres = updateMatch(state, action.matchId, (match) =>
        // Le score d'une équipe exempte est forfaitaire, il ne se saisit pas.
        match.teamBId === null ? match : { ...match, scoreA, scoreB },
      )
      // Une partie qui se termine peut libérer des équipes : on relance
      // aussitôt l'appariement plutôt que d'attendre la fin du tour.
      return apres === state ? state : advancePairings(apres)
    }

    case 'reset':
      return createTournament(state.name)

    case 'load':
      return action.tournament
  }
}
