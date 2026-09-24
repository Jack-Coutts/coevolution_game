import { Lightbulb, RotateCcw, Star, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Snapshot } from '@/game/controller'
import { formatDuration } from '@/sim/time'
import { cn } from '@/lib/utils'

export const STARS = [
  { tick: 90 * 24, label: '3 months' },
  { tick: 210 * 24, label: '7 months' },
  { tick: 8000, label: 'Full year' },
]

interface Props {
  snap: Snapshot
  open: boolean
  onOpenChange: (open: boolean) => void
  unspent: number
  onRetune: () => void
  onReplay: () => void
}

export function ResultDialog({ snap, open, onOpenChange, unspent, onRetune, onReplay }: Props) {
  const end = snap.end
  if (!end || !snap.explanation || snap.score === null) return null
  const e = snap.explanation
  const stars = STARS.filter((s) => end.tick >= s.tick).length
  const bonus = snap.score - end.tick
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-1">
            {STARS.map((s, i) => (
              <Star
                key={s.label}
                className={cn('size-6', i < stars ? 'fill-amber-300 text-amber-300' : 'text-muted-foreground/40')}
                aria-label={i < stars ? `Reached ${s.label}` : `Not reached: ${s.label}`}
              />
            ))}
          </div>
          <DialogTitle className="text-xl">{end.survived ? 'The meadow made it through the year.' : 'The meadow collapsed.'}</DialogTitle>
          <DialogDescription className="text-[15px] text-foreground/90">{e.headline}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{e.detail}</p>

        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Survived</div>
            <div className="text-sm font-semibold">{formatDuration(end.tick)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Budget bonus</div>
            <div className="text-sm font-semibold tabular">
              {end.survived ? `+${bonus}` : '—'}
              {end.survived && <span className="ml-1 text-xs font-normal text-muted-foreground">({Math.max(0, unspent)} pts)</span>}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Score</div>
            <div className="text-lg font-semibold text-primary tabular">{snap.score.toLocaleString()}</div>
          </div>
        </div>

        {snap.best && (
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="size-4 text-amber-300" />
            {snap.newBest ? (
              <span className="font-medium text-amber-200">New best for this scenario and seed!</span>
            ) : (
              <span className="text-muted-foreground">
                Best for this scenario and seed: <span className="text-foreground tabular">{snap.best.score.toLocaleString()}</span>
              </span>
            )}
          </div>
        )}

        {e.suggestions.length > 0 && (
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/8 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-200 uppercase">
              <Lightbulb className="size-3.5" /> {end.survived ? 'Next' : 'Try'}
            </div>
            <ul className="list-disc pl-5 text-sm text-amber-50/90">
              {e.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onReplay}>
            Watch the replay
          </Button>
          <Button onClick={onRetune} className="gap-1.5">
            <RotateCcw className="size-4" /> Retune and retry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
