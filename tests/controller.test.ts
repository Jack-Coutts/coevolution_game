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

it('asks before resetting a run that has gone past a week, but not during planning', () => {
  const { game, runId, frame } = ready()
  expect(game.resetNeedsConfirm()).toBe(false)
  game.stepBy(168)
  const frames = Array.from({ length: 168 }, (_, i) => ({ ...frame, tick: i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(168 * STAT_STRIDE), head: 168, end: null, evolution: [] })
  expect(game.resetNeedsConfirm()).toBe(false)
  game.stepBy(1)
  mock.receive({ type: 'frames', runId, frames: [{ ...frame, tick: 169 }], stats: row(), head: 169, end: null, evolution: [] })
  expect(game.resetNeedsConfirm()).toBe(true)
  game.dispose()
})

it('pauses once when a new red note appears while playing live, if the player wants that', () => {
  const { game, runId, frame } = ready()
  const loop = (now: number) => (game as unknown as { loop(now: number): void }).loop(now)
  // 20 days of 40 rabbits and 4 foxes, then the rabbits fall towards 12 over the next 10 days.
  const row = (t: number) => {
    const r = new Float64Array(STAT_STRIDE)
    r[STAT.prey] = t <= 480 ? 40 : Math.round(40 - 28 * (t - 480) / 240)
    r[STAT.pred] = 4
    r[STAT.preyEnergy] = r[STAT.predEnergy] = 0.6
    r[STAT.stock] = 0.5
    return r
  }
  let head = 0
  const answer = () => {
    const ask = mock.messages.splice(0).filter(m => m.type === 'advance').at(-1)
    if (ask?.type !== 'advance') return
    const ticks = Array.from({ length: ask.target - head }, (_, i) => head + i + 1)
    const stats = new Float64Array(ticks.length * STAT_STRIDE)
    ticks.forEach((t, i) => stats.set(row(t), i * STAT_STRIDE))
    head = ask.target
    mock.receive({ type: 'frames', runId, frames: ticks.map(tick => ({ ...frame, tick })), stats, head, end: null, evolution: [] })
  }
  game.setSpeed(0)
  game.play()
  // 12 hours per second, in 100 ms frames, with the worker answering every request.
  let now = performance.now()
  for (let i = 0; i < 1000 && game.getSnapshot().playing; i++) { loop((now += 100)); answer() }
  const snap = game.getSnapshot()
  expect(snap.playing).toBe(false)
  expect(snap.pausedFor?.id).toBe('overhunt')
  // The ratio first drops below 5 rabbits per fox at hour 656 (19 rabbits, 4 foxes).
  expect(snap.tick).toBeGreaterThanOrEqual(656)
  expect(snap.tick).toBeLessThanOrEqual(658)
  game.play()
  expect(game.getSnapshot().pausedFor).toBeNull()
  game.setAutoPause(false)
  game.dispose()
})

it('reports the real playback rate when the worker cannot keep up with the chosen speed', () => {
  const { game, runId, frame } = ready()
  const loop = (now: number) => (game as unknown as { loop(now: number): void }).loop(now)
  let head = 0
  // The worker delivers only 4 hours per 100 ms frame: 40 hours a second against 1 wk/s (168).
  const answer = () => {
    if (!mock.messages.splice(0).some(m => m.type === 'advance')) return
    const ticks = [head + 1, head + 2, head + 3, head + 4]
    head += 4
    mock.receive({ type: 'frames', runId, frames: ticks.map(tick => ({ ...frame, tick })), stats: new Float64Array(4 * STAT_STRIDE), head, end: null, evolution: [] })
  }
  game.setAutoPause(false)
  game.setSpeed(3)
  game.play()
  let now = performance.now()
  for (let i = 0; i < 45; i++) { loop((now += 100)); answer() }
  expect(Math.round(game.getSnapshot().effectiveTps ?? 0)).toBe(40)
  game.setSpeed(0)
  expect(game.getSnapshot().effectiveTps).toBeNull()
  game.dispose()
})

it('ignores a seek while an intervention is in flight, so the run is not ended early', () => {
  const { game, runId, frame } = ready()
  game.stepBy(5)
  const frames = Array.from({ length: 12 }, (_, i) => ({ ...frame, tick: i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(12 * STAT_STRIDE), head: 12, end: { tick: 12, survived: false, preyEnd: 0, predEnd: 3 }, evolution: [] })
  game.intervene('releasePrey')
  game.seek(12)
  mock.receive({ type: 'intervened', runId, action: 'releasePrey', from: 5, tick: 6, frame: { ...frame, tick: 6 }, stats: row(), evolution: [], end: null })
  const s = game.getSnapshot()
  expect([s.phase, s.end, s.tick, s.head, s.score]).toEqual(['running', null, 6, 6, null])
  game.dispose()
})

it('does not intervene at an hour the player has already watched, only at the latest hour seen', () => {
  const { game, runId, frame } = ready()
  game.stepBy(12)
  const frames = Array.from({ length: 12 }, (_, i) => ({ ...frame, tick: i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(12 * STAT_STRIDE), head: 12, end: null, evolution: [] })
  expect([game.displayTickValue, game.canIntervene()]).toEqual([12, true])
  game.seek(5)
  expect([game.displayTickValue, game.canIntervene()]).toEqual([5, false])
  game.seek(12)
  expect(game.canIntervene()).toBe(true)
  game.dispose()
})

