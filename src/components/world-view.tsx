import { useEffect, useRef } from 'react'
import { Flower2, Leaf, Moon, Play, Snowflake, Sun, SunDim } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAnimalIcons } from '@/hooks/use-animal-icons'
import { useGame } from '@/hooks/use-game'
import { calendar, clockLabel, daylight, type Season } from '@/sim/time'
import { cn } from '@/lib/utils'

const SEASON_ICON: Record<Season, typeof Leaf> = {
  autumn: Leaf,
  winter: Snowflake,
  spring: Flower2,
  summer: Sun,
}

export function WorldView({ maxSize }: { maxSize: number }) {
  const [game, snap] = useGame()
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const icons = useAnimalIcons()

  useEffect(() => {
    game.attachCanvas(canvas.current)
    return () => game.attachCanvas(null)
  }, [game])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => game.resize(Math.min(el.clientWidth, maxSize)))
    ro.observe(el)
    game.resize(Math.min(el.clientWidth, maxSize))
    return () => ro.disconnect()
  }, [game, maxSize])

  const cal = calendar(snap.tick)
  const SeasonIcon = SEASON_ICON[cal.season]
  const light = daylight(snap.tick)
  const TimeIcon = light > 0.6 ? Sun : light > 0.25 ? SunDim : Moon
  const activeSpan = game.scenario.spans.find((s) => snap.tick >= s.from && snap.tick < s.to)
  const planning = snap.phase === 'planning' && snap.tick === 0

  return (
    <div ref={wrap} className="relative mx-auto w-full" style={{ maxWidth: maxSize }}>
      <div className="relative mx-auto overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/40" style={{ width: 'fit-content' }}>
        <canvas ref={canvas} className="block" aria-label="Meadow with rabbits, foxes and berry bushes" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2 sm:p-3">
          <div className="flex items-center gap-2 rounded-lg bg-black/55 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-md">
            <TimeIcon className="size-4 text-amber-200" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tabular">
                {cal.day} {cal.monthLong} <span className="font-normal text-white/70">· {clockLabel(snap.tick)}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-white/70">
                <SeasonIcon className="size-3" /> <span className="capitalize">{cal.season}</span> · day {cal.dayOfRun} of 334
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-black/55 px-2 py-1.5 text-white shadow-lg backdrop-blur-md">
            <Count icon={icons.rabbit} value={snap.prey} label="rabbits" tone="text-rabbit" />
            <Count icon={icons.fox} value={snap.pred} label={`foxes · ${snap.predKits10d} kits born in the last 10 days`} tone="text-fox" />
            <div
              className="flex items-center gap-1 pl-1 text-sm tabular"
              title={`${snap.bushes} berry bushes, holding ${Math.round(snap.stock * 100)}% of the starting berries`}
            >
              <span className="inline-block size-2.5 rounded-full bg-[#b3263e] ring-2 ring-[#4f7d34]" />
              <span className="font-semibold text-berry">{snap.bushes}</span>
            </div>
          </div>
        </div>

        {activeSpan && (
          <div
            className={cn(
              'pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium shadow-lg backdrop-blur-md',
              activeSpan.tone === 'winter' ? 'bg-sky-100/85 text-sky-950' : 'bg-amber-200/85 text-amber-950',
            )}
          >
            {activeSpan.label} · bushes regrow slowly
          </div>
        )}

        {planning && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 via-black/10 to-transparent p-6">
            <div className="flex flex-col items-center gap-3 text-center text-white">
              <p className="max-w-sm text-sm text-white/85 drop-shadow">
                {snap.prey} rabbits and {snap.pred} foxes with random genes. Tune the levers, then release them.
              </p>
              <Button size="lg" onClick={() => game.play()} className="gap-2 shadow-xl">
                <Play className="size-4" /> Release the animals
              </Button>
              <span className="text-[11px] text-white/60">or press Space</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Count({ icon, value, label, tone }: { icon: string; value: number; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-1 px-1 text-sm tabular" title={label}>
      <img src={icon} alt="" className="size-5" />
      <span className={cn('min-w-[2ch] font-semibold', tone)}>{value}</span>
    </div>
  )
}
