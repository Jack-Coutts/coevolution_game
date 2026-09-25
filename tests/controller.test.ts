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
import { CHARGES, COOLDOWN, GameController } from '@/game/controller'
import * as probes from '../scripts/action-probes'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  mock.messages.length = 0
  mock.save.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())

function ready(endless = false) {
  const game = new GameController()
  const sim = new Sim(deriveParams(STABLE_PRESET), 7)
  game.configure({ levers: STABLE_PRESET, base: STABLE_PRESET, scenario: 'stable', seed: 7, endless })
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
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(12 * STAT_STRIDE), head: 12, end: { tick: 12, survived: false, preyEnd: 0, predEnd: 3, voleEnd: 0, species: ['prey', 'pred'] }, evolution: [] })
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

it('asks the worker to save the displayed hour, not the hours it ran ahead', () => {
  const { game, runId, frame } = ready()
  game.stepBy(5)
  const frames = Array.from({ length: 12 }, (_, i) => ({ ...frame, tick: i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(12 * STAT_STRIDE), head: 12, end: null, evolution: [] })
  game.save()
  expect(mock.messages.at(-1)).toMatchObject({ type: 'save', at: 5 })
  game.dispose()
})

it('saves the latest hour seen, not a replayed one, and keeps no history after it', async () => {
  const { game, sim, runId, frame } = ready()
  game.stepBy(12)
  const frames = Array.from({ length: 20 }, (_, i) => ({ ...frame, tick: i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(20 * STAT_STRIDE), head: 20, end: null, evolution: [] })
  game.seek(5)
  game.save()
  expect(mock.messages.at(-1)).toMatchObject({ type: 'save', at: 12 })
  for (let i = 0; i < 12; i++) sim.step()
  mock.receive({ type: 'saved', runId, state: sim.save() })
  await Promise.resolve()
  const saved = mock.save.mock.calls.at(-1)?.[0]
  expect([saved.state.tick, saved.history.head, Math.max(...saved.history.frames.map(([t]: [number]) => t))]).toEqual([12, 12, 12])
  game.dispose()
})

// Endless intervention budget: 1 Dec is hour 2176 and the next 1 Sep is hour 8752.
type Game = ReturnType<typeof ready>['game']
type Frame = ReturnType<typeof ready>['frame']
function advanceTo(game: Game, runId: number, frame: Frame, to: number) {
  const from = game.history.head
  game.stepBy(to - game.displayTickValue)
  const frames = Array.from({ length: to - from }, (_, i) => ({ ...frame, tick: from + i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(frames.length * STAT_STRIDE), head: to, end: null, evolution: [] })
  expect(game.displayTickValue).toBe(to)
  game.pause() // refresh the snapshot, which frames only update every 100 ms
}
function act(game: Game, runId: number, frame: Frame) {
  const at = Math.floor(game.displayTickValue)
  expect(game.canIntervene()).toBe(true)
  game.intervene('rain')
  mock.receive({ type: 'intervened', runId, action: 'rain', from: at, tick: at + 1, frame: { ...frame, tick: at + 1 }, stats: row(), evolution: [], end: null })
}
function spendFour(game: Game, runId: number, frame: Frame) {
  for (const at of [100, 500, 900, 1300]) { advanceTo(game, runId, frame, at); act(game, runId, frame) }
}

it('Endless spends uses, waits out the cooldown, and renews one at each season start', () => {
  const { game, runId, frame } = ready(true)
  game.setAutoPause(false)
  spendFour(game, runId, frame)
  expect([game.getSnapshot().charges, game.getSnapshot().cooldownUntil, game.getSnapshot().nextRenewal]).toEqual([0, 1700, 2176])
  advanceTo(game, runId, frame, 2175)
  expect(game.canIntervene()).toBe(false)
  advanceTo(game, runId, frame, 2176)
  expect([game.getSnapshot().charges, game.getSnapshot().nextRenewal]).toEqual([1, 4336])
  act(game, runId, frame)
  expect(game.getSnapshot().charges).toBe(0)
  advanceTo(game, runId, frame, 4336)
  // A renewal while the cooldown runs is kept, but cannot be used until the cooldown ends.
  expect([game.getSnapshot().charges, game.canIntervene()]).toEqual([1, true])
  advanceTo(game, runId, frame, 8752)
  expect([game.getSnapshot().charges, game.getSnapshot().nextRenewal]).toEqual([3, 10936])
  advanceTo(game, runId, frame, 10936)
  expect(game.getSnapshot().charges).toBe(4)
  advanceTo(game, runId, frame, 13096)
  expect(game.getSnapshot().charges).toBe(4)
  game.dispose()
})

it('Endless cannot act again inside the cooldown even after a renewal', () => {
  const { game, runId, frame } = ready(true)
  game.setAutoPause(false)
  advanceTo(game, runId, frame, 2000)
  act(game, runId, frame)
  advanceTo(game, runId, frame, 2176)
  expect([game.getSnapshot().charges, game.canIntervene()]).toEqual([4, false])
  advanceTo(game, runId, frame, 2400)
  expect(game.canIntervene()).toBe(true)
  game.dispose()
})

it('the one-year challenge keeps four uses for the year with no renewal', () => {
  const { game, runId, frame } = ready(false)
  game.setAutoPause(false)
  spendFour(game, runId, frame)
  advanceTo(game, runId, frame, 8700)
  const snap = game.getSnapshot()
  expect([snap.charges, snap.nextRenewal, game.canIntervene()]).toEqual([0, null, false])
  game.dispose()
})

it('replaying the past neither adds nor loses uses', () => {
  const { game, runId, frame } = ready(true)
  game.setAutoPause(false)
  spendFour(game, runId, frame)
  advanceTo(game, runId, frame, 2300)
  expect(game.getSnapshot().charges).toBe(1)
  for (let i = 0; i < 3; i++) {
    game.seek(1000)
    expect(game.getSnapshot().charges).toBe(1)
    game.seek(2300)
    expect(game.getSnapshot().charges).toBe(1)
  }
  game.dispose()
})

it('gives back a use the worker could not apply', () => {
  const { game, runId, frame } = ready(true)
  game.setAutoPause(false)
  advanceTo(game, runId, frame, 50)
  game.intervene('rain')
  expect(game.getSnapshot().charges).toBe(3)
  mock.receive({ type: 'intervened', runId, action: 'rain', from: 50, tick: 50, frame: { ...frame, tick: 50 }, stats: row(), evolution: [], end: null })
  expect([game.getSnapshot().charges, game.getSnapshot().cooldownUntil]).toEqual([4, 0])
  game.dispose()
})

it('saving and resuming keeps the uses, cooldown and next renewal, and old saves load', async () => {
  const { game, sim, runId, frame } = ready(true)
  game.setAutoPause(false)
  spendFour(game, runId, frame)
  advanceTo(game, runId, frame, 2200)
  act(game, runId, frame)
  advanceTo(game, runId, frame, 2300)
  game.save()
  mock.receive({ type: 'saved', runId, state: { ...sim.save(), tick: 2300 } })
  await Promise.resolve()
  const save = mock.save.mock.calls.at(-1)?.[0]
  expect([save.charges, save.cooldownUntil, save.interventions.length]).toEqual([0, 2600, 5])
  game.dispose()

  const resume = (data: typeof save) => {
    const g = new GameController()
    g.restore(data)
    mock.receive({ type: 'ready', restored: true, runId: g.getSnapshot().runId, cover: [], frame: { ...frame, tick: 2300 }, stats: row(), evolution: summarizeEvolution(sim) })
    return g
  }
  const g = resume(save)
  let snap = g.getSnapshot()
  expect([snap.tick, snap.charges, snap.cooldownUntil, snap.nextRenewal]).toEqual([2300, 0, 2600, 4336])
  // A saved `charges` that disagrees with the recorded interventions cannot duplicate a use.
  const g2 = resume({ ...save, charges: 4 })
  expect(g2.getSnapshot().charges).toBe(0)
  // An early save without the budget fields resumes with a full allowance and no cooldown.
  const { charges: _c, cooldownUntil: _u, interventions: _i, ...old } = save
  const g3 = resume(old)
  snap = g3.getSnapshot()
  expect([snap.charges, snap.cooldownUntil, snap.interventions]).toEqual([4, 0, []])
  for (const x of [g, g2, g3]) x.dispose()
})

it('ignores a seek while an intervention is in flight, so the run is not ended early', () => {
  const { game, runId, frame } = ready()
  game.stepBy(5)
  const frames = Array.from({ length: 12 }, (_, i) => ({ ...frame, tick: i + 1 }))
  mock.receive({ type: 'frames', runId, frames, stats: new Float64Array(12 * STAT_STRIDE), head: 12, end: { tick: 12, survived: false, preyEnd: 0, predEnd: 3, voleEnd: 0, species: ['prey', 'pred'] }, evolution: [] })
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

it('the intervention experiment uses the game budget', () => {
  expect([probes.CHARGES, probes.COOLDOWN]).toEqual([CHARGES, COOLDOWN])
})
