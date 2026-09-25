import { AnimalInspector, type AnimalSelection } from '@/components/animal-inspector'
import { EvolutionView } from '@/components/evolution-view'
import { Button } from '@/components/ui/button'
import { readSave, type MeadowSave } from '@/game/saves'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Dna, FolderOpen, Save, Trees } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { Guide } from '@/components/guide'
import { MeadowSettings } from '@/components/meadow-settings'
import { LeverPanel, LockedSetup } from '@/components/lever-panel'
import { ResultDialog } from '@/components/result-dialog'
import { Almanac, BestScore, Interventions, RunPanel } from '@/components/run-panel'
import { StatusStrip } from '@/components/status-strip'
import { Timeline } from '@/components/timeline'
import { Transport } from '@/components/transport'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { WorldView } from '@/components/world-view'
import { SPEEDS } from '@/game/controller'
import { STABLE_PRESET } from '@/game/presets'
import { seedOf, type SeedChoice } from '@/game/seed'
import { useAnimalIcons } from '@/hooks/use-animal-icons'
import { useGame } from '@/hooks/use-game'
import { useTheme } from '@/hooks/use-theme'
import { hrefOf, useView, type View } from '@/hooks/use-view'
import { ThemeToggle } from '@/components/theme-toggle'
import { BUDGET, spent, type LeverValues } from '@/sim/levers'
import { SCENARIO_BY_ID, SCENARIOS, type ScenarioId } from '@/sim/scenarios'
import { cn } from '@/lib/utils'

const NAV: { view: View; label: string; icon: typeof Trees }[] = [
  { view: 'meadow', label: 'Meadow', icon: Trees },
  { view: 'evolution', label: 'Evolution', icon: Dna },
  { view: 'guide', label: 'Guide', icon: BookOpen },
]

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
  const [theme, setTheme] = useTheme()
  const [endless, setEndless] = useState(false)
  const [selected, setSelected] = useState<AnimalSelection | null>(null)
  const pendingSave = useRef<MeadowSave | null>(null)
  const base = STABLE_PRESET
  const [levers, setLevers] = useState<LeverValues>(STABLE_PRESET)
  const [scenario, setScenario] = useState<ScenarioId>(initial.scenario)
  const [seedChoice, setSeedChoice] = useState<SeedChoice>(initial.seed)
  const [view, go] = useView()
  const [dismissed, setDismissed] = useState(-1)
  const [resetKey, setResetKey] = useState(0)
  const seed = seedOf(seedChoice)
  const vp = useViewport()
  const desktop = vp.w >= 1024
  const worldMax = desktop ? Math.max(360, Math.min(860, vp.h - 330)) : vp.w - 24

  useEffect(() => {
    if (pendingSave.current) { game.restore(pendingSave.current); pendingSave.current = null }
    else { setSelected(null); game.configure({ levers, base, scenario, seed, endless }) }
  }, [game, levers, base, scenario, seed, endless, resetKey])

  useEffect(() => {
    const q = new URLSearchParams()
    if (scenario !== 'stable') q.set('scenario', scenario)
    if (seedChoice.kind === 'custom') q.set('seed', String(seedChoice.seed))
    const search = q.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`)
    // `view` re-runs this after back/forward, so the entry we land on also carries the current seed and scenario.
  }, [scenario, seedChoice, view])

  const locked = snap.phase === 'running' || snap.phase === 'ended'
  const left = BUDGET - spent(levers, base)

  useEffect(() => {
    if (snap.saveStatus) toast(snap.saveStatus, { id: 'save' })
  }, [snap.saveStatus])

  const reset = () => setResetKey((k) => k + 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [role="slider"], [role="combobox"], [role="listbox"], [role="radiogroup"], [role="radio"]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const s = game.getSnapshot()
      switch (e.key) {
        case ' ':
          if (t.closest('button, a')) return
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
      if (!saved) { toast('No saved meadow on this device yet.', { id: 'save' }); return }
      setSelected(null)
      pendingSave.current = saved
      setLevers(saved.config.levers)
      setScenario(saved.config.scenario)
      setSeedChoice({ kind: 'custom', seed: saved.config.seed })
      setEndless(saved.config.endless)
      setResetKey(k => k + 1)
      go('meadow')
      toast.dismiss('save')
    } catch { toast.error('Could not load this meadow. Device storage may be unavailable, or the save is incompatible.', { id: 'save' }) }
  }
  const sc = SCENARIO_BY_ID[scenario]
  const inspector = selected && <AnimalInspector selected={selected} onSelect={setSelected} />

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

          <nav aria-label="Views" className="order-last flex w-full rounded-lg bg-muted p-[3px] lg:order-1 lg:w-auto">
            {NAV.map(({ view: v, label, icon: Icon }) => (
              <a
                key={v}
                href={hrefOf(v)}
                aria-current={view === v ? 'page' : undefined}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors lg:flex-none',
                  view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" /> {label}
              </a>
            ))}
          </nav>

          <ThemeToggle theme={theme} onChange={setTheme} className="order-1 ml-auto lg:order-3 lg:ml-0" />

          <div className="order-2 flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select value={scenario} onValueChange={(v) => setScenario(v as ScenarioId)}>
              <SelectTrigger disabled={locked} className="w-[140px] sm:w-[170px]" aria-label="Scenario">
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
            <select aria-label="Run duration" className="h-8 rounded-md border bg-background px-2 text-xs" value={endless ? 'endless' : 'year'} disabled={locked} onChange={e => setEndless(e.target.value === 'endless')}>
              <option value="year">One year</option><option value="endless">Endless</option>
            </select>
            <MeadowSettings onPractice={() => { setLevers(STABLE_PRESET); setScenario('stable'); setSeedChoice({ kind: 'custom', seed: 5007 }); setEndless(false); reset() }} locked={locked} choice={seedChoice} onChange={setSeedChoice} />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Save meadow" disabled={snap.phase === 'loading'} onClick={() => game.save()}>
                    <Save />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save meadow on this device</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Resume saved meadow" onClick={() => void resume()}>
                    <FolderOpen />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Resume saved meadow</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        {view !== 'meadow' && <StatusStrip canStart={left >= 0} />}

        {view === 'meadow' && (
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
              <WorldView maxSize={worldMax} selected={selected} onSelect={setSelected} />
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

            <aside className="min-w-0" aria-label={locked ? 'Run' : 'Setup'}>
              <Card className="gap-0 p-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
                <div className="min-h-0 flex-1 p-3 lg:overflow-y-auto">
                  {locked ? (
                    <RunPanel inspector={inspector} setup={<LockedSetup levers={levers} base={base} onUnlock={reset} />} />
                  ) : (
                    <div className="flex flex-col gap-4">
                      <BestScore />
                      {inspector}
                      <LeverPanel
                        levers={levers}
                        base={base}
                        onChange={(id, v) => setLevers((prev) => ({ ...prev, [id]: v }))}
                        onResetLevers={() => setLevers(STABLE_PRESET)}
                      />
                      <Interventions preview />
                      <Almanac />
                    </div>
                  )}
                </div>
              </Card>
            </aside>
          </main>
        )}

        {view === 'evolution' && (
          <main className="flex-1">
            <EvolutionView selected={selected} onSelect={setSelected} />
          </main>
        )}

        {view === 'guide' && (
          <main className="flex-1">
            <Card className="mx-auto w-full max-w-6xl gap-4 p-5 sm:p-8">
              <h2 className="text-lg font-semibold">How to keep the meadow</h2>
              <Guide />
            </Card>
          </main>
        )}

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
          go('meadow')
          reset()
        }}
        onReplay={() => {
          setDismissed(snap.runId)
          game.seek(0)
          game.play()
        }}
      />
      <Toaster
        theme={theme}
        position="bottom-center"
        toastOptions={{ className: 'font-sans' }}
        style={{ '--normal-bg': 'var(--popover)', '--normal-text': 'var(--popover-foreground)', '--normal-border': 'var(--border)' } as React.CSSProperties}
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
