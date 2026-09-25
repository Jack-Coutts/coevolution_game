import type { EvolutionSample, TraitKey } from '@/sim/evolution'
import type { Species } from '@/sim/sim'
import { cn } from '@/lib/utils'

const TRAIT_LABELS: Record<TraitKey, string> = { forage: 'Food seeking', flee: 'Threat avoidance', cruise: 'Cruising pace', hide: 'Cover seeking' }

const X0 = 34
const X1 = 290
const y = (value: number) => 118 - (value + 1) * 48
const TONE: Record<Species, { text: string; stroke: string; fill: string }> = {
  prey: { text: 'text-rabbit', stroke: 'stroke-rabbit', fill: 'fill-rabbit' },
  pred: { text: 'text-fox', stroke: 'stroke-fox', fill: 'fill-fox' },
}

/** One inherited trait of one species over time: mean line, middle-80% band and founder mean (dashed). */
export function TraitChart({ samples, species, trait }: { samples: EvolutionSample[]; species: Species; trait: TraitKey }) {
  const latest = samples.at(-1)
  const first = samples[0]
  // Once history is trimmed, samples[0] is the founders sample far behind the rest; keep it only for the dashed line.
  const from = samples.length >= 367 ? samples[1].tick : samples[0]?.tick ?? 0
  const end = Math.max(from + 24, latest?.tick ?? 24)
  const plotted = samples.filter(s => s.tick >= from)
  const x = (tick: number) => X0 + (tick - from) / (end - from) * (X1 - X0)
  const line = plotted.map(s => `${x(s.tick)},${y(s[species].traits[trait].mean)}`).join(' ')
  const band = [...plotted.map(s => `${x(s.tick)},${y(s[species].traits[trait].high)}`),
    ...[...plotted].reverse().map(s => `${x(s.tick)},${y(s[species].traits[trait].low)}`)].join(' ')
  const tone = TONE[species]
  const who = species === 'prey' ? 'rabbits' : 'foxes'
  return <figure className="rounded-lg border bg-card p-3">
    <figcaption className="flex items-baseline justify-between gap-2 text-sm">
      <span>{TRAIT_LABELS[trait]}</span>
      <strong className={cn('tabular', tone.text)}>{latest?.[species].traits[trait].mean.toFixed(2) ?? '—'}</strong>
    </figcaption>
    <svg viewBox="0 0 300 150" className="mt-1 w-full text-muted-foreground" role="img" aria-label={`${TRAIT_LABELS[trait]} of ${who} over time; average and middle 80 percent`}>
      {[-1, 0, 1].map(v => <g key={v}><line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.25" /><text x={X0 - 6} y={y(v) + 3} textAnchor="end" fill="currentColor" fontSize="10">{v}</text></g>)}
      {first && <line x1={X0} x2={X1} y1={y(first[species].traits[trait].mean)} y2={y(first[species].traits[trait].mean)} className={tone.stroke} strokeDasharray="4 4" opacity="0.7" />}
      <polygon points={band} className={tone.fill} opacity="0.2" />
      <polyline points={line} fill="none" className={tone.stroke} strokeWidth="2" />
      <text x={X0} y="136" fill="currentColor" fontSize="10">Day {Math.floor(from / 24) + 1}</text>
      <text x={X1} y="136" textAnchor="end" fill="currentColor" fontSize="10">Day {Math.floor(end / 24) + 1}</text>
      <text x={(X0 + X1) / 2} y="148" textAnchor="middle" fill="currentColor" fontSize="9">time</text>
      <text transform={`translate(8 ${y(0)}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize="9">response</text>
    </svg>
  </figure>
}
