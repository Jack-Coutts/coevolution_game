import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FromWorker, ToWorker } from '@/worker/protocol'
import { STAT, STAT_STRIDE } from '@/worker/protocol'
import { summarizeEvolution } from '@/sim/evolution'
import { Sim } from '@/sim/sim'
import { deriveParams } from '@/sim/levers'
import { STABLE_PRESET } from '@/game/presets'

const mock = vi.hoisted(() => ({ messages: [] as ToWorker[], receive: (_message: FromWorker) => {}, save: vi.fn() }))
vi.mock('@/worker/sim.worker.ts?worker', () => ({ default: class {
  constructor() { mock.receive = message => this.onmessage({ data: message }) }
  onmessage: (event: { data: FromWorker }) => void = () => {}
  postMessage(message: ToWorker) { mock.messages.push(message) }
  terminate() {}
} }))
vi.mock('@/game/saves', () => ({ writeSave: mock.save }))
import { GameController } from '@/game/controller'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  mock.messages.length = 0
  mock.save.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())

function ready() {
  const game = new GameController()
  const sim = new Sim(deriveParams(STABLE_PRESET), 7)
  game.configure({ levers: STABLE_PRESET, base: STABLE_PRESET, scenario: 'stable', seed: 7, endless: false })
  const runId = game.getSnapshot().runId
  const frame = { tick: 0, prey: new Float32Array(), preds: new Float32Array(), bushes: new Float32Array(), events: new Float32Array() }
  mock.receive({ type: 'ready', runId, cover: [], frame, stats: new Float64Array(STAT_STRIDE), evolution: summarizeEvolution(sim) })
  return { game, sim, runId, frame }
}

it('saving during a chunked step cancels further advance requests', async () => {
  const { game, sim, runId, frame } = ready()
  game.stepBy(24)
  game.save()
  for (let i = 0; i < 6; i++) sim.step()
  mock.receive({ type: 'frames', runId, frames: [{ ...frame, tick: 6 }], stats: new Float64Array(STAT_STRIDE), head: 6, end: null, evolution: [] })
  mock.receive({ type: 'saved', runId, state: sim.save() })
  await Promise.resolve()
  expect(mock.messages.filter(m => m.type === 'advance')).toHaveLength(1)
  expect(game.getSnapshot().playing).toBe(false)
  expect(game.getSnapshot().tick).toBe(6)
  expect(mock.save.mock.calls.at(-1)?.[0].state.tick).toBe(6)
  game.dispose()
})

const row = () => new Float64Array(STAT_STRIDE)

it('starts the full cooldown at the hour the intervention was made', () => {
  const { game, runId, frame } = ready()
  game.play()
  game.intervene('rain')
  expect(mock.messages.at(-1)).toMatchObject({ type: 'intervene', action: 'rain', at: 0 })
  mock.receive({ type: 'intervened', runId, action: 'rain', from: 0, tick: 1, frame: { ...frame, tick: 1 }, stats: row(), evolution: [], end: null })
  expect(game.getSnapshot().cooldownUntil).toBe(400)
  expect(game.getSnapshot().charges).toBe(3)
  game.dispose()
})

it('intervenes at the displayed hour while paused and shows the result at once', () => {
  const { game, runId, frame } = ready()
  game.stepBy(5)
  // The worker overshoots the step target, as it does when it runs ahead of the display.
  const frames = Array.from({ length: 12 }, (_, i) => ({ ...frame, tick: i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(12 * STAT_STRIDE), head: 12, end: null, evolution: [] })
  expect([game.displayTickValue, game.history.head]).toEqual([5, 12])
  game.intervene('cullPred')
  expect(mock.messages.at(-1)).toMatchObject({ type: 'intervene', action: 'cullPred', at: 5 })
  expect(game.canIntervene()).toBe(false)
  const stats = row()
  stats[STAT.pred] = 4
  mock.receive({ type: 'intervened', runId, action: 'cullPred', from: 5, tick: 6, frame: { ...frame, tick: 6 }, stats, evolution: [], end: null })
  const snap = game.getSnapshot()
  expect([snap.tick, snap.head, snap.pred, snap.charges, snap.cooldownUntil]).toEqual([6, 6, 4, 3, 405])
  expect(snap.interventions).toEqual([{ tick: 6, action: 'cullPred' }])
  game.dispose()
})

it('allows an intervention while the worker has already reached an end the player has not seen', () => {
  const { game, runId, frame } = ready()
  game.stepBy(5)
  const frames = Array.from({ length: 12 }, (_, i) => ({ ...frame, tick: i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(12 * STAT_STRIDE), head: 12, end: { tick: 12, survived: false, preyEnd: 0, predEnd: 3 }, evolution: [] })
  expect(game.canIntervene()).toBe(true)
  game.intervene('releasePrey')
  mock.receive({ type: 'intervened', runId, action: 'releasePrey', from: 5, tick: 6, frame: { ...frame, tick: 6 }, stats: row(), evolution: [], end: null })
  expect(game.getSnapshot().end).toBeNull()
  game.dispose()
})
