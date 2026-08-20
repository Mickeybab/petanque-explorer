import { MatchCard } from './MatchCard'
import {
  canStart,
  hasStarted,
  isTournamentFinished,
  MIN_TEAMS,
  ongoingMatches,
  waitingTeams,
} from '../domain/tournament'
import type { Action } from '../domain/tournament'
import { isMatchPlayed } from '../domain/standings'
import type { Match, Tournament } from '../domain/types'

type Props = {
  tournament: Tournament
  dispatch: (action: Action) => void
  nomDe: (teamId: string) => string
}

const MOTIFS = {
  adversaire: 'attend un adversaire de son niveau',
  tour: 'a une partie d’avance, elle attend les autres',
} as const

export function MatchesView({ tournament, dispatch, nomDe }: Props) {
  if (!hasStarted(tournament)) {
    return (
      <section className="section">
        <h2 className="section__titre">Les parties</h2>
        <p className="section__note">
          Le tirage de la première partie se fait au sort. Ensuite, chaque équipe qui termine
          repart aussitôt contre une équipe au même bilan — sans attendre les autres terrains.
        </p>
        <p className="vide">
          {tournament.teams.length < MIN_TEAMS
            ? `Inscrivez au moins ${MIN_TEAMS} équipes pour lancer le tournoi.`
            : 'Tout est prêt. Lancez le tournoi quand les équipes sont sur les terrains.'}
        </p>
        <p style={{ marginTop: '1.5rem' }}>
          <button
            className="bouton bouton--primaire"
            type="button"
            disabled={!canStart(tournament)}
            onClick={() => dispatch({ type: 'startTournament' })}
          >
            Lancer le tournoi
          </button>
        </p>
      </section>
    )
  }

  const enCours = ongoingMatches(tournament)
  const attente = waitingTeams(tournament)
  const termine = isTournamentFinished(tournament)

  // Chaque carte porte déjà son numéro de partie : une simple liste dans
  // l'ordre des tours suffit, sans intertitres redondants.
  const jouees = tournament.rounds.flatMap((round) => round.matches.filter(isMatchPlayed))

  return (
    <section className="section">
      <h2 className="section__titre">
        {termine ? 'Toutes les parties sont jouées' : `${enCours.length} partie${enCours.length > 1 ? 's' : ''} en cours`}
      </h2>
      <p className="section__note">
        {termine
          ? 'Rendez-vous au classement. Un score reste corrigeable ici.'
          : 'Saisissez les deux scores puis validez : les équipes libérées repartent aussitôt.'}
      </p>

      {enCours.length > 0 && (
        <div className="matchs">
          {enCours.map((match: Match, index) => (
            <MatchCard
              key={match.id}
              match={match}
              nomDe={nomDe}
              dispatch={dispatch}
              totalRounds={tournament.totalRounds}
              delai={Math.min(index, 12) * 40}
            />
          ))}
        </div>
      )}

      {attente.length > 0 && (
        <div className="attente">
          <h3 className="attente__titre">Au repos</h3>
          <ul className="attente__liste">
            {attente.map(({ teamId, reason }) => (
              <li className="attente__item" key={teamId}>
                <span className="attente__nom">{nomDe(teamId)}</span>
                <span className="attente__motif">{MOTIFS[reason]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {jouees.length > 0 && (
        <div className="jouees">
          <h3 className="section__titre">Parties jouées</h3>
          <p className="section__note">
            Une erreur se corrige ici : modifiez le score, puis validez la correction.
          </p>
          <div className="matchs">
            {jouees.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                nomDe={nomDe}
                dispatch={dispatch}
                totalRounds={tournament.totalRounds}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
