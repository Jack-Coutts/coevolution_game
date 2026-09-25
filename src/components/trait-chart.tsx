import { memo } from 'react'
import type { EvolutionSample, TraitKey } from '@/sim/evolution'
import type { Species } from '@/sim/sim'
import { traitValue } from '@/game/insights'
import { cn } from '@/lib/utils'

const TRAIT_LABELS: Record<TraitKey, string> = { forage: 'Food seeking', flee: 'Threat avoidance', cruise: 'Cruising pace', hide: 'Cover seeking' }

const X0 = 34
const X1 = 290
const y = (value: number) => (118 - (value + 1) * 48).toFixed(1)
const TONE: Record<Species, { text: string; stroke: string; fill: string }> = {
  prey: { text: 'text-rabbit', stroke: 'stroke-rabbit', fill: 'fill-rabbit' },
  pred: { text: 'text-fox', stroke: 'stroke-fox', fill: 'fill-fox' },
}

/** The samples to plot, shared by every chart on the page. */
export interface TraitSeries {
  plotted: EvolutionSample[]
  founders: EvolutionSample | undefined
  from: number
  end: number
}

/** One inherited trait of one species over time: mean line, middle-80% band and founder mean (dashed). */
export const TraitChart = memo(function TraitChart({ series, species, trait }: { series: TraitSeries; species: Species; trait: TraitKey }) {
  const { founders, from, end } = series
  const latest = series.plotted.at(-1)
  // After a species dies out its samples hold empty means (0.00); leave them off the chart.
  const plotted = series.plotted.filter(s => s[species].count > 0)
  const x = (tick: number) => (X0 + (tick - from) / (end - from) * (X1 - X0)).toFixed(1)
  const line = plotted.map(s => `${x(s.tick)},${y(s[species].traits[trait].mean)}`).join(' ')
  const band = [...plotted.map(s => `${x(s.tick)},${y(s[species].traits[trait].high)}`),
    ...[...plotted].reverse().map(s => `${x(s.tick)},${y(s[species].traits[trait].low)}`)].join(' ')
  const tone = TONE[species]
  const who = species === 'prey' ? 'rabbits' : 'foxes'
  return <figure className="rounded-lg border bg-card p-3">
    <figcaption className="flex items-baseline justify-between gap-2 text-sm">
      <span>{TRAIT_LABELS[trait]}</span>
      <strong className={cn('tabular', latest?.[species].count === 0 ? 'font-normal text-muted-foreground' : tone.text)}>{traitValue(latest?.[species], trait)}</strong>
    </figcaption>
    <svg viewBox="0 0 300 150" className="mt-1 w-full text-muted-foreground" role="img" aria-label={`${TRAIT_LABELS[trait]} of ${who} over time; average and middle 80 percent`}>
      {[-1, 0, 1].map(v => <g key={v}><line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.25" /><text x={X0 - 6} y={Number(y(v)) + 3} textAnchor="end" fill="currentColor" fontSize="10">{v}</text></g>)}
      {founders && <line x1={X0} x2={X1} y1={y(founders[species].traits[trait].mean)} y2={y(founders[species].traits[trait].mean)} className={tone.stroke} strokeDasharray="4 4" opacity="0.7" />}
      <polygon points={band} className={tone.fill} opacity="0.2" />
      <polyline points={line} fill="none" className={tone.stroke} strokeWidth="2" />
      <text x={X0} y="136" fill="currentColor" fontSize="10">Day {Math.floor(from / 24) + 1}</text>
      <text x={X1} y="136" textAnchor="end" fill="currentColor" fontSize="10">Day {Math.floor(end / 24) + 1}</text>
      <text x={(X0 + X1) / 2} y="148" textAnchor="middle" fill="currentColor" fontSize="9">time</text>
      <text transform={`translate(8 ${y(0)}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize="9">response</text>
    </svg>
  </figure>
})
