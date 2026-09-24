import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SPEEDS } from '@/game/controller'
import { useGame } from '@/hooks/use-game'
import { formatDuration } from '@/sim/time'

export function Transport({ onReset }: { onReset: () => void }) {
  const [game, snap] = useGame()
  const behind = snap.head - snap.tick > 24
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Tip label="Reset run (R)">
          <Button variant="ghost" size="icon" onClick={onReset} aria-label="Reset run">
            <RotateCcw />
          </Button>
        </Tip>
        <Tip label="Back one day (←)">
          <Button variant="ghost" size="icon" onClick={() => game.stepBy(-24)} aria-label="Back one day">
            <ChevronLeft />
          </Button>
        </Tip>
        <Button
          size="icon-lg"
          className="rounded-full"
          onClick={() => game.toggle()}
          disabled={snap.phase === 'loading'}
          aria-label={snap.playing ? 'Pause' : 'Play'}
        >
          {snap.playing ? <Pause /> : <Play className="translate-x-px" />}
        </Button>
        <Tip label="Forward one day (→)">
          <Button variant="ghost" size="icon" onClick={() => game.stepBy(24)} aria-label="Forward one day">
            <ChevronRight />
          </Button>
        </Tip>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={String(snap.speed)}
        onValueChange={(v) => v && game.setSpeed(Number(v))}
        aria-label="Playback speed"
      >
        {SPEEDS.map((s, i) => (
          <ToggleGroupItem key={s.label} value={String(i)} className="px-2 text-xs tabular">
            {s.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular">
        {behind && (
          <Button variant="outline" size="xs" onClick={() => game.seek(snap.head)} className="gap-1">
            <Radio className="size-3" /> Back to live
          </Button>
        )}
        <span>
          <span className="font-medium text-foreground">{formatDuration(snap.tick)}</span> survived
        </span>
      </div>
    </div>
  )
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
