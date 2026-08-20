import { useEffect, useRef, useState } from 'react'
import type { Action } from '../domain/tournament'
import type { Tournament } from '../domain/types'
import { downloadTournament, readTournamentFile } from '../storage/fileTransfer'

type Props = {
  tournament: Tournament
  dispatch: (action: Action) => void
  onErreur: (message: string) => void
}

export function AppHeader({ tournament, dispatch, onErreur }: Props) {
  const [brouillon, setBrouillon] = useState(tournament.name)
  const [edition, setEdition] = useState(false)
  const fichier = useRef<HTMLInputElement>(null)

  useEffect(() => setBrouillon(tournament.name), [tournament.name])

  const validerNom = (): void => {
    setEdition(false)
    if (brouillon.trim() === '') setBrouillon(tournament.name)
    else dispatch({ type: 'renameTournament', name: brouillon })
  }

  const annulerNom = (): void => {
    setBrouillon(tournament.name)
    setEdition(false)
  }

  const importer = async (file: File): Promise<void> => {
    const importe = await readTournamentFile(file)
    if (!importe) {
      onErreur("Ce fichier n'est pas un tournoi exploitable. Choisissez un export de l'application.")
      return
    }
    dispatch({ type: 'load', tournament: importe })
  }

  return (
    <header className="entete">
      <p className="entete__club">Pétanque · Labruyère-Dorsa · Doublettes</p>

      <div className="entete__barre">
        <h1 className="entete__titre">
          {edition ? (
            <input
              className="entete__champ-titre"
              aria-label="Nom du tournoi"
              autoFocus
              value={brouillon}
              onChange={(e) => setBrouillon(e.target.value)}
              onBlur={validerNom}
              onKeyDown={(e) => {
                if (e.key === 'Enter') validerNom()
                if (e.key === 'Escape') annulerNom()
              }}
            />
          ) : (
            <button
              type="button"
              className="entete__nom"
              title="Renommer le tournoi"
              onClick={() => setEdition(true)}
            >
              {tournament.name}
            </button>
          )}
        </h1>

        <div className="entete__outils">
          <button className="bouton" type="button" onClick={() => downloadTournament(tournament)}>
            Exporter
          </button>
          <button className="bouton" type="button" onClick={() => fichier.current?.click()}>
            Importer
          </button>
          <button
            className="bouton bouton--discret bouton--danger"
            type="button"
            onClick={() => {
              if (confirm('Effacer ce tournoi et repartir de zéro ? Cette action est définitive.')) {
                dispatch({ type: 'reset' })
              }
            }}
          >
            Nouveau tournoi
          </button>
          <input
            ref={fichier}
            type="file"
            accept="application/json,.json"
            className="lecture-seule"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importer(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </header>
  )
}
