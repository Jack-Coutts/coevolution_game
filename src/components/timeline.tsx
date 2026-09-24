import { useEffect, useRef, useState } from 'react'
import { forecast } from '@/game/insights'
import { useGame } from '@/hooks/use-game'
import { dateLabel, monthStarts } from '@/sim/time'
import { STAT, STAT_STRIDE } from '@/worker/protocol'

const H = 132
const PAD_L = 30
const PAD_R = 30
const PAD_T = 14
const PAD_B = 20

const RABBIT = '#dcc7a3'
const FOX = '#ec8a45'
const BERRY = 'rgba(143, 191, 106, 0.22)'

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
    return Math.round(Math.max(0, Math.min(1, f)) * game.history.horizon)
  }

  useEffect(() => {
    let raf = 0
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
      const p = game.params
      const horizon = h.horizon
      const iw = W - PAD_L - PAD_R
      const ih = H - PAD_T - PAD_B
      const xOf = (t: number) => PAD_L + (t / horizon) * iw
      const preyMax = Math.max(10, p?.prey.cap ?? 150)
      const predMax = Math.max(4, (p?.pred.cap ?? 40) + (game.scenario.disturbance.arrivals.reduce((s, a) => s + (a.species === 'pred' ? a.capBoost : 0), 0)))
      const yPrey = (v: number) => PAD_T + ih - (v / preyMax) * ih
      const yPred = (v: number) => PAD_T + ih - (v / predMax) * ih

      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      ctx.fillRect(PAD_L, PAD_T, iw, ih)

      for (const s of game.scenario.spans) {
        ctx.fillStyle = s.tone === 'winter' ? 'rgba(186, 220, 255, 0.10)' : 'rgba(240, 190, 90, 0.10)'
        ctx.fillRect(xOf(s.from), PAD_T, xOf(Math.min(horizon, s.to)) - xOf(s.from), ih)
        ctx.fillStyle = s.tone === 'winter' ? 'rgba(186, 220, 255, 0.7)' : 'rgba(240, 190, 90, 0.8)'
        ctx.font = '500 10px Geist Variable, sans-serif'
        ctx.fillText(s.label, xOf(s.from) + 4, PAD_T + 10)
      }

      ctx.font = '10px Geist Variable, sans-serif'
      ctx.textAlign = 'center'
      for (const m of monthStarts(horizon)) {
        const x = xOf(m.tick)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.beginPath()
        ctx.moveTo(x, PAD_T)
        ctx.lineTo(x, PAD_T + ih)
        ctx.stroke()
      }
      const labels = [{ tick: 0, label: 'Sep' }, ...monthStarts(horizon)]
      labels.forEach((m, i) => {
        const next = labels[i + 1]?.tick ?? horizon
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fillText(m.label, xOf((m.tick + next) / 2), H - 6)
      })
      ctx.textAlign = 'left'

      const head = h.head
      const step = Math.max(1, Math.floor(horizon / iw / 1.5))
      const st = h.stats
      if (head > 0) {
        ctx.beginPath()
        ctx.moveTo(xOf(0), PAD_T + ih)
        for (let t = 0; t <= head; t += step) ctx.lineTo(xOf(t), PAD_T + ih - Math.min(1, st[t * STAT_STRIDE + STAT.stock]) * ih)
        ctx.lineTo(xOf(head), PAD_T + ih - Math.min(1, st[head * STAT_STRIDE + STAT.stock]) * ih)
        ctx.lineTo(xOf(head), PAD_T + ih)
        ctx.closePath()
        ctx.fillStyle = BERRY
        ctx.fill()

        const line = (key: number, y: (v: number) => number, color: string, width: number) => {
          ctx.beginPath()
          for (let t = 0; t <= head; t += step) {
            const v = st[t * STAT_STRIDE + key]
            if (t === 0) ctx.moveTo(xOf(t), y(v))
            else ctx.lineTo(xOf(t), y(v))
          }
          ctx.lineTo(xOf(head), y(st[head * STAT_STRIDE + key]))
          ctx.strokeStyle = color
          ctx.lineWidth = width
          ctx.lineJoin = 'round'
          ctx.stroke()
        }
        line(STAT.prey, yPrey, RABBIT, 1.8)
        line(STAT.pred, yPred, FOX, 1.8)

        const f = !game.getSnapshot().end ? forecast(h, head) : null
        if (f && f.ahead > 0) {
          ctx.setLineDash([4, 4])
          ctx.lineWidth = 1.3
          ctx.strokeStyle = 'rgba(220, 199, 163, 0.7)'
          ctx.beginPath()
          ctx.moveTo(xOf(head), yPrey(st[head * STAT_STRIDE + STAT.prey]))
          ctx.lineTo(xOf(head + f.ahead), yPrey(Math.min(preyMax, f.prey)))
          ctx.stroke()
          ctx.strokeStyle = 'rgba(236, 138, 69, 0.75)'
          ctx.beginPath()
          ctx.moveTo(xOf(head), yPred(st[head * STAT_STRIDE + STAT.pred]))
          ctx.lineTo(xOf(head + f.ahead), yPred(Math.min(predMax, f.pred)))
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      if (head < horizon) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(xOf(head), PAD_T, xOf(horizon) - xOf(head), ih)
      }

      for (const m of game.scenario.markers) {
        const x = xOf(m.tick)
        ctx.strokeStyle = 'rgba(236, 138, 69, 0.8)'
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(x, PAD_T)
        ctx.lineTo(x, PAD_T + ih)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(236, 138, 69, 0.95)'
        ctx.font = '500 10px Geist Variable, sans-serif'
        ctx.fillText(m.label, x + 4, PAD_T + 10)
      }
      for (const iv of h.interventions) {
        const x = xOf(iv.tick)
        ctx.fillStyle = '#f5d67b'
        ctx.beginPath()
        ctx.moveTo(x, PAD_T + 1)
        ctx.lineTo(x + 4, PAD_T + 7)
        ctx.lineTo(x - 4, PAD_T + 7)
        ctx.closePath()
        ctx.fill()
      }

      // axes labels
      ctx.font = '10px Geist Variable, sans-serif'
      ctx.fillStyle = RABBIT
      ctx.textAlign = 'right'
      ctx.fillText(String(preyMax), PAD_L - 5, PAD_T + 8)
      ctx.fillText('0', PAD_L - 5, PAD_T + ih)
      ctx.fillStyle = FOX
      ctx.textAlign = 'left'
      ctx.fillText(String(predMax), W - PAD_R + 5, PAD_T + 8)
      ctx.fillText('0', W - PAD_R + 5, PAD_T + ih)

      const t = game.displayTickValue
      const x = xOf(t)
      ctx.strokeStyle = '#f7e2a8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, PAD_T - 4)
      ctx.lineTo(x, PAD_T + ih)
      ctx.stroke()
      ctx.fillStyle = '#f7e2a8'
      ctx.beginPath()
      ctx.arc(x, PAD_T - 4, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
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
        aria-valuemin={0}
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
