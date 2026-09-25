import { visibleSpans } from '@/sim/scenarios'
import { useEffect, useRef, useState } from 'react'
import { forecast } from '@/game/insights'
import { useGame } from '@/hooks/use-game'
import { onThemeChange } from '@/hooks/use-theme'
import { dateLabel, monthStarts } from '@/sim/time'
import { STAT } from '@/worker/protocol'

const H = 132
const PAD_L = 30
const PAD_R = 30
const PAD_T = 14
const PAD_B = 20

const TOKENS = ['rabbit', 'fox', 'berry', 'gold', 'primary', 'border', 'muted', 'muted-foreground', 'background', 'tone-info-foreground', 'tone-warn-foreground'] as const
type Palette = Record<(typeof TOKENS)[number], string>

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  return Object.fromEntries(TOKENS.map((k) => [k, css.getPropertyValue(`--${k}`).trim()])) as Palette
}

export function Timeline() {
  const [game, snap] = useGame()
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ x: number; tick: number; width: number } | null>(null)
  const dragging = useRef(false)

  const tickFromX = (clientX: number): number => {
    const el = canvas.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const f = (clientX - r.left - PAD_L) / (r.width - PAD_L - PAD_R)
    return game.history.firstTick + Math.round(Math.max(0, Math.min(1, f)) * (game.history.horizon - game.history.firstTick))
  }

  useEffect(() => {
    let raf = 0
    let c = readPalette()
    const stopWatching = onThemeChange(() => { c = readPalette() })
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const el = canvas.current
      const box = wrap.current
      if (!el || !box) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = box.clientWidth
      if (el.width !== Math.round(W * dpr)) {
        el.width = Math.round(W * dpr)
        el.height = Math.round(H * dpr)
        el.style.width = `${W}px`
        el.style.height = `${H}px`
      }
      const ctx = el.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const h = game.history
      const horizon = h.horizon
      const start = h.firstTick
      const iw = W - PAD_L - PAD_R
      const ih = H - PAD_T - PAD_B
      const xOf = (t: number) => PAD_L + ((t - start) / (horizon - start)) * iw
      let preyMax = 10
      let predMax = 4
      for (let t = start; t <= h.head; t += 12) {
        preyMax = Math.max(preyMax, h.stat(t, 'prey'))
        predMax = Math.max(predMax, h.stat(t, 'pred'))
      }
      preyMax = Math.ceil(preyMax * 1.15)
      predMax = Math.ceil(predMax * 1.15)
      const yPrey = (v: number) => PAD_T + ih - (v / preyMax) * ih
      const yPred = (v: number) => PAD_T + ih - (v / predMax) * ih

      ctx.fillStyle = c.muted
      ctx.globalAlpha = 0.5
      ctx.fillRect(PAD_L, PAD_T, iw, ih)

      for (const s of visibleSpans(game.scenario, start, horizon, h.endless)) {
        if (s.to < start || s.from > horizon) continue
        ctx.fillStyle = s.tone === 'winter' ? c['tone-info-foreground'] : c['tone-warn-foreground']
        ctx.globalAlpha = 0.12
        ctx.fillRect(xOf(Math.max(start, s.from)), PAD_T, xOf(Math.min(horizon, s.to)) - xOf(Math.max(start, s.from)), ih)
        ctx.globalAlpha = 0.9
        ctx.font = '500 10px Geist Variable, sans-serif'
        ctx.fillText(s.label, xOf(Math.max(start, s.from)) + 4, PAD_T + 10)
      }
      ctx.globalAlpha = 1

      ctx.font = '10px Geist Variable, sans-serif'
      ctx.textAlign = 'center'
      for (const m of monthStarts(horizon, start)) {
        const x = xOf(m.tick)
        ctx.strokeStyle = c.border
        ctx.beginPath()
        ctx.moveTo(x, PAD_T)
        ctx.lineTo(x, PAD_T + ih)
        ctx.stroke()
      }
      const labels = [{ tick: start, label: dateLabel(start) }, ...monthStarts(horizon, start)]
      labels.forEach((m, i) => {
        const next = labels[i + 1]?.tick ?? horizon
        ctx.fillStyle = c['muted-foreground']
        ctx.fillText(m.label, xOf((m.tick + next) / 2), H - 6)
      })
      ctx.textAlign = 'left'

      const head = h.head
      const step = Math.max(1, Math.floor((horizon - start) / iw / 1.5))
      if (head > 0) {
        ctx.beginPath()
        ctx.moveTo(xOf(start), PAD_T + ih)
        for (let t = start; t <= head; t += step) ctx.lineTo(xOf(t), PAD_T + ih - Math.min(1, h.stat(t, 'stock')) * ih)
        ctx.lineTo(xOf(head), PAD_T + ih - Math.min(1, h.stat(head, 'stock')) * ih)
        ctx.lineTo(xOf(head), PAD_T + ih)
        ctx.closePath()
        ctx.fillStyle = c.berry
        ctx.globalAlpha = 0.22
        ctx.fill()
        ctx.globalAlpha = 1

        const line = (key: keyof typeof STAT, y: (v: number) => number, color: string, width: number) => {
          ctx.beginPath()
          for (let t = start; t <= head; t += step) {
            const v = h.stat(t, key)
            if (t === start) ctx.moveTo(xOf(t), y(v))
            else ctx.lineTo(xOf(t), y(v))
          }
          ctx.lineTo(xOf(head), y(h.stat(head, key)))
          ctx.strokeStyle = color
          ctx.lineWidth = width
          ctx.lineJoin = 'round'
          ctx.stroke()
        }
        line('prey', yPrey, c.rabbit, 1.8)
        line('pred', yPred, c.fox, 1.8)

        const f = !game.getSnapshot().end ? forecast(h, head) : null
        if (f && f.ahead > 0) {
          ctx.setLineDash([4, 4])
          ctx.lineWidth = 1.3
          ctx.globalAlpha = 0.75
          ctx.strokeStyle = c.rabbit
          ctx.beginPath()
          ctx.moveTo(xOf(head), yPrey(h.stat(head, 'prey')))
          ctx.lineTo(xOf(head + f.ahead), yPrey(Math.min(preyMax, f.prey)))
          ctx.stroke()
          ctx.strokeStyle = c.fox
          ctx.beginPath()
          ctx.moveTo(xOf(head), yPred(h.stat(head, 'pred')))
          ctx.lineTo(xOf(head + f.ahead), yPred(Math.min(predMax, f.pred)))
          ctx.stroke()
          ctx.setLineDash([])
          ctx.globalAlpha = 1
        }
      }

      if (head < horizon) {
        ctx.fillStyle = c.background
        ctx.globalAlpha = 0.5
        ctx.fillRect(xOf(head), PAD_T, xOf(horizon) - xOf(head), ih)
        ctx.globalAlpha = 1
      }

      for (const m of game.scenario.markers) {
        if (m.tick < start) continue
        const x = xOf(m.tick)
        ctx.strokeStyle = c.fox
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(x, PAD_T)
        ctx.lineTo(x, PAD_T + ih)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = c.fox
        ctx.font = '500 10px Geist Variable, sans-serif'
        ctx.fillText(m.label, x + 4, PAD_T + 10)
      }
      for (const iv of h.interventions) {
        if (iv.tick < start) continue
        const x = xOf(iv.tick)
        ctx.fillStyle = c.gold
        ctx.beginPath()
        ctx.moveTo(x, PAD_T + 1)
        ctx.lineTo(x + 4, PAD_T + 7)
        ctx.lineTo(x - 4, PAD_T + 7)
        ctx.closePath()
        ctx.fill()
      }

      // axes labels
      ctx.font = '10px Geist Variable, sans-serif'
      ctx.fillStyle = c.rabbit
      ctx.textAlign = 'right'
      ctx.fillText(String(preyMax), PAD_L - 5, PAD_T + 8)
      ctx.fillText('0', PAD_L - 5, PAD_T + ih)
      ctx.fillStyle = c.fox
      ctx.textAlign = 'left'
      ctx.fillText(String(predMax), W - PAD_R + 5, PAD_T + 8)
      ctx.fillText('0', W - PAD_R + 5, PAD_T + ih)

      const t = game.displayTickValue
      const x = xOf(t)
      ctx.strokeStyle = c.primary
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, PAD_T - 4)
      ctx.lineTo(x, PAD_T + ih)
      ctx.stroke()
      ctx.fillStyle = c.primary
      ctx.beginPath()
      ctx.arc(x, PAD_T - 4, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); stopWatching() }
  }, [game])

  const onDown = (e: React.PointerEvent) => {
    if (snap.phase === 'loading' || snap.head === 0) return
    dragging.current = true
    ;(e.target as Element).setPointerCapture(e.pointerId)
    game.seek(tickFromX(e.clientX))
  }
  const onMove = (e: React.PointerEvent) => {
    const tick = tickFromX(e.clientX)
    const r = canvas.current?.getBoundingClientRect()
    setHover(r ? { x: e.clientX - r.left, tick, width: r.width } : null)
    if (dragging.current) game.seek(tick)
  }
  const onUp = () => {
    dragging.current = false
  }

  const ht = hover && hover.tick <= snap.head ? hover.tick : null
  return (
    <div ref={wrap} className="relative select-none">
      <canvas
        ref={canvas}
        className="block cursor-crosshair touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setHover(null)}
        role="slider"
        aria-label="Population timeline. Click or drag to replay an earlier moment."
        aria-valuemin={game.history.firstTick}
        aria-valuemax={snap.horizon}
        aria-valuenow={snap.tick}
        aria-valuetext={dateLabel(snap.tick)}
      />
      {hover && ht !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border bg-popover/95 px-2 py-1 text-[11px] whitespace-nowrap shadow-lg tabular"
          style={{ left: Math.max(60, Math.min(hover.x, hover.width - 60)) }}
        >
          <span className="font-medium">{dateLabel(ht)}</span>
          <span className="ml-2 text-rabbit">{game.history.stat(ht, 'prey')} rabbits</span>
          <span className="ml-2 text-fox">{game.history.stat(ht, 'pred')} foxes</span>
          <span className="ml-2 text-berry">{Math.round(game.history.stat(ht, 'stock') * 100)}% berries</span>
        </div>
      )}
    </div>
  )
}
