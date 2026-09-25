import { describe, expect, it } from 'vitest'
import { RunHistory } from '@/game/history'
import { hints, NOTICE_DAYS, upcoming } from '@/game/insights'
import { STABLE_PRESET } from '@/game/presets'
import { deriveParams } from '@/sim/levers'
import { SCENARIO_BY_ID, visibleSpans } from '@/sim/scenarios'
import { Sim } from '@/sim/sim'
import { tickAt } from '@/sim/time'
import { STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'

const OCT_1 = tickAt(1)
const DEC_1 = tickAt(3)
const MAY_1 = tickAt(8)
const { winter, drought, invasion, stable } = SCENARIO_BY_ID

describe('scenario warnings', () => {
  it(`announces weather and arrivals up to ${NOTICE_DAYS} days ahead, not after they start`, () => {
    expect(upcoming(winter, DEC_1 - 5 * 24, false)?.text).toBe('Harsh winter starts in 5 days (1 Dec).')
    expect(upcoming(winter, DEC_1 - NOTICE_DAYS * 24, false)?.text).toBe(`Harsh winter starts in ${NOTICE_DAYS} days (1 Dec).`)
    expect(upcoming(winter, DEC_1 - NOTICE_DAYS * 24 - 1, false)).toBeNull()
    expect(upcoming(winter, DEC_1, false)).toBeNull()
    expect(upcoming(drought, MAY_1 - 1, false)?.text).toBe('Drought starts in 1 day (1 May).')
    expect(upcoming(invasion, OCT_1 - 30, false)?.text).toBe('Foxes arrive in 2 days (1 Oct).')
    expect(upcoming(stable, 100, false)).toBeNull()
  })
  it('repeats weather warnings each Endless year, but the fox invasion happens once', () => {
    expect(upcoming(winter, 8760 + DEC_1 - 3 * 24, true)?.text).toBe('Harsh winter starts in 3 days (1 Dec).')
    expect(upcoming(drought, 2 * 8760 + MAY_1 - 24, true)?.text).toBe('Drought starts in 1 day (1 May).')
    expect(upcoming(winter, 8760 + DEC_1 - 3 * 24, false)).toBeNull()
    expect(upcoming(invasion, 8760 + OCT_1 - 24, true)).toBeNull()
  })
  it('puts the warning first among the field notes', () => {
    const h = new RunHistory(8760)
    for (let t = 0; t <= DEC_1 - 24; t++) {
      const f: FrameData = { tick: t, prey: new Float32Array(), preds: new Float32Array(), bushes: new Float32Array(), events: new Float32Array() }
      const row = new Float64Array(STAT_STRIDE)
      row[STAT.prey] = 150; row[STAT.pred] = 8; row[STAT.stock] = 0.5; row[STAT.preyEnergy] = 0.6; row[STAT.predEnergy] = 0.6
      h.add(f, row, 0)
    }
    const notes = hints(h, DEC_1 - 24, winter)
    expect(notes[0]).toMatchObject({ id: 'upcoming', tone: 'warn' })
    expect(notes.map(n => n.id)).toContain('steady')
    expect(hints(h, DEC_1 - 24).map(n => n.id)).not.toContain('upcoming')
  })
})

describe('scenario disturbances in Endless', () => {
  const endless = () => { const p = deriveParams(STABLE_PRESET); p.endless = true; return p }
  it('repeats the drought and the harsh winter every year', () => {
    const d = new Sim(endless(), 1, drought.disturbance)
    expect(d.regrowFactor(MAY_1)).toBe(0.35)
    expect(d.regrowFactor(8760 + MAY_1)).toBe(0.35)
    expect(d.regrowFactor(8760 + 100)).toBe(1)
    const w = new Sim(endless(), 1, winter.disturbance)
    expect(w.regrowFactor(2 * 8760 + DEC_1)).toBe(0.6)
    expect(w.metabolismFactor(2 * 8760 + DEC_1)).toBe(1.15)
    expect(visibleSpans(drought, 8760, 2 * 8760, true).map(s => s.from)).toEqual([8760 + MAY_1])
  })
  it('brings the fox pack only once', () => {
    const arrival = invasion.disturbance.arrivals[0]
    const arrived = (tick: number) => {
      const s = new Sim(endless(), 1, invasion.disturbance, { record: true })
      s.tick = tick - 1
      s.step()
      return s.events.filter(e => e.kind === 'arrived' && e.species === 'pred').length
    }
    expect(arrived(arrival.tick)).toBe(arrival.count)
    expect(arrived(8760 + arrival.tick)).toBe(0)
  })
})
