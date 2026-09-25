import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Radio, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SPEEDS } from '@/game/controller'
import { useGame } from '@/hooks/use-game'
import { rateLabel } from '@/game/insights'
import { formatDuration } from '@/sim/time'

export function Transport({ onReset, onShowResult }: { onReset: () => void; onShowResult: () => void }) {
  const [game, snap] = useGame()
  const behind = !snap.atLive && snap.phase !== 'loading'
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
          <ToggleGroupItem key={s.label} value={String(i)} className="px-1.5 text-xs tabular sm:px-2">
            {s.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {snap.effectiveTps !== null && (
        <span className="text-xs text-tone-warn-foreground tabular" role="status" title="The simulation cannot keep up with the chosen speed on this device, so the meadow runs slower than the label.">
          running at {rateLabel(snap.effectiveTps)}
        </span>
      )}

      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular">
        {snap.phase === 'ended' && (
          <Button variant="outline" size="xs" onClick={onShowResult} className="gap-1">
            <Trophy className="size-3" /> Show result
          </Button>
        )}
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
