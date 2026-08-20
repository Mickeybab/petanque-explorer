import { BYE_SCORE_AGAINST, BYE_SCORE_FOR, type Match } from '../domain/types'
import type { Action } from '../domain/tournament'

type Props = {
  match: Match
  numero: number
  nomDe: (teamId: string) => string
  dispatch: (action: Action) => void
  /** Décalage d'apparition, pour que le tirage se dévoile carte après carte. */
  delai?: number
}

const versScore = (valeur: string): number | null => (valeur === '' ? null : Number(valeur))

export function MatchCard({ match, numero, nomDe, dispatch, delai = 0 }: Props) {
  const apparition = { animationDelay: `${delai}ms` }

  if (match.teamBId === null) {
    return (
      <article className="match match--bye" style={apparition}>
        <header className="match__entete">
          <span>Exempte</span>
        </header>
        <div className="camp camp--vainqueur">
          <span className="camp__nom">{nomDe(match.teamAId)}</span>
          <span className="score score--fige" aria-label="Score forfaitaire">
            {BYE_SCORE_FOR}
          </span>
        </div>
        <p className="match__mention">
          Ne joue pas ce tour et marque {BYE_SCORE_FOR}-{BYE_SCORE_AGAINST}.
        </p>
      </article>
    )
  }

  const { scoreA, scoreB } = match
  const joue = scoreA !== null && scoreB !== null
  const classeCamp = (aGagne: boolean): string =>
    `camp ${!joue ? 'camp--attente' : aGagne ? 'camp--vainqueur' : ''}`.trim()

  const saisir = (cote: 'A' | 'B', valeur: string): void => {
    dispatch({
      type: 'setScore',
      matchId: match.id,
      scoreA: cote === 'A' ? versScore(valeur) : scoreA,
      scoreB: cote === 'B' ? versScore(valeur) : scoreB,
    })
  }

  const nomA = nomDe(match.teamAId)
  const nomB = nomDe(match.teamBId)

  return (
    <article className="match" style={apparition}>
      <header className="match__entete">
        <span>Match {numero}</span>
        {match.isRematch === true && <span className="etiquette">Revanche</span>}
        {joue && <span>{scoreA === scoreB ? 'Égalité' : 'Terminé'}</span>}
      </header>

      <div className={classeCamp(joue && (scoreA as number) > (scoreB as number))}>
        <span className="camp__nom">{nomA}</span>
        <input
          className="score"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="–"
          aria-label={`Score de ${nomA}`}
          value={scoreA ?? ''}
          onChange={(e) => saisir('A', e.target.value)}
        />
      </div>

      <div className={classeCamp(joue && (scoreB as number) > (scoreA as number))}>
        <span className="camp__nom">{nomB}</span>
        <input
          className="score"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="–"
          aria-label={`Score de ${nomB}`}
          value={scoreB ?? ''}
          onChange={(e) => saisir('B', e.target.value)}
        />
      </div>
    </article>
  )
}
