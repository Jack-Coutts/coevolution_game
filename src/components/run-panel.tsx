import type { ReactNode } from 'react'
import { ACTIONS } from '@/game/interventions'
import { AlertTriangle, CheckCircle2, CloudRain, Crosshair, Info, OctagonAlert, TrendingUp, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAnimalIcons } from '@/hooks/use-animal-icons'
import { CHARGES, COOLDOWN } from '@/game/controller'
import { CALM_BONUS } from '@/game/scores'
import { forecast, type Tone } from '@/game/insights'
import { useGame } from '@/hooks/use-game'
import type { Intervention } from '@/sim/sim'
import { dateLabel, formatDuration } from '@/sim/time'
import { cn } from '@/lib/utils'

const TONE: Record<Tone, { icon: typeof Info; cls: string }> = {
  good: { icon: CheckCircle2, cls: 'border-tone-good-border bg-tone-good text-tone-good-foreground' },
  info: { icon: Info, cls: 'border-tone-info-border bg-tone-info text-tone-info-foreground' },
  warn: { icon: AlertTriangle, cls: 'border-tone-warn-border bg-tone-warn text-tone-warn-foreground' },
  danger: { icon: OctagonAlert, cls: 'border-tone-danger-border bg-tone-danger text-tone-danger-foreground' },
}


/** The side panel while the meadow runs. Interventions come first so they stay in view without scrolling. */
export function RunPanel({ inspector, setup }: { inspector: ReactNode; setup: ReactNode }) {
  const [game, snap] = useGame()
  const icons = useAnimalIcons()
  const f = snap.tick > 48 && !snap.end && snap.atLive ? forecast(game.history, snap.tick) : null
  const cooling = snap.head < snap.cooldownUntil
  const coolLeft = Math.max(0, snap.cooldownUntil - snap.head)
  const canAct = game.canIntervene()

  const actionIcon = (id: Intervention) => {
    switch (id) {
      case 'plantBushes':
      case 'rain':
        return <CloudRain className="size-4 text-tone-info-foreground" />
      case 'illnessPrey':
      case 'releasePrey':
        return <img src={icons.rabbit} alt="" className="size-5" />
      case 'cullPred':
        return <Crosshair className="size-4 text-tone-danger-foreground" />
      case 'feedFoxes':
      case 'illnessPred':
      case 'releasePred':
        return <img src={icons.fox} alt="" className="size-5" />
      default: {
        const never: never = id
        return never
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="interventions-heading">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="interventions-heading" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Interventions</h3>
          <div className="flex items-center gap-1" aria-label={`${snap.charges} of ${CHARGES} left`}>
            {Array.from({ length: CHARGES }, (_, i) => (
              <span key={i} className={cn('size-2 rounded-full', i < snap.charges ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => (
            <Tooltip key={a.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="h-auto justify-start gap-2 py-2 text-left"
                  disabled={!canAct}
                  onClick={() => game.intervene(a.id)}
                >
                  {actionIcon(a.id)}
                  <span className="text-[13px]">{a.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{a.blurb}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {snap.phase !== 'running'
            ? 'Available once the run starts.'
            : snap.charges === 0
              ? 'All interventions used.'
              : !snap.atLive
                ? 'You are replaying the past. Return to live to intervene.'
                : cooling
                  ? `Recharging: ready in ${formatDuration(coolLeft)}.`
                  : `Ready. There is a ${formatDuration(COOLDOWN)} cooldown between interventions.`}
        </p>
        {cooling && <Progress value={100 - (coolLeft / COOLDOWN) * 100} className="mt-1 h-1" />}
        <p className="mt-2 text-[11px] text-muted-foreground">Illness spreads locally and drains energy; it can overshoot. Planting supports future food. Feeding foxes gives relief but may encourage births.</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {snap.endless ? 'These four charges last the whole Endless run. Score is hours survived, with no year-end bonus.' : `A full year with no interventions earns +${CALM_BONUS[0]}, and each one used lowers that bonus by 100.`}
        </p>
      </section>

      {inspector}

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Field notes</h3>
        {snap.tick < 24 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Notes on booms, busts and risks appear here once the animals are out.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {snap.hints.slice(0, 4).map((h) => {
              const T = TONE[h.tone]
              return (
                <li key={h.id} className={cn('flex gap-2 rounded-lg border p-2.5 text-[13px] leading-snug', T.cls)}>
                  <T.icon className="mt-0.5 size-4 shrink-0" />
                  <span>{h.text}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {(game.history.stat(snap.tick, 'preySick') + game.history.stat(snap.tick, 'predSick')) > 0 && <section className="rounded-lg border border-tone-illness-border bg-tone-illness p-3 text-xs text-tone-illness-foreground">
        <strong>Illness in the meadow</strong>
        <p className="mt-1">{game.history.stat(snap.tick, 'preySick')} rabbits and {game.history.stat(snap.tick, 'predSick')} foxes are ill. Purple rings mark affected animals. Food can help them survive the added energy cost.</p>
      </section>}

      {f && (
        <section className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <TrendingUp className="size-3.5" /> Forecast · {formatDuration(f.ahead)} ahead
          </div>
          <div className="flex items-center gap-4 text-sm tabular">
            <span className="flex items-center gap-1">
              <img src={icons.rabbit} alt="" className="size-5" />
              <span className="text-rabbit">~{Math.round(f.prey)}</span>
            </span>
            <span className="flex items-center gap-1">
              <img src={icons.fox} alt="" className="size-5" />
              <span className="text-fox">~{Math.round(f.pred)}</span>
            </span>
            <span className="text-xs text-muted-foreground">from the trend of the last 10 days</span>
          </div>
        </section>
      )}

      <section className="rounded-lg border p-3">
        <h3 className="text-sm font-semibold">Deaths by cause</h3>
        <table className="mt-2 w-full text-left text-xs tabular"><thead><tr><th>Species</th><th>Starved</th><th>Eaten</th><th>Old age</th><th>Illness</th><th>Culled</th></tr></thead>
          <tbody><tr><td>Rabbits</td><td>{game.history.stat(snap.tick, 'preyStarved')}</td><td>{game.history.stat(snap.tick, 'preyEaten')}</td><td>{game.history.stat(snap.tick, 'preyOld')}</td><td>{game.history.stat(snap.tick, 'preyIllness')}</td><td>—</td></tr>
          <tr><td>Foxes</td><td>{game.history.stat(snap.tick, 'predStarved')}</td><td>—</td><td>{game.history.stat(snap.tick, 'predOld')}</td><td>{game.history.stat(snap.tick, 'predIllness')}</td><td>{game.history.stat(snap.tick, 'predCulled')}</td></tr></tbody></table>
        <p className="mt-2 text-[11px] text-muted-foreground">Totals up to the displayed time. Illness deaths are energy exhaustion during illness.</p>
        {game.history.stat(snap.tick, 'ceilingHits') > 0 && <p className="mt-2 text-xs text-tone-warn-foreground">The performance safety limit has restricted births. This run is not valid for balance comparisons.</p>}
      </section>

      {(snap.interventions.length > 0 || game.scenario.markers.length > 0 || game.scenario.spans.length > 0) && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Almanac</h3>
          <ul className="flex flex-col gap-1 text-[13px]">
            {game.scenario.spans.map((s) => (
              <li key={s.label} className="flex justify-between gap-2">
                <span>{s.label}</span>
                <span className="text-muted-foreground tabular">
                  {dateLabel(s.from)} – {dateLabel(Math.min(s.to, snap.horizon))}
                </span>
              </li>
            ))}
            {game.scenario.markers.map((m) => (
              <li key={m.label} className="flex justify-between gap-2">
                <span>{m.label}</span>
                <span className="text-muted-foreground tabular">{dateLabel(m.tick)}</span>
              </li>
            ))}
            {snap.interventions.map((iv, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="px-1.5">
                    You
                  </Badge>
                  {ACTIONS.find((a) => a.id === iv.action)?.label}
                </span>
                <span className="text-muted-foreground tabular">{dateLabel(iv.tick)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BestScore />

      {setup}
    </div>
  )
}

function BestScore() {
  const [, snap] = useGame()
  if (!snap.best) return null
  return (
    <section className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <Trophy className="size-4 text-gold" />
      <span className="text-muted-foreground">Your best on this meadow</span>
      <span className="ml-auto font-semibold tabular">{snap.best.score.toLocaleString()}</span>
    </section>
  )
}
