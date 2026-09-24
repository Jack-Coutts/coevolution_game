import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Dices, FlaskConical, Trophy } from 'lucide-react'
import { Guide } from '@/components/guide'
import { LeverPanel } from '@/components/lever-panel'
import { ResultDialog } from '@/components/result-dialog'
import { RunPanel } from '@/components/run-panel'
import { Timeline } from '@/components/timeline'
import { Transport } from '@/components/transport'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAnimalIcons, WorldView } from '@/components/world-view'
import { SPEEDS, type Mode } from '@/game/controller'
import { presetFor } from '@/game/presets'
import { dailySeed, scoreFor } from '@/game/scores'
import { useGame } from '@/hooks/use-game'
import { BUDGET, spent, type LeverValues } from '@/sim/levers'
import type { Rules } from '@/sim/params'
import { SCENARIO_BY_ID, SCENARIOS, type ScenarioId } from '@/sim/scenarios'

type SeedMode = 'daily' | 'custom'
type Tab = 'levers' | 'run' | 'guide'

function useViewport(): { w: number; h: number } {
  const [v, setV] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

export default function App() {
  const [game, snap] = useGame()
  const icons = useAnimalIcons()
  const [rules, setRules] = useState<Rules>('energy')
  const base = useMemo(() => presetFor(rules), [rules])
  const [levers, setLevers] = useState<LeverValues>(() => presetFor('energy'))
  const [scenario, setScenario] = useState<ScenarioId>('stable')
  const [seedMode, setSeedMode] = useState<SeedMode>('daily')
  const [customSeed, setCustomSeed] = useState(7)
  const [mode, setMode] = useState<Mode>('plan')
  const [tab, setTab] = useState<Tab>('levers')
  const [dismissed, setDismissed] = useState(-1)
  const [resetKey, setResetKey] = useState(0)
  const seed = seedMode === 'daily' ? dailySeed() : customSeed
  const vp = useViewport()
  const desktop = vp.w >= 1024
  const worldMax = desktop ? Math.max(360, Math.min(860, vp.h - 250)) : vp.w - 24

  useEffect(() => {
    game.configure({ rules, levers, base, scenario, seed, mode })
  }, [game, rules, levers, base, scenario, seed, mode, resetKey])

  const locked = snap.phase === 'running' || snap.phase === 'ended'
  const left = BUDGET - spent(levers, base, rules)

  const prevPhase = useRef(snap.phase)
  useEffect(() => {
    if (prevPhase.current === 'planning' && snap.phase === 'running' && tab === 'levers') setTab('run')
    prevPhase.current = snap.phase
  }, [snap.phase, tab])

  const reset = () => setResetKey((k) => k + 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [role="slider"], [role="combobox"], [role="listbox"]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const s = game.getSnapshot()
      switch (e.key) {
        case ' ':
          if (t.closest('button')) return
          e.preventDefault()
          if (s.phase === 'planning' && left < 0) return
          game.toggle()
          break
        case 'ArrowRight':
          e.preventDefault()
          game.stepBy(e.shiftKey ? 1 : 24)
          break
        case 'ArrowLeft':
          e.preventDefault()
          game.stepBy(e.shiftKey ? -1 : -24)
          break
        case 'ArrowUp':
          e.preventDefault()
          game.setSpeed(s.speed + 1)
          break
        case 'ArrowDown':
          e.preventDefault()
          game.setSpeed(s.speed - 1)
          break
        case 'Home':
          game.seek(0)
          break
        case 'End':
          game.seek(s.head)
          break
        case 'r':
        case 'R':
          reset()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game, left])

  const best = scoreFor({ rules, scenario, seed, mode })
  const sc = SCENARIO_BY_ID[scenario]

  return (
    <TooltipProvider delayDuration={250}>
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-3 p-3 sm:p-4">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-[#1d2a20] ring-1 ring-white/10">
              <img src={icons.rabbit} alt="" className="absolute top-1 left-1 size-6" />
              <img src={icons.fox} alt="" className="absolute right-0.5 bottom-0.5 size-6" />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-semibold tracking-tight">Coevolution</h1>
              <p className="text-xs text-muted-foreground">Meadow Keeper · keep both species alive for a year</p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <Select value={scenario} onValueChange={(v) => setScenario(v as ScenarioId)}>
              <SelectTrigger className="w-[190px]" aria-label="Scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ToggleGroup
              type="single"
              variant="outline"
              value={mode}
              onValueChange={(v) => v && setMode(v as Mode)}
              aria-label="Mode"
            >
              <ToggleGroupItem value="plan" className="px-3">
                Plan
              </ToggleGroupItem>
              <ToggleGroupItem value="live" className="px-3">
                Live
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-1">
              <Select value={seedMode} onValueChange={(v) => setSeedMode(v as SeedMode)}>
                <SelectTrigger className="w-[150px]" aria-label="Seed">
                  <CalendarDays className="size-4 opacity-70" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily meadow</SelectItem>
                  <SelectItem value="custom">Seed #{customSeed}</SelectItem>
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="New random meadow"
                    onClick={() => {
                      setCustomSeed(Math.floor(Math.random() * 100000))
                      setSeedMode('custom')
                    }}
                  >
                    <Dices />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New random meadow</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                  <FlaskConical className="size-4 text-muted-foreground" />
                  <Label htmlFor="classic" className="text-xs">
                    Classic rules
                  </Label>
                  <Switch
                    id="classic"
                    checked={rules === 'classic'}
                    onCheckedChange={(on) => {
                      const r: Rules = on ? 'classic' : 'energy'
                      setRules(r)
                      setLevers(presetFor(r))
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                The original benchmark rules: starvation by hours since the last meal, and breeding by meals. With the
                default levers they reproduce the benchmark exactly. Energy rules are the game default.
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs" title="Best score for this scenario, seed and mode">
              <Trophy className="size-4 text-amber-300" />
              <span className="text-muted-foreground">Best</span>
              <span className="font-semibold tabular">{best ? best.score.toLocaleString() : '—'}</span>
            </div>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <p className="text-sm">
                <span className="font-medium">{sc.name}</span>
                <span className="text-muted-foreground"> · {sc.tagline}</span>
              </p>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {rules === 'classic' ? 'Classic benchmark rules' : 'Energy rules'} · {mode === 'live' ? 'Live' : 'Plan'} mode ·
                seed {seed}
              </span>
            </div>
            <WorldView maxSize={worldMax} />
            <Card className="gap-2 p-3">
              <Transport onReset={reset} />
              <Timeline />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
                <Legend color="bg-rabbit" label="Rabbits (left scale)" />
                <Legend color="bg-fox" label="Foxes (right scale)" />
                <Legend color="bg-berry/40" label="Berries on bushes" />
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 border-t border-dashed border-rabbit" /> Forecast
                </span>
                <span className="ml-auto">Click or drag the graph to replay · {SPEEDS[snap.speed].label}</span>
              </div>
            </Card>
          </section>

          <aside className="min-w-0">
            <Card className="gap-0 p-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-hidden">
              <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex h-full min-h-0 flex-col gap-0">
                <div className="border-b p-2">
                  <TabsList className="w-full">
                    <TabsTrigger value="levers">Levers</TabsTrigger>
                    <TabsTrigger value="run">Field notes</TabsTrigger>
                    <TabsTrigger value="guide">How to play</TabsTrigger>
                  </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:max-h-[calc(100vh-7rem)]">
                  <TabsContent value="levers" className="mt-0">
                    <LeverPanel
                      rules={rules}
                      levers={levers}
                      base={base}
                      locked={locked}
                      onChange={(id, v) => setLevers((prev) => ({ ...prev, [id]: v }))}
                      onResetLevers={() => setLevers(presetFor(rules))}
                      onUnlock={reset}
                    />
                  </TabsContent>
                  <TabsContent value="run" className="mt-0">
                    <RunPanel onSwitchLive={() => setMode('live')} />
                  </TabsContent>
                  <TabsContent value="guide" className="mt-0">
                    <Guide rules={rules} />
                  </TabsContent>
                </div>
              </Tabs>
            </Card>
          </aside>
        </main>

        <footer className="px-1 pb-1 text-[11px] text-muted-foreground">
          One hour of meadow time is one simulation step. Every animal moves once per hour, and its genes steer it.
        </footer>
      </div>

      <ResultDialog
        snap={snap}
        open={snap.phase === 'ended' && dismissed !== snap.runId}
        onOpenChange={(o) => !o && setDismissed(snap.runId)}
        unspent={Math.round(left * 10) / 10}
        onRetune={() => {
          setDismissed(snap.runId)
          setTab('levers')
          reset()
        }}
        onReplay={() => {
          setDismissed(snap.runId)
          game.seek(0)
          game.play()
        }}
      />
    </TooltipProvider>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  )
}
