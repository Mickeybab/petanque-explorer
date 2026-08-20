import { describe, expect, test } from 'vitest'
import { createRng, shuffle } from './rng'

describe('createRng', () => {
  test('deux générateurs de même graine produisent la même suite', () => {
    const a = createRng(42)
    const b = createRng(42)

    const suiteA = [a(), a(), a(), a(), a()]
    const suiteB = [b(), b(), b(), b(), b()]

    expect(suiteA).toEqual(suiteB)
  })

  test('deux graines différentes produisent des suites différentes', () => {
    const a = createRng(1)
    const b = createRng(2)

    expect([a(), a(), a()]).not.toEqual([b(), b(), b()])
  })

  test('les valeurs restent dans [0, 1[', () => {
    const rng = createRng(7)

    for (let i = 0; i < 500; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('shuffle', () => {
  test('conserve tous les éléments sans en perdre ni en dupliquer', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

    const melange = shuffle(source, createRng(3))

    expect([...melange].sort()).toEqual([...source].sort())
  })

  test('ne modifie pas le tableau source', () => {
    const source = ['a', 'b', 'c', 'd']

    shuffle(source, createRng(3))

    expect(source).toEqual(['a', 'b', 'c', 'd'])
  })

  test('la même graine produit toujours le même ordre', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

    const premier = shuffle(source, createRng(99))
    const second = shuffle(source, createRng(99))

    expect(premier).toEqual(second)
  })

  test('mélange réellement l’ordre des éléments', () => {
    const source = Array.from({ length: 20 }, (_, i) => i)

    const melange = shuffle(source, createRng(5))

    expect(melange).not.toEqual(source)
  })
})
