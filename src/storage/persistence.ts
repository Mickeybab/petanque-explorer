import type { Match, Round, Team, Tournament } from '../domain/types'

/** Clé versionnée : un futur changement de format n'écrasera pas l'ancien. */
export const STORAGE_KEY = 'petanque:v1'

/** Le sous-ensemble de `localStorage` dont on a besoin — injectable en test. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Stockage inerte : navigateur en mode privé, ou exécution hors navigateur. */
const noopStore: KeyValueStore = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

export function browserStore(): KeyValueStore {
  try {
    return typeof localStorage === 'undefined' ? noopStore : localStorage
  } catch {
    return noopStore
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const estTexte = (v: unknown): v is string => typeof v === 'string'

const estEntierPositif = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0

const estScore = (v: unknown): v is number | null => v === null || estEntierPositif(v)

function parseTeams(raw: unknown): Team[] | null {
  if (!Array.isArray(raw)) return null
  const teams: Team[] = []
  const vus = new Set<string>()
  for (const item of raw) {
    if (!estObjet(item) || !estTexte(item.id) || !estTexte(item.name)) return null
    if (vus.has(item.id)) return null
    vus.add(item.id)
    teams.push({ id: item.id, name: item.name })
  }
  return teams
}

function parseMatch(raw: unknown, teamIds: ReadonlySet<string>): Match | null {
  if (!estObjet(raw)) return null
  if (!estTexte(raw.id) || !estEntierPositif(raw.round)) return null
  if (!estTexte(raw.teamAId) || !teamIds.has(raw.teamAId)) return null
  if (raw.teamBId !== null && (!estTexte(raw.teamBId) || !teamIds.has(raw.teamBId))) return null
  if (!estScore(raw.scoreA) || !estScore(raw.scoreB)) return null

  const match: Match = {
    id: raw.id,
    round: raw.round,
    teamAId: raw.teamAId,
    teamBId: raw.teamBId as string | null,
    scoreA: raw.scoreA,
    scoreB: raw.scoreB,
  }
  if (raw.isRematch === true) match.isRematch = true
  return match
}

function parseRounds(raw: unknown, teamIds: ReadonlySet<string>): Round[] | null {
  if (!Array.isArray(raw)) return null
  const rounds: Round[] = []
  for (const item of raw) {
    if (!estObjet(item) || !estEntierPositif(item.number) || !Array.isArray(item.matches)) {
      return null
    }
    const matches: Match[] = []
    for (const brut of item.matches) {
      const match = parseMatch(brut, teamIds)
      if (!match) return null
      matches.push(match)
    }
    rounds.push({ number: item.number, matches })
  }
  return rounds
}

/**
 * Valide un objet issu d'un JSON externe et renvoie un tournoi sûr, ou `null`.
 * Aucune donnée partiellement valide n'est acceptée : mieux vaut refuser un
 * fichier que d'afficher un classement faux.
 */
export function parseTournament(raw: unknown): Tournament | null {
  if (!estObjet(raw)) return null
  if (!estTexte(raw.name) || !estTexte(raw.createdAt)) return null
  if (!estEntierPositif(raw.totalRounds) || raw.totalRounds < 1) return null
  if (!estEntierPositif(raw.seed)) return null

  const teams = parseTeams(raw.teams)
  if (!teams) return null

  const rounds = parseRounds(raw.rounds, new Set(teams.map((t) => t.id)))
  if (!rounds) return null

  return {
    name: raw.name,
    createdAt: raw.createdAt,
    totalRounds: raw.totalRounds,
    seed: raw.seed,
    teams,
    rounds,
  }
}

// ---------------------------------------------------------------------------
// Lecture / écriture
// ---------------------------------------------------------------------------

export function serializeTournament(tournament: Tournament): string {
  return JSON.stringify(tournament, null, 2)
}

/** Renvoie `false` si le navigateur refuse d'écrire (mode privé, quota). */
export function saveTournament(tournament: Tournament, store: KeyValueStore = browserStore()): boolean {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(tournament))
    return true
  } catch {
    return false
  }
}

export function loadTournament(store: KeyValueStore = browserStore()): Tournament | null {
  try {
    const brut = store.getItem(STORAGE_KEY)
    if (brut === null) return null
    return parseTournament(JSON.parse(brut))
  } catch {
    return null
  }
}

export function clearTournament(store: KeyValueStore = browserStore()): void {
  try {
    store.removeItem(STORAGE_KEY)
  } catch {
    // Rien à faire : l'état en mémoire fait foi.
  }
}

// ---------------------------------------------------------------------------
// Export fichier
// ---------------------------------------------------------------------------

function slugifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function exportFileName(tournament: Tournament, now = new Date()): string {
  const slug = slugifier(tournament.name) || 'tournoi'
  const jour = now.toISOString().slice(0, 10)
  return `${slug}-${jour}.json`
}
