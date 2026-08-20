import { describe, expect, test } from 'vitest'
import { possibleNextKeys, recordKey, teamProgress } from './progress'
import { makeTournament } from './__fixtures__/build'

describe('teamProgress', () => {
  test('une équipe sans match n’a rien joué et n’est pas occupée', () => {
    const avancement = teamProgress(makeTournament(['Alice']))

    expect(avancement.get('t1')).toMatchObject({
      assigned: 0,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      busy: false,
    })
  })

  test('un match en cours rend les deux équipes occupées sans compter de partie', () => {
    const avancement = teamProgress(
      makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', null, null]]]),
    )

    expect(avancement.get('t1')).toMatchObject({ assigned: 1, played: 0, busy: true })
    expect(avancement.get('t2')).toMatchObject({ assigned: 1, played: 0, busy: true })
  })

  test('un match terminé libère les deux équipes et enregistre le résultat', () => {
    const avancement = teamProgress(makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', 13, 6]]]))

    expect(avancement.get('t1')).toMatchObject({ assigned: 1, played: 1, won: 1, lost: 0, busy: false })
    expect(avancement.get('t2')).toMatchObject({ assigned: 1, played: 1, won: 0, lost: 1, busy: false })
  })

  test('une égalité ne compte ni victoire ni défaite', () => {
    const avancement = teamProgress(makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', 11, 11]]]))

    expect(avancement.get('t1')).toMatchObject({ won: 0, lost: 0, drawn: 1 })
  })

  test('une équipe exempte est libre aussitôt, avec une victoire et un bye', () => {
    const avancement = teamProgress(
      makeTournament(['Alice', 'Bob', 'Carla'], [[['Alice', 'Bob', 13, 6], ['Carla', null, null, null]]]),
    )

    expect(avancement.get('t3')).toMatchObject({
      assigned: 1,
      played: 1,
      won: 1,
      busy: false,
      byes: 1,
    })
  })

  test('une équipe ayant joué toutes ses parties est déclarée terminée', () => {
    const tournoi = makeTournament(['Alice', 'Bob'], [], { totalRounds: 1 })
    tournoi.rounds.push({
      number: 1,
      matches: [
        { id: 'm1', round: 1, teamAId: 't1', teamBId: 't2', scoreA: 13, scoreB: 2 },
      ],
    })

    expect(teamProgress(tournoi).get('t1')?.finished).toBe(true)
  })
})

describe('recordKey', () => {
  test('deux bilans identiques partagent la même clé', () => {
    expect(recordKey({ played: 2, won: 1, lost: 1 })).toBe(recordKey({ played: 2, won: 1, lost: 1 }))
  })

  test('un gagnant et un perdant n’ont pas la même clé', () => {
    expect(recordKey({ played: 1, won: 1, lost: 0 })).not.toBe(
      recordKey({ played: 1, won: 0, lost: 1 }),
    )
  })

  test('à victoires et défaites égales, un nul distingue les bilans', () => {
    // 1 victoire, 0 défaite, mais l'une a joué un nul de plus.
    expect(recordKey({ played: 1, won: 1, lost: 0 })).not.toBe(
      recordKey({ played: 2, won: 1, lost: 0 }),
    )
  })
})

describe('possibleNextKeys', () => {
  test('une équipe occupée peut encore devenir gagnante, perdante ou à égalité', () => {
    const cles = possibleNextKeys({ played: 1, won: 1, lost: 0 })

    expect(cles).toEqual(
      new Set([
        recordKey({ played: 2, won: 2, lost: 0 }),
        recordKey({ played: 2, won: 1, lost: 1 }),
        recordKey({ played: 2, won: 1, lost: 0 }),
      ]),
    )
  })
})
