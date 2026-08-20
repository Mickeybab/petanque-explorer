import { useState } from 'react'
import type { Action } from '../domain/tournament'
import { hasStarted } from '../domain/tournament'
import type { Tournament } from '../domain/types'

type Props = {
  tournament: Tournament
  dispatch: (action: Action) => void
}

export function TeamsSetup({ tournament, dispatch }: Props) {
  const [nom, setNom] = useState('')
  const lance = hasStarted(tournament)
  const impair = tournament.teams.length % 2 === 1

  const ajouter = (): void => {
    if (nom.trim() === '') return
    dispatch({ type: 'addTeam', name: nom })
    setNom('')
  }

  return (
    <section className="section">
      <h2 className="section__titre">Les doublettes</h2>
      <p className="section__note">
        {lance
          ? 'Les inscriptions sont closes : les tours sont déjà tirés. Les noms restent corrigeables.'
          : 'Une ligne par équipe. Appuyez sur Entrée pour enchaîner les inscriptions.'}
      </p>

      {!lance && (
        <div className="saisie">
          <input
            className="champ"
            aria-label="Nom de l’équipe"
            placeholder="Nom de l’équipe"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ajouter()
            }}
          />
          <button className="bouton bouton--primaire" type="button" onClick={ajouter}>
            Ajouter
          </button>
        </div>
      )}

      {tournament.teams.length === 0 ? (
        <p className="vide">Aucune équipe inscrite. Commencez par la première doublette.</p>
      ) : (
        <ul className="equipes">
          {tournament.teams.map((team, index) => (
            <li className="equipe" key={team.id}>
              <span className="equipe__numero">{String(index + 1).padStart(2, '0')}</span>
              <input
                className="equipe__nom"
                aria-label={`Nom de l’équipe ${index + 1}`}
                defaultValue={team.name}
                onBlur={(e) => {
                  if (e.target.value.trim() === '') e.target.value = team.name
                  else dispatch({ type: 'renameTeam', teamId: team.id, name: e.target.value })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
              {!lance && (
                <button
                  className="bouton bouton--discret bouton--danger"
                  type="button"
                  aria-label={`Retirer ${team.name}`}
                  onClick={() => dispatch({ type: 'removeTeam', teamId: team.id })}
                >
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {impair && (
        <p className="avis">
          Effectif impair : à chaque tour, une équipe différente sera exempte et créditée d’une
          victoire 13-7.
        </p>
      )}
    </section>
  )
}
