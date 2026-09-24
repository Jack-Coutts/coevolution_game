import { useState } from 'react'
import { Check, Dices, Link2, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { dailySeed, type SeedChoice } from '@/game/seed'
import { cn } from '@/lib/utils'

export function MeadowSettings({ choice, onChange }: { choice: SeedChoice; onChange: (c: SeedChoice) => void }) {
  const [copied, setCopied] = useState(false)
  const custom = choice.kind === 'custom' ? choice.seed : null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Meadow settings">
          <Settings2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Meadow</div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              className="w-full"
              value={choice.kind}
              onValueChange={(v) => {
                if (v === 'daily') onChange({ kind: 'daily' })
                if (v === 'custom') onChange({ kind: 'custom', seed: custom ?? randomSeed() })
              }}
            >
              <ToggleGroupItem value="daily" className="flex-1">
                Today&apos;s meadow
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" className="flex-1">
                Custom seed
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {choice.kind === 'daily'
                ? `Everyone plays seed ${dailySeed()} today.`
                : 'The same seed always grows the same meadow.'}
            </p>
          </div>
          <div className={cn('flex items-center gap-1.5', choice.kind !== 'custom' && 'opacity-50')}>
            <Input
              type="number"
              inputMode="numeric"
              aria-label="Seed"
              value={custom ?? dailySeed()}
              disabled={choice.kind !== 'custom'}
              onChange={(e) => {
                const n = Math.abs(Math.trunc(Number(e.target.value)))
                if (Number.isFinite(n)) onChange({ kind: 'custom', seed: n })
              }}
              className="tabular"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Random seed"
              onClick={() => onChange({ kind: 'custom', seed: randomSeed() })}
            >
              <Dices />
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={copy} className="gap-1.5">
            {copied ? <Check /> : <Link2 />} {copied ? 'Link copied' : 'Copy link to this meadow'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function randomSeed(): number {
  return Math.floor(Math.random() * 100000)
}
