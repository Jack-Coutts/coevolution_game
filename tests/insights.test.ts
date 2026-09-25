import { describe, expect, it } from 'vitest'
import { RunHistory } from '@/game/history'
import { hints } from '@/game/insights'
import { STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'

type Row = Partial<Record<keyof typeof STAT, number>>

const frame = (tick: number): FrameData => ({ tick, prey: new Float32Array(), preds: new Float32Array(), bushes: new Float32Array(), events: new Float32Array() })

/** A history whose hour `t` holds `at(t)`; energy defaults to comfortable so only the tested notes fire. */
function history(until: number, at: (t: number) => Row): RunHistory {
  const h = new RunHistory(8760)
  for (let t = 0; t <= until; t++) {
    const row = new Float64Array(STAT_STRIDE)
    const values: Row = { preyEnergy: 0.6, predEnergy: 0.6, stock: 0.5, ...at(t) }
    for (const [k, v] of Object.entries(values)) row[STAT[k as keyof typeof STAT]] = v
    h.add(frame(t), row, 0)
  }
  return h
}

describe('field notes', () => {
  it('says the meadow is holding steady when counts and the trend are flat', () => {
    const h = history(500, () => ({ prey: 100, pred: 10 }))
    expect(hints(h, 500)).toEqual([{ id: 'steady', tone: 'good', text: 'Holding steady: 100 rabbits and 10 foxes, with bushes 50% full.' }])
  })

  it('does not say "holding steady" while the forecast triples the rabbits', () => {
    // Rabbits double every 10 days with bushes 64% full: no boom warning (bushes are not low), but not steady either.
    const h = history(500, (t) => ({ prey: Math.round(100 * 2 ** ((t - 260) / 240)), pred: 10, stock: 0.64 }))
    expect(hints(h, 500)).toEqual([{
      id: 'trend',
      tone: 'info',
      text: 'No warnings yet, but the meadow is changing: at the current trend, about 474 rabbits and 10 foxes by 4 Oct (now 200 and 10).',
    }])
  })

  it('keeps a danger note for a while after a one-hour blip, marked with its age', () => {
    // Rabbits fall from 60 to 30 over 10 days with 8 foxes (3.8 per fox), then one hour reads 60 rabbits.
    const h = history(500, (t) => ({ prey: t === 500 ? 60 : Math.round(60 - 30 * Math.min(1, Math.max(0, (t - 260) / 239))), pred: 8 }))
    const notes = hints(h, 500)
    expect(notes.map(n => n.id)).toEqual(['overhunt'])
    expect(notes[0].text).toBe('Only 3.8 rabbits per fox, and rabbits are falling. The foxes may eat the warren out. (1 h ago)')
  })

  it('puts the most urgent note first', () => {
    // A small rabbit boom on thin bushes (a warning) while both species are nearly gone (dangers).
    const h = history(500, (t) => ({ prey: Math.round(5 + 5 * Math.min(1, Math.max(0, (t - 260) / 240))), pred: 2, stock: 0.2 }))
    expect(hints(h, 500).map(n => `${n.tone} ${n.id}`)).toEqual(['danger fewfox', 'danger fewprey', 'warn boom'])
  })

  it('stops warning about a species once it has died out', () => {
    const h = history(500, (t) => ({ prey: t < 499 ? Math.max(1, Math.round(10 - (t - 400) / 10)) : 0, pred: 8 }))
    expect(hints(h, 500).map(n => n.id)).not.toContain('fewprey')
    expect(hints(h, 500).map(n => n.id)).not.toContain('overhunt')
    expect(hints(h, 498).find(n => n.id === 'fewprey')?.text).toBe('Only 1 rabbit left.')
  })
})
