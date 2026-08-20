import { describe, expect, test } from 'vitest'
import { computeStandings } from './standings'
import { makeTournament } from './__fixtures__/build'

/** Raccourci : le classement sous forme de noms, dans l'ordre. */
const ordre = (t: Parameters<typeof computeStandings>[0]): string[] =>
  computeStandings(t).map((s) => s.name)

describe('computeStandings', () => {
  test('un tournoi sans match donne toutes les équipes à zéro', () => {
    const classement = computeStandings(makeTournament(['Alice', 'Bob']))

    expect(classement).toHaveLength(2)
    expect(classement[0]).toMatchObject({
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      rank: 1,
    })
    expect(classement[1]).toMatchObject({ rank: 1 })
  })

  test('un match terminé crédite victoire et points aux deux équipes', () => {
    const classement = computeStandings(
      makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', 13, 5]]]),
    )

    const alice = classement.find((s) => s.name === 'Alice')
    const bob = classement.find((s) => s.name === 'Bob')

    expect(alice).toMatchObject({
      played: 1,
      won: 1,
      lost: 0,
      pointsFor: 13,
      pointsAgainst: 5,
      diff: 8,
    })
    expect(bob).toMatchObject({
      played: 1,
      won: 0,
      lost: 1,
      pointsFor: 5,
      pointsAgainst: 13,
      diff: -8,
    })
  })

  test('un match dont les scores ne sont pas saisis est ignoré', () => {
    const classement = computeStandings(
      makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', null, null]]]),
    )

    expect(classement.every((s) => s.played === 0)).toBe(true)
  })

  test('un match à moitié saisi est ignoré', () => {
    const classement = computeStandings(
      makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', 13, null]]]),
    )

    expect(classement.every((s) => s.played === 0)).toBe(true)
  })

  test('une équipe exempte est créditée d’une victoire 13-7', () => {
    const classement = computeStandings(
      makeTournament(['Alice', 'Bob', 'Carla'], [[['Alice', 'Bob', 13, 9], ['Carla', null, null, null]]]),
    )

    expect(classement.find((s) => s.name === 'Carla')).toMatchObject({
      played: 1,
      won: 1,
      lost: 0,
      pointsFor: 13,
      pointsAgainst: 7,
      diff: 6,
    })
  })

  test('une égalité ne donne de victoire à personne', () => {
    const classement = computeStandings(
      makeTournament(['Alice', 'Bob'], [[['Alice', 'Bob', 11, 11]]]),
    )

    expect(classement.find((s) => s.name === 'Alice')).toMatchObject({
      played: 1,
      won: 0,
      drawn: 1,
      lost: 0,
    })
    expect(classement.find((s) => s.name === 'Bob')).toMatchObject({ drawn: 1 })
  })

  test('les parties gagnées priment sur le goal-average', () => {
    // Bob a un goal-average énorme mais une seule victoire ;
    // Alice en a deux et doit passer devant.
    const tournoi = makeTournament(
      ['Alice', 'Bob', 'Carla', 'David'],
      [
        [['Alice', 'Carla', 13, 12], ['Bob', 'David', 13, 0]],
        [['Alice', 'David', 13, 12], ['Bob', 'Carla', 3, 13]],
      ],
    )

    expect(ordre(tournoi)[0]).toBe('Alice')
  })

  test('à égalité de victoires, le goal-average départage', () => {
    const tournoi = makeTournament(
      ['Alice', 'Bob', 'Carla', 'David'],
      [[['Alice', 'Carla', 13, 2], ['Bob', 'David', 13, 11]]],
    )

    expect(ordre(tournoi).slice(0, 2)).toEqual(['Alice', 'Bob'])
  })

  test('à égalité de victoires et de goal-average, les points marqués départagent', () => {
    // Alice : +8 en marquant 13. Bob : +8 en marquant 10.
    const tournoi = makeTournament(
      ['Alice', 'Bob', 'Carla', 'David'],
      [[['Alice', 'Carla', 13, 5], ['Bob', 'David', 10, 2]]],
    )

    expect(ordre(tournoi).slice(0, 2)).toEqual(['Alice', 'Bob'])
  })

  test('deux équipes strictement à égalité partagent le même rang', () => {
    const classement = computeStandings(
      makeTournament(
        ['Alice', 'Bob', 'Carla', 'David'],
        [[['Alice', 'Carla', 13, 5], ['Bob', 'David', 13, 5]]],
      ),
    )

    expect(classement[0]?.rank).toBe(1)
    expect(classement[1]?.rank).toBe(1)
    expect(classement[2]?.rank).toBe(3)
  })

  test('à égalité parfaite, l’ordre alphabétique tranche l’affichage', () => {
    const tournoi = makeTournament(['Zoé', 'Alice'], [])

    expect(ordre(tournoi)).toEqual(['Alice', 'Zoé'])
  })
})
