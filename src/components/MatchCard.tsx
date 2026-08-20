import { useEffect, useState } from 'react'
import { BYE_SCORE_AGAINST, BYE_SCORE_FOR, type Match } from '../domain/types'
import type { Action } from '../domain/tournament'

type Props = {
  match: Match
  nomDe: (teamId: string) => string
  dispatch: (action: Action) => void
  /** Nombre de parties du tournoi, pour situer celle-ci dans le parcours. */
  totalRounds: number
  /** Décalage d'apparition, pour que le tirage se dévoile carte après carte. */
  delai?: number
}

/**
 * « Partie 2 » suivi d'une jauge : les parties se mélangent dans la même liste,
 * il faut voir immédiatement où en est chaque équipe dans son parcours.
 */
function Reperage({ round, totalRounds }: { round: number; totalRounds: number }) {
  return (
    <span className="match__partie">
      Partie {round}
      <span className="match__jauge" aria-hidden="true">
        {Array.from({ length: totalRounds }, (_, i) => (
          <i
            key={i}
            className={
              i + 1 < round
                ? 'match__cran match__cran--faite'
                : i + 1 === round
                  ? 'match__cran match__cran--ici'
                  : 'match__cran'
            }
          />
        ))}
      </span>
    </span>
  )
}

const versTexte = (valeur: number | null): string => (valeur === null ? '' : String(valeur))
const versScore = (texte: string): number | null => (texte === '' ? null : Number(texte))

export function MatchCard({ match, nomDe, dispatch, totalRounds, delai = 0 }: Props) {
  const apparition = { animationDelay: `${delai}ms` }

  // La saisie reste locale jusqu'à validation : sans cela, taper le « 1 » de 13
  // enregistrerait déjà un score et ferait basculer la partie en terminée sous
  // les doigts de l'organisateur.
  const [brouillonA, setBrouillonA] = useState(versTexte(match.scoreA))
  const [brouillonB, setBrouillonB] = useState(versTexte(match.scoreB))

  useEffect(() => {
    setBrouillonA(versTexte(match.scoreA))
    setBrouillonB(versTexte(match.scoreB))
  }, [match.scoreA, match.scoreB])

  if (match.teamBId === null) {
    return (
      <article className="match match--bye" style={apparition}>
        <header className="match__entete">
          <Reperage round={match.round} totalRounds={totalRounds} />
          <span className="etiquette">Exempte</span>
        </header>
        <div className="camp camp--vainqueur">
          <span className="camp__nom">{nomDe(match.teamAId)}</span>
          <span className="score score--fige" aria-label="Score forfaitaire">
            {BYE_SCORE_FOR}
          </span>
        </div>
        <p className="match__mention">
          Aucun adversaire disponible : marque {BYE_SCORE_FOR}-{BYE_SCORE_AGAINST}.
        </p>
      </article>
    )
  }

  const { scoreA, scoreB } = match
  const joue = scoreA !== null && scoreB !== null

  const modifie = brouillonA !== versTexte(scoreA) || brouillonB !== versTexte(scoreB)
  // Un score à moitié saisi ne veut rien dire : on attend les deux, ou aucun.
  const complet =
    (brouillonA !== '' && brouillonB !== '') || (brouillonA === '' && brouillonB === '')

  const valider = (): void => {
    if (!modifie || !complet) return
    dispatch({
      type: 'setScore',
      matchId: match.id,
      scoreA: versScore(brouillonA),
      scoreB: versScore(brouillonB),
    })
  }

  const annuler = (): void => {
    setBrouillonA(versTexte(scoreA))
    setBrouillonB(versTexte(scoreB))
  }

  const auClavier = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') valider()
    if (e.key === 'Escape') annuler()
  }

  const classeCamp = (aGagne: boolean): string =>
    `camp ${!joue ? 'camp--attente' : aGagne ? 'camp--vainqueur' : ''}`.trim()

  const nomA = nomDe(match.teamAId)
  const nomB = nomDe(match.teamBId)

  return (
    <article className="match" style={apparition}>
      <header className="match__entete">
        <Reperage round={match.round} totalRounds={totalRounds} />
        {match.isFloater === true && (
          <span className="etiquette" title="Groupe impair : une équipe est descendue d’un cran">
            Flotteur
          </span>
        )}
        {match.isRematch === true && (
          <span
            className="etiquette etiquette--alerte"
            title="Plus aucun adversaire inédit n’était disponible"
          >
            Revanche
          </span>
        )}
        {joue && !modifie && <span>{scoreA === scoreB ? 'Égalité' : 'Terminée'}</span>}
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
          value={brouillonA}
          onChange={(e) => setBrouillonA(e.target.value)}
          onKeyDown={auClavier}
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
          value={brouillonB}
          onChange={(e) => setBrouillonB(e.target.value)}
          onKeyDown={auClavier}
        />
      </div>

      {modifie && (
        <div className="match__actions">
          <button className="bouton bouton--discret" type="button" onClick={annuler}>
            Annuler
          </button>
          <button
            className="bouton bouton--primaire bouton--compact"
            type="button"
            disabled={!complet}
            onClick={valider}
          >
            {joue ? 'Corriger le score' : 'Valider le score'}
          </button>
        </div>
      )}
    </article>
  )
}
