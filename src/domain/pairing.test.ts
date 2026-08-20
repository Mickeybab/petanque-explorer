import { describe, expect, test } from 'vitest'
import { pairRound } from './pairing'
import { makeTournament } from './__fixtures__/build'
import type { Match, Tournament } from './types'

const noms = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `Équipe ${String(i + 1).padStart(2, '0')}`)

/** Clé d'opposition indépendante de l'ordre des deux équipes. */
const paire = (m: Match): string => [m.teamAId, m.teamBId].sort().join('|')

/**
 * Joue un tournoi complet : à chaque tour on apparie, puis on remplit les
 * scores en faisant gagner l'équipe au plus petit numéro. Ce classement
 * strictement ordonné est le pire cas pour la contrainte « pas de revanche ».
 */
function jouerTournoi(nbEquipes: number, nbTours: number): Tournament {
  const tournoi = makeTournament(noms(nbEquipes))
  for (let r = 1; r <= nbTours; r++) {
    const matches = pairRound(tournoi, r).map((m) => {
      if (m.teamBId === null) return m
      const favori = m.teamAId < m.teamBId ? 'A' : 'B'
      return { ...m, scoreA: favori === 'A' ? 13 : 6, scoreB: favori === 'A' ? 6 : 13 }
    })
    tournoi.rounds.push({ number: r, matches })
  }
  return tournoi
}

describe('pairRound — composition du tour', () => {
  test('un effectif pair produit un match par paire d’équipes', () => {
    const matches = pairRound(makeTournament(noms(8)), 1)

    expect(matches).toHaveLength(4)
    expect(matches.every((m) => m.teamBId !== null)).toBe(true)
  })

  test('chaque équipe joue exactement une fois par tour', () => {
    const matches = pairRound(makeTournament(noms(8)), 1)

    const engagees = matches.flatMap((m) => [m.teamAId, m.teamBId]).filter((id) => id !== null)
    expect(new Set(engagees).size).toBe(8)
  })

  test('un effectif impair produit une équipe exempte et personne d’oublié', () => {
    const matches = pairRound(makeTournament(noms(7)), 1)

    const byes = matches.filter((m) => m.teamBId === null)
    expect(byes).toHaveLength(1)
    expect(matches).toHaveLength(4)

    const engagees = matches.flatMap((m) => [m.teamAId, m.teamBId]).filter((id) => id !== null)
    expect(new Set(engagees).size).toBe(7)
  })

  test('les matchs générés portent le bon tour, des scores vides et des ids uniques', () => {
    const matches = pairRound(makeTournament(noms(6)), 3)

    expect(matches.every((m) => m.round === 3)).toBe(true)
    expect(matches.every((m) => m.scoreA === null && m.scoreB === null)).toBe(true)
    expect(new Set(matches.map((m) => m.id)).size).toBe(matches.length)
  })

  test('un tournoi à une seule équipe la déclare exempte', () => {
    const matches = pairRound(makeTournament(noms(1)), 1)

    expect(matches).toHaveLength(1)
    expect(matches[0]?.teamBId).toBeNull()
  })

  test('un tournoi sans équipe ne produit aucun match', () => {
    expect(pairRound(makeTournament([]), 1)).toEqual([])
  })
})

describe('pairRound — reproductibilité', () => {
  test('deux appels sur le même tournoi donnent le même appariement', () => {
    const tournoi = makeTournament(noms(10))

    expect(pairRound(tournoi, 1)).toEqual(pairRound(tournoi, 1))
  })

  test('deux graines différentes donnent des tirages différents au tour 1', () => {
    const a = pairRound(makeTournament(noms(12), [], { seed: 1 }), 1)
    const b = pairRound(makeTournament(noms(12), [], { seed: 2 }), 1)

    expect(a.map(paire)).not.toEqual(b.map(paire))
  })
})

describe('pairRound — pas de revanche', () => {
  test.each([8, 12, 16, 24, 40])(
    'aucune équipe ne rejoue le même adversaire sur 4 tours (%i équipes)',
    (nbEquipes) => {
      const tournoi = jouerTournoi(nbEquipes, 4)

      const oppositions = tournoi.rounds
        .flatMap((r) => r.matches)
        .filter((m) => m.teamBId !== null)
        .map(paire)

      expect(new Set(oppositions).size).toBe(oppositions.length)
    },
  )

  test.each([7, 13, 21])(
    'aucune revanche non plus sur un effectif impair (%i équipes)',
    (nbEquipes) => {
      const tournoi = jouerTournoi(nbEquipes, 4)

      const oppositions = tournoi.rounds
        .flatMap((r) => r.matches)
        .filter((m) => m.teamBId !== null)
        .map(paire)

      expect(new Set(oppositions).size).toBe(oppositions.length)
    },
  )

  test('quand aucune solution n’existe, la revanche est autorisée et signalée', () => {
    // Deux équipes seulement : le tour 2 ne peut être qu'une revanche.
    const tournoi = makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', 13, 4]]])

    const matches = pairRound(tournoi, 2)

    expect(matches).toHaveLength(1)
    expect(matches[0]?.isRematch).toBe(true)
  })

  test('un appariement sans revanche n’est jamais signalé comme revanche', () => {
    const matches = pairRound(makeTournament(noms(8)), 1)

    expect(matches.every((m) => m.isRematch !== true)).toBe(true)
  })
})

describe('pairRound — bye tournant', () => {
  test('sur un effectif impair, une équipe différente est exempte à chaque tour', () => {
    const tournoi = jouerTournoi(9, 4)

    const exemptees = tournoi.rounds
      .flatMap((r) => r.matches)
      .filter((m) => m.teamBId === null)
      .map((m) => m.teamAId)

    expect(exemptees).toHaveLength(4)
    expect(new Set(exemptees).size).toBe(4)
  })

  test('le bye redescend sur une équipe déjà exemptée seulement si tout le monde l’a été', () => {
    // 3 équipes, 4 tours : au 4e tour, les 3 ont déjà eu leur bye.
    const tournoi = jouerTournoi(3, 4)

    const exemptees = tournoi.rounds
      .flatMap((r) => r.matches)
      .filter((m) => m.teamBId === null)
      .map((m) => m.teamAId)

    expect(new Set(exemptees).size).toBe(3)
  })
})

describe('pairRound — système suisse', () => {
  test('au tour 2, les équipes s’affrontent à nombre de victoires égal', () => {
    const tournoi = jouerTournoi(8, 1)

    const matches = pairRound(tournoi, 2)
    const vainqueursTour1 = new Set(
      tournoi.rounds[0]?.matches.map((m) =>
        (m.scoreA as number) > (m.scoreB as number) ? m.teamAId : m.teamBId,
      ),
    )

    for (const m of matches) {
      expect(vainqueursTour1.has(m.teamAId)).toBe(vainqueursTour1.has(m.teamBId))
    }
  })
})
