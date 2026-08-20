import { pairRound } from './pairing'
import { isMatchPlayed } from './standings'
import type { Match, Round, Tournament } from './types'

export const DEFAULT_TOTAL_ROUNDS = 4
export const MIN_TEAMS = 2

export type Action =
  | { type: 'addTeam'; name: string }
  | { type: 'renameTeam'; teamId: string; name: string }
  | { type: 'removeTeam'; teamId: string }
  | { type: 'renameTournament'; name: string }
  | { type: 'generateNextRound' }
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

/** Le dernier tour généré, ou undefined si le tournoi n'est pas lancé. */
export function currentRound(tournament: Tournament): Round | undefined {
  return tournament.rounds[tournament.rounds.length - 1]
}

/** Un tour est complet quand tous ses matchs ont leurs deux scores. */
export function isRoundComplete(round: Round | undefined): boolean {
  if (!round) return false
  return round.matches.every(isMatchPlayed)
}

export function isTournamentFinished(tournament: Tournament): boolean {
  return (
    tournament.rounds.length >= tournament.totalRounds && isRoundComplete(currentRound(tournament))
  )
}

export function canGenerateNextRound(tournament: Tournament): boolean {
  if (tournament.teams.length < MIN_TEAMS) return false
  if (tournament.rounds.length >= tournament.totalRounds) return false
  if (!hasStarted(tournament)) return true
  return isRoundComplete(currentRound(tournament))
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
      // Les inscriptions sont closes dès que le tirage du tour 1 est fait :
      // ajouter une équipe après coup fausserait les tours déjà composés.
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

    case 'generateNextRound': {
      if (!canGenerateNextRound(state)) return state
      const number = state.rounds.length + 1
      return { ...state, rounds: [...state.rounds, { number, matches: pairRound(state, number) }] }
    }

    case 'setScore': {
      const scoreA = normalizeScore(action.scoreA)
      const scoreB = normalizeScore(action.scoreB)
      return updateMatch(state, action.matchId, (match) =>
        // Le score d'une équipe exempte est forfaitaire, il ne se saisit pas.
        match.teamBId === null ? match : { ...match, scoreA, scoreB },
      )
    }

    case 'reset':
      return createTournament(state.name)

    case 'load':
      return action.tournament
  }
}
