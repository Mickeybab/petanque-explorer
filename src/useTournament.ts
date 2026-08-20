import { useEffect, useReducer, useState } from 'react'
import { createTournament, reducer, type Action } from './domain/tournament'
import { loadTournament, saveTournament } from './storage/persistence'
import type { Tournament } from './domain/types'

const NOM_PAR_DEFAUT = 'Tournoi de Labruyère-Dorsa'

/**
 * L'état du tournoi, restauré au chargement et sauvegardé à chaque
 * changement. Le jour du tournoi, fermer l'onglet par mégarde ne doit rien
 * coûter — et si le navigateur refuse d'écrire, il faut le dire tout de suite.
 */
export function useTournament(): {
  tournament: Tournament
  dispatch: (action: Action) => void
  sauvegardeActive: boolean
} {
  const [tournament, dispatch] = useReducer(
    reducer,
    null,
    () => loadTournament() ?? createTournament(NOM_PAR_DEFAUT),
  )
  const [sauvegardeActive, setSauvegardeActive] = useState(true)

  useEffect(() => {
    setSauvegardeActive(saveTournament(tournament))
  }, [tournament])

  return { tournament, dispatch, sauvegardeActive }
}
