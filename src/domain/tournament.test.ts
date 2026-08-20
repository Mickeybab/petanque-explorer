import { describe, expect, test } from 'vitest'
import {
  canStart,
  createTournament,
  isTournamentFinished,
  ongoingMatches,
  reducer,
  waitingTeams,
} from './tournament'
import { teamProgress } from './progress'
import { makeTournament } from './__fixtures__/build'
import type { Match, Tournament } from './types'

const douze = Array.from({ length: 12 }, (_, i) => `Équipe ${i + 1}`)

const avecEquipes = (...noms: string[]): Tournament =>
  noms.reduce((t, name) => reducer(t, { type: 'addTeam', name }), createTournament())

const lance = (...noms: string[]): Tournament =>
  reducer(avecEquipes(...noms), { type: 'startTournament' })

/** Termine le premier match en cours. */
const terminerUn = (t: Tournament, aGagne = true): Tournament => {
  const m = ongoingMatches(t)[0] as Match
  return reducer(t, {
    type: 'setScore',
    matchId: m.id,
    scoreA: aGagne ? 13 : 6,
    scoreB: aGagne ? 6 : 13,
  })
}

const jouerJusquAuBout = (t: Tournament): Tournament => {
  let courant = t
  for (let i = 0; ongoingMatches(courant).length > 0 && i < 300; i++) {
    courant = terminerUn(courant, i % 3 !== 0)
  }
  return courant
}

describe('createTournament', () => {
  test('démarre sur 4 tours, sans équipe ni match', () => {
    const tournoi = createTournament()

    expect(tournoi.totalRounds).toBe(4)
    expect(tournoi.teams).toEqual([])
    expect(tournoi.rounds).toEqual([])
  })

  test('deux tournois créés à la suite ont des graines différentes', () => {
    expect(new Set(Array.from({ length: 20 }, () => createTournament().seed)).size).toBeGreaterThan(1)
  })
})

describe('addTeam', () => {
  test('ajoute une équipe avec un identifiant unique', () => {
    const tournoi = avecEquipes('Les Boulistes', 'Les Tireurs')

    expect(tournoi.teams.map((t) => t.name)).toEqual(['Les Boulistes', 'Les Tireurs'])
    expect(new Set(tournoi.teams.map((t) => t.id)).size).toBe(2)
  })

  test('supprime les espaces superflus autour du nom', () => {
    expect(avecEquipes('  Les Boulistes  ').teams[0]?.name).toBe('Les Boulistes')
  })

  test('refuse un nom vide', () => {
    expect(reducer(createTournament(), { type: 'addTeam', name: '   ' }).teams).toEqual([])
  })

  test('refuse un ajout une fois le tournoi lancé', () => {
    const avant = lance('A', 'B', 'C', 'D')

    expect(reducer(avant, { type: 'addTeam', name: 'E' })).toBe(avant)
  })
})

describe('renameTeam et removeTeam', () => {
  test('renomme une équipe', () => {
    const tournoi = avecEquipes('Les Boulistas')
    const id = tournoi.teams[0]?.id as string

    expect(reducer(tournoi, { type: 'renameTeam', teamId: id, name: 'Les Boulistes' }).teams[0]?.name).toBe(
      'Les Boulistes',
    )
  })

  test('renommer reste possible une fois le tournoi lancé', () => {
    const tournoi = lance('A', 'B', 'C', 'D')
    const id = tournoi.teams[0]?.id as string

    expect(reducer(tournoi, { type: 'renameTeam', teamId: id, name: 'Corrigé' }).teams[0]?.name).toBe(
      'Corrigé',
    )
  })

  test('supprime une équipe avant le lancement', () => {
    const tournoi = avecEquipes('A', 'B')
    const id = tournoi.teams[0]?.id as string

    expect(reducer(tournoi, { type: 'removeTeam', teamId: id }).teams.map((t) => t.name)).toEqual(['B'])
  })

  test('refuse la suppression une fois le tournoi lancé', () => {
    const tournoi = lance('A', 'B', 'C', 'D')
    const id = tournoi.teams[0]?.id as string

    expect(reducer(tournoi, { type: 'removeTeam', teamId: id })).toBe(tournoi)
  })
})

describe('startTournament', () => {
  test('lance toutes les équipes d’un coup', () => {
    const tournoi = lance('A', 'B', 'C', 'D')

    expect(ongoingMatches(tournoi)).toHaveLength(2)
  })

  test('refuse de démarrer avec moins de deux équipes', () => {
    const tournoi = avecEquipes('A')

    expect(canStart(tournoi)).toBe(false)
    expect(reducer(tournoi, { type: 'startTournament' })).toBe(tournoi)
  })

  test('ne relance pas un tournoi déjà lancé', () => {
    const tournoi = lance('A', 'B', 'C', 'D')

    expect(canStart(tournoi)).toBe(false)
    expect(reducer(tournoi, { type: 'startTournament' })).toBe(tournoi)
  })
})

describe('setScore — enchaînement au fil de l’eau', () => {
  test('enregistre le score sur le bon match', () => {
    const tournoi = lance('A', 'B', 'C', 'D')
    const matchId = ongoingMatches(tournoi)[0]?.id as string

    const apres = reducer(tournoi, { type: 'setScore', matchId, scoreA: 13, scoreB: 8 })

    expect(apres.rounds[0]?.matches.find((m) => m.id === matchId)).toMatchObject({
      scoreA: 13,
      scoreB: 8,
    })
  })

  test('un seul match terminé ne relance personne', () => {
    const tournoi = terminerUn(lance('A', 'B', 'C', 'D', 'E', 'F'))

    expect(tournoi.rounds.filter((r) => r.number === 2)).toEqual([])
  })

  test('deux matchs terminés relancent aussitôt les quatre équipes', () => {
    const tournoi = terminerUn(terminerUn(lance(...douze)))

    expect(tournoi.rounds.find((r) => r.number === 2)?.matches).toHaveLength(2)
  })

  test('les équipes rapides n’attendent pas les lentes', () => {
    const tournoi = terminerUn(terminerUn(lance(...douze)))
    const avancement = teamProgress(tournoi)

    expect([...avancement.values()].filter((p) => p.assigned === 2)).toHaveLength(4)
  })

  test('une relance est refusée si elle condamne les équipes encore en jeu', () => {
    // Six équipes : si les deux perdants repartaient ensemble, les deux équipes
    // du dernier match se retrouveraient face à face — or elles se rencontrent
    // justement. Seuls les gagnants repartent, les perdants patientent.
    const tournoi = terminerUn(terminerUn(lance('A', 'B', 'C', 'D', 'E', 'F')))

    expect(tournoi.rounds.find((r) => r.number === 2)?.matches).toHaveLength(1)
  })

  test('accepte la correction d’un score sans démonter les matchs déjà tirés', () => {
    const tournoi = terminerUn(terminerUn(lance('A', 'B', 'C', 'D', 'E', 'F')))
    const dejaTires = tournoi.rounds.flatMap((r) => r.matches).length
    const matchId = tournoi.rounds[0]?.matches[0]?.id as string

    const apres = reducer(tournoi, { type: 'setScore', matchId, scoreA: 4, scoreB: 13 })

    expect(apres.rounds.flatMap((r) => r.matches).length).toBe(dejaTires)
    expect(apres.rounds[0]?.matches[0]).toMatchObject({ scoreA: 4, scoreB: 13 })
  })

  test('permet d’effacer un score', () => {
    const tournoi = lance('A', 'B', 'C', 'D')
    const matchId = ongoingMatches(tournoi)[0]?.id as string

    const apres = reducer(
      reducer(tournoi, { type: 'setScore', matchId, scoreA: 13, scoreB: 8 }),
      { type: 'setScore', matchId, scoreA: null, scoreB: null },
    )

    expect(apres.rounds[0]?.matches[0]).toMatchObject({ scoreA: null, scoreB: null })
  })

  test('ramène un score négatif à zéro et arrondit un décimal', () => {
    const tournoi = lance('A', 'B', 'C', 'D')
    const matchId = ongoingMatches(tournoi)[0]?.id as string

    const apres = reducer(tournoi, { type: 'setScore', matchId, scoreA: -4, scoreB: 12.7 })

    expect(apres.rounds[0]?.matches[0]).toMatchObject({ scoreA: 0, scoreB: 12 })
  })

  test('ignore un identifiant de match inconnu', () => {
    const tournoi = lance('A', 'B', 'C', 'D')

    expect(reducer(tournoi, { type: 'setScore', matchId: 'inexistant', scoreA: 1, scoreB: 2 })).toBe(
      tournoi,
    )
  })

  test('ignore une saisie sur le match d’une équipe exempte', () => {
    const tournoi = lance('A', 'B', 'C')
    const bye = tournoi.rounds[0]?.matches.find((m) => m.teamBId === null)

    expect(
      reducer(tournoi, { type: 'setScore', matchId: bye?.id as string, scoreA: 5, scoreB: 5 }),
    ).toBe(tournoi)
  })
})

describe('ongoingMatches et waitingTeams', () => {
  test('les matchs en cours sont ceux dont le score manque', () => {
    const tournoi = terminerUn(lance('A', 'B', 'C', 'D', 'E', 'F'))

    expect(ongoingMatches(tournoi)).toHaveLength(2)
  })

  test('une équipe libérée seule figure parmi celles qui attendent', () => {
    const tournoi = terminerUn(lance('A', 'B', 'C', 'D', 'E', 'F'))

    expect(waitingTeams(tournoi)).toHaveLength(2)
    expect(waitingTeams(tournoi)[0]?.reason).toBe('adversaire')
  })

  test('une équipe en avance attend que les autres aient joué', () => {
    // Quatre équipes bouclent leur deuxième partie pendant que les autres en
    // sont encore à la première : le garde-fou les met en attente.
    let tournoi = terminerUn(terminerUn(lance(...douze)))
    for (const m of tournoi.rounds.find((r) => r.number === 2)?.matches ?? []) {
      tournoi = reducer(tournoi, { type: 'setScore', matchId: m.id, scoreA: 13, scoreB: 5 })
    }

    expect(waitingTeams(tournoi).filter((a) => a.reason === 'tour')).toHaveLength(4)
  })

  test('personne n’attend une fois le tournoi terminé', () => {
    expect(waitingTeams(jouerJusquAuBout(lance('A', 'B', 'C', 'D')))).toEqual([])
  })
})

describe('isTournamentFinished', () => {
  test('un tournoi non lancé n’est pas terminé', () => {
    expect(isTournamentFinished(avecEquipes('A', 'B'))).toBe(false)
  })

  test('un tournoi devient terminé quand chaque équipe a joué ses quatre parties', () => {
    const tournoi = jouerJusquAuBout(lance('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'))
    const avancement = teamProgress(tournoi)

    expect([...avancement.values()].every((p) => p.played === 4)).toBe(true)
    expect(isTournamentFinished(tournoi)).toBe(true)
  })

  test('il ne l’est plus si l’on efface un score', () => {
    const tournoi = jouerJusquAuBout(lance('A', 'B', 'C', 'D'))
    const matchId = tournoi.rounds[0]?.matches[0]?.id as string

    const apres = reducer(tournoi, { type: 'setScore', matchId, scoreA: null, scoreB: null })

    expect(isTournamentFinished(apres)).toBe(false)
  })
})

describe('reset et load', () => {
  test('reset vide le tournoi', () => {
    const neuf = reducer(lance('A', 'B', 'C', 'D'), { type: 'reset' })

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
    expect(reducer(createTournament(), { type: 'renameTournament', name: 'Doublettes 2026' }).name).toBe(
      'Doublettes 2026',
    )
  })
})
