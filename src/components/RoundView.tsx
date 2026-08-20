import { useEffect, useState } from 'react'
import { MatchCard } from './MatchCard'
import { canGenerateNextRound, isRoundComplete, MIN_TEAMS } from '../domain/tournament'
import type { Action } from '../domain/tournament'
import type { Tournament } from '../domain/types'

type Props = {
  tournament: Tournament
  dispatch: (action: Action) => void
  nomDe: (teamId: string) => string
}

export function RoundView({ tournament, dispatch, nomDe }: Props) {
  const dernier = tournament.rounds.length
  const [tourAffiche, setTourAffiche] = useState(Math.max(1, dernier))

  // Un tour fraîchement tiré devient le tour affiché.
  useEffect(() => {
    if (dernier > 0) setTourAffiche(dernier)
  }, [dernier])

  const round = tournament.rounds.find((r) => r.number === tourAffiche)
  const prochain = dernier + 1
  const peutGenerer = canGenerateNextRound(tournament)

  const raisonBlocage = (): string => {
    if (tournament.teams.length < MIN_TEAMS) {
      return `Inscrivez au moins ${MIN_TEAMS} équipes pour lancer le tirage.`
    }
    if (dernier >= tournament.totalRounds) return 'Les quatre tours sont joués.'
    return `Complétez tous les scores du tour ${dernier} pour tirer le suivant.`
  }

  return (
    <section className="section">
      <h2 className="section__titre">
        {round ? `Tour ${round.number}` : 'Aucun tour tiré'}
      </h2>
      <p className="section__note">
        {round
          ? isRoundComplete(round)
            ? 'Tour complet. Vous pouvez encore corriger un score.'
            : 'Saisissez les scores au fur et à mesure des parties.'
          : 'Le tour 1 est tiré au sort. Les suivants opposent les équipes de niveau proche, sans jamais rejouer le même adversaire.'}
      </p>

      {dernier > 0 && (
        <nav className="tours" aria-label="Tours du tournoi">
          {Array.from({ length: tournament.totalRounds }, (_, i) => i + 1).map((numero) => {
            const tour = tournament.rounds.find((r) => r.number === numero)
            return (
              <button
                key={numero}
                type="button"
                className="tour-puce"
                aria-current={numero === tourAffiche}
                disabled={!tour}
                onClick={() => setTourAffiche(numero)}
              >
                Tour {numero}
                {tour && (
                  <span
                    className={`tour-puce__etat${isRoundComplete(tour) ? ' tour-puce__etat--fini' : ''}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </nav>
      )}

      {round ? (
        <div className="matchs">
          {round.matches.map((match, index) => (
            <MatchCard
              key={match.id}
              match={match}
              numero={index + 1}
              nomDe={nomDe}
              dispatch={dispatch}
              delai={Math.min(index, 12) * 40}
            />
          ))}
        </div>
      ) : (
        <p className="vide">
          Le tirage n’a pas encore eu lieu. Inscrivez les doublettes, puis lancez le tour 1.
        </p>
      )}

      <p style={{ marginTop: '1.75rem' }}>
        <button
          className="bouton bouton--primaire"
          type="button"
          disabled={!peutGenerer}
          onClick={() => dispatch({ type: 'generateNextRound' })}
        >
          {dernier === 0 ? 'Lancer le tirage du tour 1' : `Tirer le tour ${prochain}`}
        </button>
      </p>

      {!peutGenerer && <p className="section__note">{raisonBlocage()}</p>}
    </section>
  )
}
