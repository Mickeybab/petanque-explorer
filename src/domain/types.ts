/** Modèle de données du tournoi. Aucune logique ici, uniquement la forme. */

export type Team = {
  id: string
  name: string
}

/**
 * Une opposition d'un tour.
 * `teamBId === null` signifie que l'équipe A est exempte (bye) : elle ne joue
 * pas ce tour-là mais se voit créditer une victoire forfaitaire.
 */
export type Match = {
  id: string
  round: number
  teamAId: string
  teamBId: string | null
  scoreA: number | null
  scoreB: number | null
  /** Vrai quand l'appariement a dû recréer une opposition déjà jouée. */
  isRematch?: boolean
  /**
   * Vrai quand les deux équipes n'avaient pas le même bilan : leur groupe
   * était impair, l'une d'elles est descendue d'un cran pour jouer quand même.
   */
  isFloater?: boolean
}

export type Round = {
  number: number
  matches: Match[]
}

export type Tournament = {
  name: string
  createdAt: string
  /** Nombre de tours prévus (4 pour le tournoi de Labruyère-Dorsa). */
  totalRounds: number
  /** Graine du tirage au sort : rend l'aléatoire reproductible. */
  seed: number
  teams: Team[]
  rounds: Round[]
}

/** Ligne du classement, telle qu'affichée dans le tableau. */
export type Standing = {
  teamId: string
  name: string
  played: number
  won: number
  drawn: number
  lost: number
  /** « Total + » : points marqués. */
  pointsFor: number
  /** « Total − » : points encaissés. */
  pointsAgainst: number
  /** « Total » : le goal-average, soit pointsFor − pointsAgainst. */
  diff: number
  /** Rang, partagé entre équipes strictement à égalité. */
  rank: number
}

/** Score forfaitaire attribué à l'équipe exempte. */
export const BYE_SCORE_FOR = 13
export const BYE_SCORE_AGAINST = 7
