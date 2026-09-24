import { Info, Lock, RotateCcw } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAnimalIcons } from '@/hooks/use-animal-icons'
import {
  BUDGET,
  clampLever,
  deriveParams,
  formatLever,
  GROUPS,
  leverCost,
  LEVERS,
  spent,
  type LeverDef,
  type LeverGroup,
  type LeverValues,
} from '@/sim/levers'
import type { SimParams, SpeciesParams } from '@/sim/params'
import { formatHours } from '@/sim/time'
import { cn } from '@/lib/utils'

interface Props {
  levers: LeverValues
  base: LeverValues
  locked: boolean
  onChange: (id: string, value: number) => void
  onResetLevers: () => void
  onUnlock: () => void
}

export function LeverPanel({ levers, base, locked, onChange, onResetLevers, onUnlock }: Props) {
  const used = spent(levers, base)
  const left = Math.round((BUDGET - used) * 10) / 10
  const over = left < 0
  const params = deriveParams(levers)
  const defs = LEVERS
  const changed = defs.filter((d) => Math.abs(levers[d.id] - base[d.id]) > 1e-9).length

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'sticky top-0 z-10 rounded-lg border p-3 shadow-md backdrop-blur-md',
          over ? 'border-destructive/60 bg-[oklch(0.24_0.05_25/0.92)]' : 'bg-[oklch(0.23_0.014_155/0.92)]',
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium">Tuning budget</div>
          <div className={cn('text-sm tabular', over ? 'text-destructive' : 'text-foreground')}>
            <span className="text-lg font-semibold">{left}</span>
            <span className="text-muted-foreground"> / {BUDGET} pts left</span>
          </div>
        </div>
        <Progress value={Math.max(0, Math.min(100, (left / BUDGET) * 100))} className="mt-2 h-1.5" />
        <p className="mt-2 text-xs text-muted-foreground">
          {over
            ? 'Over budget. Weaken something to earn points back before you can play.'
            : 'Making animals stronger or food richer costs points. Weakening refunds half. Unspent points add to your score if both species survive.'}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {changed === 0 ? 'Starting balance' : `${changed} lever${changed === 1 ? '' : 's'} changed`}
          </span>
          <Button variant="ghost" size="xs" onClick={onResetLevers} disabled={locked || changed === 0}>
            <RotateCcw /> Reset levers
          </Button>
        </div>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-2.5 text-xs text-amber-100">
          <Lock className="size-4 shrink-0" />
          <span className="flex-1">Levers are locked while the meadow is running.</span>
          <Button size="xs" variant="outline" onClick={onUnlock}>
            Reset to retune
          </Button>
        </div>
      )}

      <Accordion type="multiple" defaultValue={['populations', 'food']} className="rounded-lg border">
        {GROUPS.map((g) => {
          const gdefs = defs.filter((d) => d.group === g.id)
          if (gdefs.length === 0) return null
          return (
            <AccordionItem key={g.id} value={g.id} className="px-3">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex flex-1 items-center justify-between pr-2">
                  <span className="text-sm font-medium">{g.label}</span>
                  <GroupCost defs={gdefs} levers={levers} base={base} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-1 pb-4">
                <p className="mb-1 text-xs text-muted-foreground">{g.blurb}</p>
                <GroupBody
                  group={g.id}
                  defs={gdefs}
                  levers={levers}
                  base={base}
                  locked={locked}
                  onChange={onChange}
                  params={params}
                />
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}

function GroupCost({ defs, levers, base }: { defs: LeverDef[]; levers: LeverValues; base: LeverValues }) {
  const c = defs.reduce((t, d) => t + leverCost(d, levers[d.id], base[d.id]), 0)
  if (Math.abs(c) < 0.05) return null
  return (
    <Badge variant={c > 0 ? 'secondary' : 'outline'} className={cn('tabular', c < 0 && 'text-emerald-300')}>
      {c > 0 ? `−${fmt(c)}` : `+${fmt(-c)}`} pts
    </Badge>
  )
}

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function GroupBody({
  group,
  defs,
  levers,
  base,
  locked,
  onChange,
  params,
}: {
  group: LeverGroup
  defs: LeverDef[]
  levers: LeverValues
  base: LeverValues
  locked: boolean
  onChange: (id: string, v: number) => void
  params: SimParams
}) {
  const icons = useAnimalIcons()
  const perSpecies = group === 'lifecycle' || group === 'energy' || group === 'movement'
  if (!perSpecies) {
    return (
      <>
        {defs.map((d) => (
          <LeverRow key={d.id} def={d} value={levers[d.id]} base={base[d.id]} locked={locked} onChange={onChange} />
        ))}
        {group === 'food' && <FoodReadout params={params} />}
      </>
    )
  }
  return (
    <>
      {(['prey', 'pred'] as const).map((s) => (
        <div key={s} className="flex flex-col gap-1">
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <img src={s === 'prey' ? icons.rabbit : icons.fox} alt="" className="size-5" />
            <span className={s === 'prey' ? 'text-rabbit' : 'text-fox'}>{s === 'prey' ? 'Rabbits' : 'Foxes'}</span>
          </div>
          {defs
            .filter((d) => d.species === s)
            .map((d) => (
              <LeverRow key={d.id} def={d} value={levers[d.id]} base={base[d.id]} locked={locked} onChange={onChange} />
            ))}
          <SpeciesReadout group={group} sp={s === 'prey' ? params.prey : params.pred} species={s} />
        </div>
      ))}
    </>
  )
}

function LeverRow({
  def,
  value,
  base,
  locked,
  onChange,
}: {
  def: LeverDef
  value: number
  base: number
  locked: boolean
  onChange: (id: string, v: number) => void
}) {
  const cost = leverCost(def, value, base)
  const moved = Math.abs(value - base) > 1e-9
  return (
    <div className="rounded-md px-1 py-1.5 hover:bg-muted/30">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[13px]">{def.label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground" aria-label={`About ${def.label}`}>
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{def.hint}</TooltipContent>
        </Tooltip>
        <div className="ml-auto flex items-center gap-1.5">
          {moved && Math.abs(cost) >= 0.05 && (
            <span className={cn('text-[11px] tabular', cost > 0 ? 'text-amber-300' : 'text-emerald-300')}>
              {cost > 0 ? `−${fmt(cost)}` : `+${fmt(-cost)}`}
            </span>
          )}
          <span className={cn('min-w-14 text-right text-[13px] font-medium tabular', moved && 'text-primary')}>
            {formatLever(def, value)}
          </span>
        </div>
      </div>
      <Slider
        min={def.min}
        max={def.max}
        step={def.step}
        value={[value]}
        disabled={locked}
        onValueChange={([v]) => onChange(def.id, clampLever(def, v))}
        aria-label={def.species ? `${def.species === 'prey' ? 'Rabbit' : 'Fox'} ${def.label.toLowerCase()}` : def.label}
      />
    </div>
  )
}

function lasts(sp: SpeciesParams, pace: number, view: number): number {
  const burn = sp.metabolism + sp.visionUpkeep * view + sp.speedCost * ((sp.step * pace) / sp.baseStep) ** 2
  return sp.maxEnergy / burn
}

function SpeciesReadout({
  group,
  sp,
  species,
}: {
  group: LeverGroup
  sp: SpeciesParams
  species: 'prey' | 'pred'
}) {
  const view = (sp.view[0] + sp.view[1]) / 2
  let text: string | null = null
  if (group === 'energy') {
    text = `On a full tank: resting ${formatHours(lasts(sp, 0, view))}, cruising ${formatHours(lasts(sp, 0.5, view))}, sprinting ${formatHours(lasts(sp, 1, view))}.`
  } else if (group === 'lifecycle') {
    const gap = `Birth gap with litter: ${formatHours(sp.birthGap)}.`
    text = `${gap} Breeds at ${Math.round(sp.breedEnergy * sp.maxEnergy)} energy and gives each young ${Math.round(sp.childEnergy * sp.maxEnergy)}.`
  } else if (group === 'movement') {
    text = `Top speed ${(sp.step * 100).toFixed(2)} meadow-%/h. ${species === 'prey' ? 'Spots foxes' : 'Sees rabbits'} at ${Math.round(sp.view[0] * 100)}${sp.view[1] !== sp.view[0] ? `–${Math.round(sp.view[1] * 100)}` : ''}% of the meadow.`
  }
  if (!text) return null
  return <p className="mt-1 mb-2 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">{text}</p>
}

function FoodReadout({ params }: { params: SimParams }) {
  return (
    <p className="mt-1 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
      Each bush regrows {Math.round(24 / params.regrowEvery)} berries a day and holds {params.patchStock}. About{' '}
      {params.sproutPerDay.toFixed(1)} new bushes sprout a day in summer, more in spring and few in winter. A bush grazed
      down for {Math.round(params.witherHours / 24)} days withers.
    </p>
  )
}
