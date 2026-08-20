import { useMemo, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { RoundView } from './components/RoundView'
import { StandingsTable } from './components/StandingsTable'
import { TeamsSetup } from './components/TeamsSetup'
import { hasStarted } from './domain/tournament'
import { useTournament } from './useTournament'

type Onglet = 'equipes' | 'tours' | 'classement'

const LIBELLES: Record<Onglet, string> = {
  equipes: 'Équipes',
  tours: 'Tours',
  classement: 'Classement',
}

export function App() {
  const { tournament, dispatch, sauvegardeActive } = useTournament()
  const [onglet, setOnglet] = useState<Onglet>(() =>
    tournament.rounds.length > 0 ? 'tours' : 'equipes',
  )
  const [erreur, setErreur] = useState<string | null>(null)

  const nomsParId = useMemo(
    () => new Map(tournament.teams.map((t) => [t.id, t.name])),
    [tournament.teams],
  )
  const nomDe = (teamId: string): string => nomsParId.get(teamId) ?? 'Équipe inconnue'

  const compteur: Record<Onglet, string | null> = {
    equipes: String(tournament.teams.length),
    tours: hasStarted(tournament) ? `${tournament.rounds.length}/${tournament.totalRounds}` : null,
    classement: null,
  }

  return (
    <div className="appli">
      <AppHeader tournament={tournament} dispatch={dispatch} onErreur={setErreur} />

      {!sauvegardeActive && (
        <p className="avis avis--erreur">
          Ce navigateur refuse d’enregistrer la partie. Exportez le tournoi régulièrement pour ne
          rien perdre.
        </p>
      )}

      {erreur !== null && (
        <p className="avis avis--erreur">
          {erreur}{' '}
          <button className="bouton bouton--discret" type="button" onClick={() => setErreur(null)}>
            Fermer
          </button>
        </p>
      )}

      <nav className="onglets" role="tablist" aria-label="Sections du tournoi">
        {(Object.keys(LIBELLES) as Onglet[]).map((cle) => (
          <button
            key={cle}
            type="button"
            role="tab"
            className="onglet"
            aria-selected={onglet === cle}
            onClick={() => setOnglet(cle)}
          >
            {LIBELLES[cle]}
            {compteur[cle] !== null && <span className="onglet__compteur">{compteur[cle]}</span>}
          </button>
        ))}
      </nav>

      <main>
        {onglet === 'equipes' && <TeamsSetup tournament={tournament} dispatch={dispatch} />}
        {onglet === 'tours' && (
          <RoundView tournament={tournament} dispatch={dispatch} nomDe={nomDe} />
        )}
        {onglet === 'classement' && <StandingsTable tournament={tournament} />}
      </main>
    </div>
  )
}
