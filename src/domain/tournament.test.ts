import { describe, expect, test } from 'vitest'
import {
  canGenerateNextRound,
  createTournament,
  currentRound,
  isRoundComplete,
  isTournamentFinished,
  reducer,
} from './tournament'
import { makeTournament } from './__fixtures__/build'
import type { Tournament } from './types'

const avecEquipes = (...noms: string[]): Tournament =>
  noms.reduce((t, name) => reducer(t, { type: 'addTeam', name }), createTournament())

/** Remplit tous les scores du dernier tour généré. */
const remplirDernierTour = (tournoi: Tournament): Tournament => {
  const tour = currentRound(tournoi)
  if (!tour) return tournoi
  return tour.matches.reduce(
    (t, m) =>
      m.teamBId === null ? t : reducer(t, { type: 'setScore', matchId: m.id, scoreA: 13, scoreB: 7 }),
    tournoi,
  )
}

describe('createTournament', () => {
  test('démarre sur 4 tours, sans équipe ni tour', () => {
    const tournoi = createTournament()

    expect(tournoi.totalRounds).toBe(4)
    expect(tournoi.teams).toEqual([])
    expect(tournoi.rounds).toEqual([])
  })

  test('deux tournois créés à la suite ont des graines différentes', () => {
    const graines = new Set(Array.from({ length: 20 }, () => createTournament().seed))

    expect(graines.size).toBeGreaterThan(1)
  })
})

describe('addTeam', () => {
  test('ajoute une équipe avec un identifiant unique', () => {
    const tournoi = avecEquipes('Les Boulistes', 'Les Tireurs')

    expect(tournoi.teams.map((t) => t.name)).toEqual(['Les Boulistes', 'Les Tireurs'])
    expect(new Set(tournoi.teams.map((t) => t.id)).size).toBe(2)
  })

  test('supprime les espaces superflus autour du nom', () => {
    const tournoi = avecEquipes('  Les Boulistes  ')

    expect(tournoi.teams[0]?.name).toBe('Les Boulistes')
  })

  test('refuse un nom vide', () => {
    const tournoi = reducer(createTournament(), { type: 'addTeam', name: '   ' })

    expect(tournoi.teams).toEqual([])
  })

  test('refuse un ajout une fois le premier tour généré', () => {
    const avant = reducer(avecEquipes('A', 'B', 'C', 'D'), { type: 'generateNextRound' })

    const apres = reducer(avant, { type: 'addTeam', name: 'E' })

    expect(apres.teams).toHaveLength(4)
    expect(apres).toBe(avant)
  })
})

describe('renameTeam et removeTeam', () => {
  test('renomme une équipe', () => {
    const tournoi = avecEquipes('Les Boulistas')
    const id = tournoi.teams[0]?.id as string

    const apres = reducer(tournoi, { type: 'renameTeam', teamId: id, name: 'Les Boulistes' })

    expect(apres.teams[0]?.name).toBe('Les Boulistes')
  })

  test('renommer reste possible une fois le tournoi lancé', () => {
    const lance = reducer(avecEquipes('A', 'B', 'C', 'D'), { type: 'generateNextRound' })
    const id = lance.teams[0]?.id as string

    const apres = reducer(lance, { type: 'renameTeam', teamId: id, name: 'Corrigé' })

    expect(apres.teams[0]?.name).toBe('Corrigé')
  })

  test('supprime une équipe avant le lancement', () => {
    const tournoi = avecEquipes('A', 'B')
    const id = tournoi.teams[0]?.id as string

    const apres = reducer(tournoi, { type: 'removeTeam', teamId: id })

    expect(apres.teams.map((t) => t.name)).toEqual(['B'])
  })

  test('refuse la suppression une fois le tournoi lancé', () => {
    const lance = reducer(avecEquipes('A', 'B', 'C', 'D'), { type: 'generateNextRound' })
    const id = lance.teams[0]?.id as string

    expect(reducer(lance, { type: 'removeTeam', teamId: id })).toBe(lance)
  })
})

describe('generateNextRound', () => {
  test('génère le premier tour', () => {
    const tournoi = reducer(avecEquipes('A', 'B', 'C', 'D'), { type: 'generateNextRound' })

    expect(tournoi.rounds).toHaveLength(1)
    expect(tournoi.rounds[0]?.number).toBe(1)
    expect(tournoi.rounds[0]?.matches).toHaveLength(2)
  })

  test('refuse de démarrer avec moins de deux équipes', () => {
    const tournoi = avecEquipes('A')

    expect(reducer(tournoi, { type: 'generateNextRound' })).toBe(tournoi)
    expect(canGenerateNextRound(tournoi)).toBe(false)
  })

  test('refuse le tour suivant tant qu’un score manque', () => {
    const tour1 = reducer(avecEquipes('A', 'B', 'C', 'D'), { type: 'generateNextRound' })

    expect(canGenerateNextRound(tour1)).toBe(false)
    expect(reducer(tour1, { type: 'generateNextRound' })).toBe(tour1)
  })

  test('autorise le tour suivant une fois tous les scores saisis', () => {
    const tour1 = remplirDernierTour(
      reducer(avecEquipes('A', 'B', 'C', 'D'), { type: 'generateNextRound' }),
    )

    expect(canGenerateNextRound(tour1)).toBe(true)
    expect(reducer(tour1, { type: 'generateNextRound' }).rounds).toHaveLength(2)
  })

  test('refuse d’aller au-delà du nombre de tours prévu', () => {
    let tournoi = avecEquipes('A', 'B', 'C', 'D')
    for (let i = 0; i < 4; i++) {
      tournoi = remplirDernierTour(reducer(tournoi, { type: 'generateNextRound' }))
    }

    expect(tournoi.rounds).toHaveLength(4)
    expect(isTournamentFinished(tournoi)).toBe(true)
    expect(canGenerateNextRound(tournoi)).toBe(false)
    expect(reducer(tournoi, { type: 'generateNextRound' })).toBe(tournoi)
  })

  test('un tour où seule l’équipe exempte n’a pas de score est complet', () => {
    const tour1 = remplirDernierTour(
      reducer(avecEquipes('A', 'B', 'C'), { type: 'generateNextRound' }),
    )

    expect(isRoundComplete(tour1.rounds[0])).toBe(true)
  })
})

describe('setScore', () => {
  const tourUn = (): Tournament =>
    reducer(avecEquipes('A', 'B', 'C', 'D'), { type: 'generateNextRound' })

  test('enregistre un score sur le bon match', () => {
    const tournoi = tourUn()
    const matchId = tournoi.rounds[0]?.matches[0]?.id as string

    const apres = reducer(tournoi, { type: 'setScore', matchId, scoreA: 13, scoreB: 8 })

    expect(apres.rounds[0]?.matches[0]).toMatchObject({ scoreA: 13, scoreB: 8 })
    expect(apres.rounds[0]?.matches[1]).toMatchObject({ scoreA: null, scoreB: null })
  })

  test('accepte la correction d’un score déjà saisi', () => {
    const tournoi = tourUn()
    const matchId = tournoi.rounds[0]?.matches[0]?.id as string

    const apres = reducer(
      reducer(tournoi, { type: 'setScore', matchId, scoreA: 13, scoreB: 8 }),
      { type: 'setScore', matchId, scoreA: 9, scoreB: 13 },
    )

    expect(apres.rounds[0]?.matches[0]).toMatchObject({ scoreA: 9, scoreB: 13 })
  })

  test('permet d’effacer un score', () => {
    const tournoi = tourUn()
    const matchId = tournoi.rounds[0]?.matches[0]?.id as string

    const apres = reducer(
      reducer(tournoi, { type: 'setScore', matchId, scoreA: 13, scoreB: 8 }),
      { type: 'setScore', matchId, scoreA: null, scoreB: null },
    )

    expect(apres.rounds[0]?.matches[0]).toMatchObject({ scoreA: null, scoreB: null })
  })

  test('ramène un score négatif à zéro', () => {
    const tournoi = tourUn()
    const matchId = tournoi.rounds[0]?.matches[0]?.id as string

    const apres = reducer(tournoi, { type: 'setScore', matchId, scoreA: -4, scoreB: 13 })

    expect(apres.rounds[0]?.matches[0]?.scoreA).toBe(0)
  })

  test('arrondit un score décimal à l’entier inférieur', () => {
    const tournoi = tourUn()
    const matchId = tournoi.rounds[0]?.matches[0]?.id as string

    const apres = reducer(tournoi, { type: 'setScore', matchId, scoreA: 12.7, scoreB: 13 })

    expect(apres.rounds[0]?.matches[0]?.scoreA).toBe(12)
  })

  test('ignore un identifiant de match inconnu', () => {
    const tournoi = tourUn()

    expect(reducer(tournoi, { type: 'setScore', matchId: 'inexistant', scoreA: 1, scoreB: 2 })).toBe(
      tournoi,
    )
  })

  test('ignore une saisie sur le match d’une équipe exempte', () => {
    const tournoi = reducer(avecEquipes('A', 'B', 'C'), { type: 'generateNextRound' })
    const bye = tournoi.rounds[0]?.matches.find((m) => m.teamBId === null)

    expect(reducer(tournoi, { type: 'setScore', matchId: bye?.id as string, scoreA: 5, scoreB: 5 })).toBe(
      tournoi,
    )
  })
})

describe('reset et load', () => {
  test('reset vide le tournoi et change la graine', () => {
    const lance = reducer(avecEquipes('A', 'B', 'C', 'D'), { type: 'generateNextRound' })

    const neuf = reducer(lance, { type: 'reset' })

    expect(neuf.teams).toEqual([])
    expect(neuf.rounds).toEqual([])
  })

  test('load remplace intégralement l’état', () => {
    const importe = makeTournament(['X', 'Y'])

    expect(reducer(createTournament(), { type: 'load', tournament: importe })).toEqual(importe)
  })
})

describe('renameTournament', () => {
  test('change le nom affiché', () => {
    const apres = reducer(createTournament(), { type: 'renameTournament', name: 'Doublettes 2026' })

    expect(apres.name).toBe('Doublettes 2026')
  })
})
