import { expect, test } from 'claude-code/testing'

import { bar, cacheLine, cachePct, ctxLine, ctxOf } from './meters'

test('bar: rounds to the nearest cell and clamps', () => {
  expect(bar(0, 8)).toBe('▱▱▱▱▱▱▱▱')
  expect(bar(42, 8)).toBe('▰▰▰▱▱▱▱▱')
  expect(bar(42, 10)).toBe('▰▰▰▰▱▱▱▱▱▱')
  expect(bar(50, 4)).toBe('▰▰▱▱')
  expect(bar(100, 8)).toBe('▰▰▰▰▰▰▰▰')
  expect(bar(-5, 8)).toBe('▱▱▱▱▱▱▱▱')
  expect(bar(130, 8)).toBe('▰▰▰▰▰▰▰▰')
})

test('cache: read / all input, no dollar amount; nothing before the first turn', () => {
  expect(cacheLine(cachePct({ all: 100_000, read: 94_000 })!)).toBe('94% hit')
  expect(cacheLine(cachePct({ all: 10, read: 5 })!)).toBe('50% hit')
  expect(cachePct({ all: 0, read: 0 })).toBe(undefined)
})

test('ctx: bar, percent and used/window, no hint; nothing before the first response', () => {
  expect(ctxLine(ctxOf({ tokens: 84_000, window: 200_000, percent: 42 })!)).toBe('▰▰▰▰▱▱▱▱▱▱ 42%  84k/200k')
  expect(ctxLine(ctxOf({ tokens: 820_000, window: 1_000_000 })!)).toBe('▰▰▰▰▰▰▰▰▱▱ 82%  820k/1M')
  expect(ctxOf({ window: 200_000 })).toBe(undefined)
})
