import type { Tournament } from '../domain/types'
import { exportFileName, parseTournament, serializeTournament } from './persistence'

/** Télécharge le tournoi en JSON — la sauvegarde de secours de l'organisateur. */
export function downloadTournament(tournament: Tournament): void {
  const blob = new Blob([serializeTournament(tournament)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = exportFileName(tournament)
  lien.click()
  URL.revokeObjectURL(url)
}

/** Relit un fichier exporté. Renvoie `null` si le contenu n'est pas exploitable. */
export async function readTournamentFile(file: File): Promise<Tournament | null> {
  try {
    return parseTournament(JSON.parse(await file.text()))
  } catch {
    return null
  }
}
