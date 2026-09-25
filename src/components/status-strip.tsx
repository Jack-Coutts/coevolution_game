import { ArrowLeft, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SPEEDS } from '@/game/controller'
import { useAnimalIcons } from '@/hooks/use-animal-icons'
import { useGame } from '@/hooks/use-game'
import { hrefOf } from '@/hooks/use-view'
import { calendar, clockLabel } from '@/sim/time'

/** Compact live controls shown on the Evolution and Guide pages, so the run stays in reach away from the meadow. */
export function StatusStrip({ canStart }: { canStart: boolean }) {
  const [game, snap] = useGame()
  const icons = useAnimalIcons()
  const cal = calendar(snap.tick)
  const blocked = snap.phase === 'loading' || (snap.phase === 'planning' && !canStart)
  return (
    <div className="sticky top-0 z-20 -mx-3 border-b bg-background/85 px-3 py-2 backdrop-blur-md sm:-mx-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm tabular">
        <Button
          size="icon"
          className="rounded-full"
          onClick={() => game.toggle()}
          disabled={blocked}
          aria-label={snap.playing ? 'Pause' : 'Play'}
        >
          {snap.playing ? <Pause /> : <Play className="translate-x-px" />}
        </Button>
        <span>
          <span className="font-medium">{cal.day} {cal.monthLong}</span>
          <span className="text-muted-foreground"> · {clockLabel(snap.tick)}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1" title="Rabbits">
            <img src={icons.rabbit} alt="" className="size-5" />
            <span className="font-semibold text-rabbit">{snap.prey}</span>
            <span className="sr-only">rabbits</span>
          </span>
          <span className="flex items-center gap-1" title="Foxes">
            <img src={icons.fox} alt="" className="size-5" />
            <span className="font-semibold text-fox">{snap.pred}</span>
            <span className="sr-only">foxes</span>
          </span>
          <span className="flex items-center gap-1" title="Berry bushes">
            <span className="inline-block size-2.5 rounded-full bg-berry" />
            <span className="font-semibold text-berry">{snap.bushes}</span>
            <span className="sr-only">bushes</span>
          </span>
        </span>
        <Button
          variant="outline"
          size="sm"
          className="tabular"
          onClick={() => game.setSpeed((snap.speed + 1) % SPEEDS.length)}
          title="Change speed (↑ ↓)"
          aria-label={`Speed ${SPEEDS[snap.speed].label}; click for the next speed`}
        >
          {SPEEDS[snap.speed].label}
        </Button>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <a href={hrefOf('meadow')}>
            <ArrowLeft /> Back to meadow
          </a>
        </Button>
      </div>
    </div>
  )
}
