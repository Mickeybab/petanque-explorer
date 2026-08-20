import { describe, expect, test } from 'vitest'
import {
  STORAGE_KEY,
  clearTournament,
  exportFileName,
  loadTournament,
  parseTournament,
  saveTournament,
  serializeTournament,
  type KeyValueStore,
} from './persistence'
import { makeTournament } from '../domain/__fixtures__/build'

function fakeStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

const storeQuiEchoue = (): KeyValueStore => ({
  getItem: () => {
    throw new Error('stockage indisponible')
  },
  setItem: () => {
    throw new Error('quota dépassé')
  },
  removeItem: () => {
    throw new Error('stockage indisponible')
  },
})

describe('saveTournament / loadTournament', () => {
  test('un aller-retour restitue le tournoi à l’identique', () => {
    const tournoi = makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', 13, 4]]])
    const store = fakeStore()

    saveTournament(tournoi, store)

    expect(loadTournament(store)).toEqual(tournoi)
  })

  test('un stockage vide ne renvoie rien', () => {
    expect(loadTournament(fakeStore())).toBeNull()
  })

  test('un contenu illisible ne renvoie rien plutôt que de planter', () => {
    expect(loadTournament(fakeStore({ [STORAGE_KEY]: 'pas du json' }))).toBeNull()
  })

  test('un stockage indisponible n’interrompt pas l’application', () => {
    expect(() => saveTournament(makeTournament(['A']), storeQuiEchoue())).not.toThrow()
    expect(saveTournament(makeTournament(['A']), storeQuiEchoue())).toBe(false)
    expect(loadTournament(storeQuiEchoue())).toBeNull()
  })

  test('clearTournament efface la sauvegarde', () => {
    const store = fakeStore()
    saveTournament(makeTournament(['A', 'B']), store)

    clearTournament(store)

    expect(loadTournament(store)).toBeNull()
  })
})

describe('parseTournament', () => {
  const valide = makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', 13, 4]]])

  test('accepte un tournoi bien formé', () => {
    expect(parseTournament(JSON.parse(serializeTournament(valide)))).toEqual(valide)
  })

  test('refuse autre chose qu’un objet', () => {
    expect(parseTournament(null)).toBeNull()
    expect(parseTournament('tournoi')).toBeNull()
    expect(parseTournament([])).toBeNull()
  })

  test('refuse un tournoi sans liste d’équipes', () => {
    const { teams: _teams, ...sansEquipes } = valide

    expect(parseTournament(sansEquipes)).toBeNull()
  })

  test('refuse deux équipes partageant le même identifiant', () => {
    const doublon = {
      ...valide,
      teams: [
        { id: 'x', name: 'Alice' },
        { id: 'x', name: 'Bob' },
      ],
    }

    expect(parseTournament(doublon)).toBeNull()
  })

  test('refuse un match qui référence une équipe inconnue', () => {
    const orphelin = {
      ...valide,
      rounds: [
        {
          number: 1,
          matches: [
            { id: 'm', round: 1, teamAId: 'fantome', teamBId: null, scoreA: null, scoreB: null },
          ],
        },
      ],
    }

    expect(parseTournament(orphelin)).toBeNull()
  })

  test('refuse un score négatif ou décimal', () => {
    const mauvaisScore = {
      ...valide,
      rounds: [
        {
          number: 1,
          matches: [
            { id: 'm', round: 1, teamAId: 't1', teamBId: 't2', scoreA: -1, scoreB: 13 },
          ],
        },
      ],
    }

    expect(parseTournament(mauvaisScore)).toBeNull()
  })

  test('conserve le marqueur de revanche', () => {
    const avecRevanche = {
      ...valide,
      rounds: [
        {
          number: 1,
          matches: [
            { id: 'm', round: 1, teamAId: 't1', teamBId: 't2', scoreA: null, scoreB: null, isRematch: true },
          ],
        },
      ],
    }

    expect(parseTournament(avecRevanche)?.rounds[0]?.matches[0]?.isRematch).toBe(true)
  })
})

describe('exportFileName', () => {
  test('compose un nom de fichier lisible et daté', () => {
    const tournoi = makeTournament(['A'], [], { name: 'Doublettes Été 2026' })

    expect(exportFileName(tournoi, new Date('2026-08-20T12:00:00Z'))).toBe(
      'doublettes-ete-2026-2026-08-20.json',
    )
  })

  test('retombe sur un nom générique quand le titre ne donne rien', () => {
    const tournoi = makeTournament(['A'], [], { name: '???' })

    expect(exportFileName(tournoi, new Date('2026-08-20T12:00:00Z'))).toBe('tournoi-2026-08-20.json')
  })
})
