import { describe, expect, test } from 'vitest'
import { advancePairings } from './pairing'
import { recordKey, teamProgress } from './progress'
import { isMatchPlayed } from './standings'
import { makeTournament } from './__fixtures__/build'
import type { Match, Tournament } from './types'

const noms = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `Équipe ${String(i + 1).padStart(2, '0')}`)

const tousLesMatchs = (t: Tournament): Match[] => t.rounds.flatMap((r) => r.matches)

const enCours = (t: Tournament): Match[] =>
  tousLesMatchs(t).filter((m) => m.teamBId !== null && !isMatchPlayed(m))

const paire = (m: Match): string => [m.teamAId, m.teamBId].sort().join('|')

/** Démarre un tournoi de n équipes : le premier appariement est fait. */
const demarrer = (n: number, seed = 1): Tournament =>
  advancePairings(makeTournament(noms(n), [], { seed }))

/** Saisit le score d'un match puis relance l'appariement. */
function terminer(t: Tournament, matchId: string, aGagne = true): Tournament {
  const rounds = t.rounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) =>
      m.id === matchId ? { ...m, scoreA: aGagne ? 13 : 7, scoreB: aGagne ? 7 : 13 } : m,
    ),
  }))
  return advancePairings({ ...t, rounds })
}

/**
 * Joue le tournoi jusqu'au bout, un match à la fois, dans l'ordre où ils
 * apparaissent : c'est le pire cas pour l'appariement au fil de l'eau.
 */
function jouerTout(n: number, seed = 1, aGagne: (i: number) => boolean = (i) => i % 3 !== 0): Tournament {
  let t = demarrer(n, seed)
  for (let i = 0; enCours(t).length > 0 && i < 500; i++) {
    t = terminer(t, (enCours(t)[0] as Match).id, aGagne(i))
  }
  return t
}

/** Le bilan d'une équipe juste avant sa partie numéro `round`. */
function bilanAvant(t: Tournament, teamId: string, round: number): string {
  let played = 0
  let won = 0
  let lost = 0
  for (const m of tousLesMatchs(t)) {
    if (m.round >= round) continue
    if (m.teamBId === null) {
      if (m.teamAId !== teamId) continue
      played += 1
      won += 1
      continue
    }
    if (!isMatchPlayed(m)) continue
    const cote = m.teamAId === teamId ? 'A' : m.teamBId === teamId ? 'B' : null
    if (!cote) continue
    const pour = (cote === 'A' ? m.scoreA : m.scoreB) as number
    const contre = (cote === 'A' ? m.scoreB : m.scoreA) as number
    played += 1
    if (pour > contre) won += 1
    else if (pour < contre) lost += 1
  }
  return recordKey({ played, won, lost })
}

/** Nombre de victoires d'une équipe juste avant sa partie numéro `round`. */
function victoiresAvant(t: Tournament, teamId: string, round: number): number {
  let victoires = 0
  for (const m of tousLesMatchs(t)) {
    if (m.round >= round) continue
    if (m.teamBId === null) {
      if (m.teamAId === teamId) victoires += 1
      continue
    }
    if (!isMatchPlayed(m)) continue
    const cote = m.teamAId === teamId ? 'A' : m.teamBId === teamId ? 'B' : null
    if (!cote) continue
    const pour = (cote === 'A' ? m.scoreA : m.scoreB) as number
    const contre = (cote === 'A' ? m.scoreB : m.scoreA) as number
    if (pour > contre) victoires += 1
  }
  return victoires
}

describe('advancePairings — démarrage', () => {
  test('apparie toutes les équipes au premier appel', () => {
    const t = demarrer(8)

    expect(tousLesMatchs(t)).toHaveLength(4)
    expect(new Set(tousLesMatchs(t).flatMap((m) => [m.teamAId, m.teamBId])).size).toBe(8)
  })

  test('n’apparie rien sans équipe', () => {
    expect(tousLesMatchs(demarrer(0))).toEqual([])
  })

  test('deux graines différentes donnent des tirages différents', () => {
    expect(tousLesMatchs(demarrer(12, 1)).map(paire)).not.toEqual(
      tousLesMatchs(demarrer(12, 2)).map(paire),
    )
  })

  test('deux appels sur le même état donnent le même résultat', () => {
    const base = makeTournament(noms(10))

    expect(advancePairings(base)).toEqual(advancePairings(base))
  })

  test('relancer sur un tournoi déjà apparié n’ajoute rien', () => {
    const t = demarrer(8)

    expect(advancePairings(t)).toEqual(t)
  })
})

describe('advancePairings — enchaînement au fil de l’eau', () => {
  test('une seule équipe libérée attend : personne ne repart seul', () => {
    const t = demarrer(12)
    const premier = enCours(t)[0] as Match

    const apres = terminer(t, premier.id)

    expect(tousLesMatchs(apres)).toHaveLength(6)
  })

  test('deux matchs terminés relancent aussitôt les quatre équipes', () => {
    const t = demarrer(12)
    const [m1, m2] = enCours(t) as [Match, Match]

    const apres = terminer(terminer(t, m1.id), m2.id)

    // Les 6 matchs du tour 1, plus 2 nouveaux : gagnants ensemble, perdants ensemble.
    const nouveaux = tousLesMatchs(apres).filter((m) => m.round === 2)
    expect(nouveaux).toHaveLength(2)
    expect(new Set(nouveaux.flatMap((m) => [m.teamAId, m.teamBId]))).toEqual(
      new Set([m1.teamAId, m1.teamBId, m2.teamAId, m2.teamBId]),
    )
  })

  test('les deux gagnants se retrouvent, les deux perdants aussi', () => {
    const t = demarrer(12)
    const [m1, m2] = enCours(t) as [Match, Match]

    const apres = terminer(terminer(t, m1.id, true), m2.id, true)
    const nouveaux = tousLesMatchs(apres).filter((m) => m.round === 2)
    const gagnants = new Set([m1.teamAId, m2.teamAId])

    for (const m of nouveaux) {
      expect(gagnants.has(m.teamAId)).toBe(gagnants.has(m.teamBId as string))
    }
  })
})

describe('advancePairings — gagnant contre gagnant', () => {
  test.each([8, 12, 16, 24])(
    'toute opposition non signalée « flotteur » réunit deux bilans identiques (%i équipes)',
    (n) => {
      const t = jouerTout(n)

      for (const m of tousLesMatchs(t)) {
        if (m.teamBId === null || m.isFloater === true) continue
        expect(bilanAvant(t, m.teamAId, m.round)).toBe(bilanAvant(t, m.teamBId, m.round))
      }
    },
  )

  test.each([8, 12, 16, 24])(
    'un flotteur reste l’exception, jamais la règle (%i équipes)',
    (n) => {
      const t = jouerTout(n)
      const matchs = tousLesMatchs(t).filter((m) => m.teamBId !== null)
      const flotteurs = matchs.filter((m) => m.isFloater === true)

      expect(flotteurs.length).toBeLessThan(matchs.length / 3)
    },
  )

  test.each([8, 10, 12, 16, 20, 24])(
    'un flotteur ne descend que d’un cran (%i équipes)',
    (n) => {
      const t = jouerTout(n)

      for (const m of tousLesMatchs(t).filter((x) => x.isFloater === true)) {
        const a = victoiresAvant(t, m.teamAId, m.round)
        const b = victoiresAvant(t, m.teamBId as string, m.round)
        expect(Math.abs(a - b)).toBeLessThanOrEqual(2)
      }
    },
  )
})

describe('advancePairings — flotteur', () => {
  test('un groupe impair fait descendre une équipe d’un cran', () => {
    // 6 équipes : le tour 1 donne 3 gagnants et 3 perdants, donc un flotteur.
    const t = jouerTout(6)
    const flotteurs = tousLesMatchs(t).filter((m) => m.isFloater === true)

    expect(flotteurs.length).toBeGreaterThan(0)
    for (const m of flotteurs) {
      const a = bilanAvant(t, m.teamAId, m.round)
      const b = bilanAvant(t, m.teamBId as string, m.round)
      expect(a).not.toBe(b)
    }
  })

  test('un effectif pair ne produit jamais d’équipe exempte', () => {
    for (const n of [6, 8, 10, 12, 14]) {
      const t = jouerTout(n)
      expect(tousLesMatchs(t).filter((m) => m.teamBId === null)).toEqual([])
    }
  })
})

describe('advancePairings — garanties du tournoi', () => {
  test.each([6, 7, 8, 9, 12, 13, 16, 21, 24])(
    'chaque équipe joue exactement quatre parties (%i équipes)',
    (n) => {
      const t = jouerTout(n)
      const avancement = teamProgress(t)

      for (const team of t.teams) {
        expect(avancement.get(team.id)?.played).toBe(4)
      }
    },
  )

  test.each([7, 8, 9, 10, 12, 13, 16, 20, 21, 24])(
    'aucune équipe ne rejoue le même adversaire (%i équipes)',
    (n) => {
      const oppositions = tousLesMatchs(jouerTout(n))
        .filter((m) => m.teamBId !== null)
        .map(paire)

      expect(new Set(oppositions).size).toBe(oppositions.length)
    },
  )

  test('à six équipes, les adversaires frais finissent par manquer : la revanche est signalée', () => {
    // 6 équipes et 4 tours : chacune doit affronter 4 des 5 autres. Les
    // contraintes de bilan rendent parfois la revanche inévitable — elle doit
    // alors être visible, jamais silencieuse.
    for (let seed = 1; seed <= 25; seed++) {
      const t = jouerTout(6, seed)
      const oppositions = tousLesMatchs(t)
        .filter((m) => m.teamBId !== null)
        .map(paire)
      const rejouees = oppositions.length - new Set(oppositions).size
      const signalees = tousLesMatchs(t).filter((m) => m.isRematch === true).length

      expect(signalees).toBe(rejouees)
    }
  })

  test.each([6, 8, 10, 12, 14, 16, 20, 24])(
    'un effectif pair ne distribue jamais de victoire par forfait (%i équipes)',
    (n) => {
      for (let seed = 1; seed <= 10; seed++) {
        expect(tousLesMatchs(jouerTout(n, seed)).filter((m) => m.teamBId === null)).toEqual([])
      }
    },
  )

  test.each([7, 9, 13, 21])(
    'sur un effectif impair, une équipe différente est exempte à chaque fois (%i équipes)',
    (n) => {
      const exemptees = tousLesMatchs(jouerTout(n))
        .filter((m) => m.teamBId === null)
        .map((m) => m.teamAId)

      expect(exemptees.length).toBe(4)
      expect(new Set(exemptees).size).toBe(4)
    },
  )

  test('une équipe ne prend jamais plus d’une partie d’avance', () => {
    let t = demarrer(12)
    for (let i = 0; enCours(t).length > 0 && i < 500; i++) {
      const avancement = [...teamProgress(t).values()].map((p) => p.assigned)
      expect(Math.max(...avancement) - Math.min(...avancement)).toBeLessThanOrEqual(1)
      t = terminer(t, (enCours(t)[0] as Match).id, i % 2 === 0)
    }
  })

  test('les matchs générés portent des identifiants uniques et des scores vides', () => {
    const t = demarrer(9)
    const nouveaux = tousLesMatchs(t).filter((m) => m.teamBId !== null)

    expect(new Set(tousLesMatchs(t).map((m) => m.id)).size).toBe(tousLesMatchs(t).length)
    expect(nouveaux.every((m) => m.scoreA === null && m.scoreB === null)).toBe(true)
  })
})
