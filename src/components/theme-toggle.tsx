import { Monitor, Moon, Sun } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Theme } from '@/hooks/use-theme'

const OPTIONS = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
  { value: 'system', label: 'System theme', icon: Monitor },
] as const

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={theme}
      onValueChange={(v) => v && onChange(v as Theme)}
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} title={label} className="px-2">
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
