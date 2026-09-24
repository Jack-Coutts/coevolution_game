import { EvolutionPanel, type AnimalSelection } from '@/components/evolution-panel'
import { Button } from '@/components/ui/button'
import { readSave, type MeadowSave } from '@/game/saves'
import { useEffect, useRef, useState } from 'react'
import { Guide } from '@/components/guide'
import { MeadowSettings } from '@/components/meadow-settings'
import { LeverPanel } from '@/components/lever-panel'
import { ResultDialog } from '@/components/result-dialog'
import { RunPanel } from '@/components/run-panel'
import { Timeline } from '@/components/timeline'
import { Transport } from '@/components/transport'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorldView } from '@/components/world-view'
import { SPEEDS } from '@/game/controller'
import { STABLE_PRESET } from '@/game/presets'
import { seedOf, type SeedChoice } from '@/game/seed'
import { useAnimalIcons } from '@/hooks/use-animal-icons'
import { useGame } from '@/hooks/use-game'
import { BUDGET, spent, type LeverValues } from '@/sim/levers'
import { SCENARIO_BY_ID, SCENARIOS, type ScenarioId } from '@/sim/scenarios'

type Tab = 'levers' | 'run' | 'evolution' | 'guide'

function useViewport(): { w: number; h: number } {
  const [v, setV] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

function initialState(): { scenario: ScenarioId; seed: SeedChoice } {
  const q = new URLSearchParams(window.location.search)
  const sc = q.get('scenario')
  const seed = Number(q.get('seed'))
  return {
    scenario: sc && sc in SCENARIO_BY_ID ? (sc as ScenarioId) : 'stable',
    seed:
      q.has('seed') && Number.isFinite(seed) ? { kind: 'custom', seed: Math.abs(Math.trunc(seed)) } : { kind: 'daily' },
  }
}

const initial = initialState()

export default function App() {
  const [game, snap] = useGame()
  const icons = useAnimalIcons()
  const [endless, setEndless] = useState(false)
  const [selected, setSelected] = useState<AnimalSelection | null>(null)
  const [loadStatus, setLoadStatus] = useState('')
  const pendingSave = useRef<MeadowSave | null>(null)
  const base = STABLE_PRESET
  const [levers, setLevers] = useState<LeverValues>(STABLE_PRESET)
  const [scenario, setScenario] = useState<ScenarioId>(initial.scenario)
  const [seedChoice, setSeedChoice] = useState<SeedChoice>(initial.seed)
  const [tab, setTab] = useState<Tab>('levers')
  const [dismissed, setDismissed] = useState(-1)
  const [resetKey, setResetKey] = useState(0)
  const seed = seedOf(seedChoice)
  const vp = useViewport()
  const desktop = vp.w >= 1024
  const worldMax = desktop ? Math.max(360, Math.min(860, vp.h - 330)) : vp.w - 24

  useEffect(() => {
    if (pendingSave.current) { game.restore(pendingSave.current); pendingSave.current = null }
    else game.configure({ levers, base, scenario, seed, endless })
  }, [game, levers, base, scenario, seed, endless, resetKey])

  useEffect(() => {
    const q = new URLSearchParams()
    if (scenario !== 'stable') q.set('scenario', scenario)
    if (seedChoice.kind === 'custom') q.set('seed', String(seedChoice.seed))
    const search = q.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
  }, [scenario, seedChoice])

  const locked = snap.phase === 'running' || snap.phase === 'ended'
  const left = BUDGET - spent(levers, base)

  const prevPhase = useRef(snap.phase)
  useEffect(() => {
    if (prevPhase.current === 'planning' && snap.phase === 'running' && tab === 'levers') setTab('run')
    prevPhase.current = snap.phase
  }, [snap.phase, tab])

  const reset = () => { setSelected(null); setResetKey((k) => k + 1) }

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

  const resume = async () => {
    try {
      const saved = await readSave()
      if (!saved) { setLoadStatus('No saved meadow on this device yet.'); return }
      setSelected(null)
      pendingSave.current = saved
      setLevers(saved.config.levers)
      setScenario(saved.config.scenario)
      setSeedChoice({ kind: 'custom', seed: saved.config.seed })
      setEndless(saved.config.endless)
      setResetKey(k => k + 1)
      setTab('evolution')
      setLoadStatus('')
    } catch { setLoadStatus('Could not load this meadow. Device storage may be unavailable, or the save is incompatible.') }
  }
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
              <p className="hidden text-xs text-muted-foreground sm:block">Meadow Keeper · {endless ? 'a world that keeps evolving' : 'keep both species alive for a year'}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Select value={scenario} onValueChange={(v) => setScenario(v as ScenarioId)}>
              <SelectTrigger disabled={locked} className="w-[150px] sm:w-[170px]" aria-label="Scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SCENARIOS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <select aria-label="Run duration" className="rounded-md border bg-background px-2 py-2 text-xs" value={endless ? 'endless' : 'year'} disabled={locked} onChange={e => setEndless(e.target.value === 'endless')}>
              <option value="year">One year</option><option value="endless">Endless</option>
            </select>
            <MeadowSettings onPractice={() => { setSelected(null); setLevers(STABLE_PRESET); setScenario('stable'); setSeedChoice({ kind: 'custom', seed: 5007 }); setEndless(false); reset() }} locked={locked} choice={seedChoice} onChange={setSeedChoice} />
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <p className="text-sm">
                <span className="font-medium">{sc.name}</span>
                <span className="text-muted-foreground"> · {sc.tagline}</span>
              </p>
              <span className="hidden text-xs text-muted-foreground tabular sm:inline">
                {seedChoice.kind === 'daily' ? "Today's meadow" : 'Seed'} {seed}
              </span>
            </div>
            <WorldView maxSize={worldMax} selected={selected} onSelect={a => { setSelected(a); setTab('evolution') }} />
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Button size="xs" variant="outline" disabled={snap.phase === 'loading'} onClick={() => { setLoadStatus(''); game.save() }}>Save meadow</Button>
              <Button size="xs" variant="outline" onClick={() => void resume()}>Resume saved meadow</Button>
              <span role="status" className="text-muted-foreground">{loadStatus || snap.saveStatus}</span>
            </div>
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
                    <TabsTrigger value="evolution">Evolution</TabsTrigger>
                    <TabsTrigger value="guide">Guide</TabsTrigger>
                  </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:max-h-[calc(100vh-7rem)]">
                  <TabsContent value="levers" className="mt-0">
                    <LeverPanel
                      levers={levers}
                      base={base}
                      locked={locked}
                      onChange={(id, v) => setLevers((prev) => ({ ...prev, [id]: v }))}
                      onResetLevers={() => setLevers(STABLE_PRESET)}
                      onUnlock={reset}
                    />
                  </TabsContent>
                  <TabsContent value="run" className="mt-0">
                    <RunPanel />
                  </TabsContent>
                  <TabsContent value="evolution" className="mt-0">
                    <EvolutionPanel selected={selected} onSelect={setSelected} />
                  </TabsContent>
                  <TabsContent value="guide" className="mt-0">
                    <Guide />
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
