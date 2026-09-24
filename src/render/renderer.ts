import { ANIMAL_STRIDE, EVENT_KIND, EVENT_STRIDE, type FrameData } from '@/worker/protocol'
import { foxSheet, GAIT_FRAMES, rabbitSheet, type SpriteSheet } from './sprites'
import { paintBush, paintTerrain, type BushSprite, type TerrainLayers } from './terrain'

export interface Weather {
  /** 0 = midnight .. 1 = full day. */
  daylight: number
  /** How strongly night is shown (fades at fast playback). */
  nightAmp: number
  snow: number
  warm: number
  dry: number
}

interface Fx {
  kind: (typeof EVENT_KIND)[number]
  species: number
  x: number
  y: number
  t0: number
}

const FX_MS: Record<Fx['kind'], number> = {
  eaten: 700,
  born: 600,
  starved: 700,
  old: 700,
  arrived: 1400,
  released: 1100,
  culled: 900,
}

const RABBIT_LEN = 0.033
const FOX_LEN = 0.052
const BUSH_R = 0.03
const MARGIN = 0.025

export class WorldRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private size = 0
  private dpr = 1
  private seed = 0
  private patches: [number, number][] = []
  private patchStock = 30
  private terrain: TerrainLayers | null = null
  private rabbits: SpriteSheet | null = null
  private foxes: SpriteSheet | null = null
  private bushes: BushSprite[] = []
  private fx: Fx[] = []
  private idIndex = new Map<number, number>()
  private worldKey = ''

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    this.ctx = ctx
  }

  setWorld(patches: [number, number][], seed: number, patchStock: number): void {
    const key = `${seed}:${patches.map(([x, y]) => `${x},${y}`).join(';')}`
    this.patchStock = patchStock
    this.fx = []
    if (key === this.worldKey) return
    this.worldKey = key
    this.patches = patches
    this.seed = seed
    this.rebuild()
  }

  resize(cssSize: number, dpr: number): void {
    const size = Math.max(200, Math.floor(cssSize))
    if (size === this.size && dpr === this.dpr) return
    this.size = size
    this.dpr = dpr
    this.canvas.width = Math.round(size * dpr)
    this.canvas.height = Math.round(size * dpr)
    this.canvas.style.width = `${size}px`
    this.canvas.style.height = `${size}px`
    this.rebuild()
  }

  private rebuild(): void {
    if (!this.size) return
    const inner = this.size * (1 - 2 * MARGIN)
    this.terrain = paintTerrain(this.size * this.dpr, this.seed, this.patches.map(([x, y]) => this.toCanvas(x, y, 1)))
    this.rabbits = rabbitSheet(RABBIT_LEN * inner, this.dpr)
    this.foxes = foxSheet(FOX_LEN * inner, this.dpr)
    this.bushes = this.patches.map((_, i) => paintBush(BUSH_R * inner, this.dpr, this.seed * 31 + i))
  }

  /** Unit world coords to canvas coords as a fraction (scale=1) or CSS px (scale=size). */
  private toCanvas(x: number, y: number, scale: number): [number, number] {
    return [(MARGIN + x * (1 - 2 * MARGIN)) * scale, (MARGIN + y * (1 - 2 * MARGIN)) * scale]
  }

  /** CSS-pixel position of a world point, for overlays. */
  worldToCss(x: number, y: number): [number, number] {
    return this.toCanvas(x, y, this.size)
  }

  cssToWorld(px: number, py: number): [number, number] {
    const f = 1 - 2 * MARGIN
    return [(px / this.size - MARGIN) / f, (py / this.size - MARGIN) / f]
  }

  /** `busy` (fast playback) keeps only the dramatic effects. */
  addEvents(frame: FrameData, now: number, busy: boolean): void {
    const ev = frame.events
    for (let i = 0; i < ev.length; i += EVENT_STRIDE) {
      const kind = EVENT_KIND[ev[i]]
      if (kind === 'old') continue
      if (busy && (kind === 'born' || kind === 'starved')) continue
      this.fx.push({ kind, species: ev[i + 1], x: ev[i + 2], y: ev[i + 3], t0: now })
    }
    if (this.fx.length > 240) this.fx.splice(0, this.fx.length - 240)
  }

  clearFx(): void {
    this.fx = []
  }

  draw(a: FrameData, b: FrameData, alpha: number, weather: Weather, now: number): void {
    const { ctx, size, dpr } = this
    if (!this.terrain || !this.rabbits || !this.foxes) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(this.terrain.base, 0, 0)
    if (weather.warm > 0.01) {
      ctx.fillStyle = `rgba(214, 150, 60, ${0.12 * weather.warm})`
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    if (weather.dry > 0.01) {
      ctx.fillStyle = `rgba(196, 160, 84, ${0.32 * weather.dry})`
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    if (weather.snow > 0.01) {
      ctx.globalAlpha = Math.min(1, weather.snow)
      ctx.drawImage(this.terrain.snow, 0, 0)
      ctx.globalAlpha = 1
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    this.drawBushes(b.stock)
    this.drawFx(now, 'under')
    this.drawAnimals(a.prey, b.prey, alpha, this.rabbits, RABBIT_LEN, now, 2.4)
    this.drawAnimals(a.preds, b.preds, alpha, this.foxes, FOX_LEN, now, 1.8)
    this.drawFx(now, 'over')

    const night = (1 - weather.daylight) * weather.nightAmp
    if (night > 0.01) {
      ctx.fillStyle = `rgba(14, 22, 52, ${0.5 * night})`
      ctx.fillRect(0, 0, size, size)
    }
    const dusk = Math.max(0, 1 - Math.abs(weather.daylight - 0.45) / 0.25) * weather.nightAmp
    if (dusk > 0.01) {
      ctx.fillStyle = `rgba(240, 150, 70, ${0.1 * dusk})`
      ctx.fillRect(0, 0, size, size)
    }
  }

  private drawBushes(stock: Float32Array): void {
    const ctx = this.ctx
    const inner = this.size * (1 - 2 * MARGIN)
    this.patches.forEach(([px, py], i) => {
      const sprite = this.bushes[i]
      if (!sprite) return
      const f = Math.max(0, Math.min(1, stock[i] / this.patchStock))
      const [x, y] = this.toCanvas(px, py, this.size)
      const s = sprite.size
      ctx.drawImage(sprite.twigs, x - s / 2, y - s / 2, s, s)
      if (stock[i] >= 1) {
        const k = 0.42 + 0.58 * f
        ctx.drawImage(sprite.foliage, x - (s * k) / 2, y - (s * k) / 2, s * k, s * k)
        const r = BUSH_R * inner * k
        const n = Math.round(f * sprite.berries.length)
        for (let j = 0; j < n; j++) {
          const [bx, by] = sprite.berries[j]
          ctx.fillStyle = j % 3 === 0 ? '#7a1f3d' : '#b3263e'
          ctx.beginPath()
          ctx.arc(x + bx * r, y + by * r, Math.max(1.2, r * 0.085), 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,0.55)'
          ctx.beginPath()
          ctx.arc(x + bx * r - r * 0.025, y + by * r - r * 0.025, Math.max(0.4, r * 0.028), 0, Math.PI * 2)
          ctx.fill()
        }
      }
    })
  }

  private drawAnimals(
    a: Float32Array,
    b: Float32Array,
    alpha: number,
    sheet: SpriteSheet,
    len: number,
    now: number,
    gaitHz: number,
  ): void {
    const ctx = this.ctx
    const idx = this.idIndex
    idx.clear()
    for (let i = 0; i < a.length; i += ANIMAL_STRIDE) idx.set(a[i], i)
    const S = this.size
    for (let i = 0; i < b.length; i += ANIMAL_STRIDE) {
      const id = b[i]
      const j = idx.get(id)
      let x = b[i + 1]
      let y = b[i + 2]
      let ang = Math.atan2(b[i + 4], b[i + 3])
      let fade = 1
      if (j !== undefined) {
        x = a[j + 1] + (x - a[j + 1]) * alpha
        y = a[j + 2] + (y - a[j + 2]) * alpha
        const a0 = Math.atan2(a[j + 4], a[j + 3])
        let d = ang - a0
        if (d > Math.PI) d -= 2 * Math.PI
        if (d < -Math.PI) d += 2 * Math.PI
        ang = a0 + d * alpha
      } else {
        fade = alpha
      }
      const maturity = b[i + 6]
      const pace = b[i + 7]
      const scale = 0.55 + 0.45 * maturity
      const phase = pace > 0.04 ? (now / 1000) * gaitHz * (0.4 + pace) + id * 0.618 : id * 0.618
      const frame = sheet.frames[Math.floor((phase % 1) * GAIT_FRAMES) % GAIT_FRAMES]
      const [cx, cy] = this.toCanvas(x, y, S)
      const s = sheet.size * scale
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(cx, cy)
      ctx.rotate(ang)
      ctx.drawImage(frame, -s / 2, -s / 2, s, s)
      ctx.restore()
      if (b[i + 5] < 0.2) this.drawTired(cx, cy, len * S * scale)
    }
    ctx.globalAlpha = 1
  }

  private drawTired(cx: number, cy: number, r: number): void {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(255, 236, 200, 0.55)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawFx(now: number, layer: 'under' | 'over'): void {
    const ctx = this.ctx
    const S = this.size
    const inner = S * (1 - 2 * MARGIN)
    this.fx = this.fx.filter((f) => now - f.t0 < FX_MS[f.kind])
    for (const f of this.fx) {
      const t = (now - f.t0) / FX_MS[f.kind]
      const [x, y] = this.toCanvas(f.x, f.y, S)
      switch (f.kind) {
        case 'eaten': {
          if (layer !== 'over') break
          const r = inner * (0.01 + 0.03 * t)
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * Math.PI * 2 + f.x * 40
            ctx.fillStyle = `rgba(226, 214, 196, ${0.8 * (1 - t)})`
            ctx.beginPath()
            ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, inner * 0.004 * (1.4 - t), 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.strokeStyle = `rgba(170, 40, 30, ${0.55 * (1 - t)})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(x, y, inner * (0.008 + 0.02 * t), 0, Math.PI * 2)
          ctx.stroke()
          break
        }
        case 'born': {
          if (layer !== 'under') break
          ctx.strokeStyle = f.species ? `rgba(255, 190, 120, ${0.5 * (1 - t)})` : `rgba(235, 250, 220, ${0.4 * (1 - t)})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(x, y, inner * (0.005 + 0.01 * t), 0, Math.PI * 2)
          ctx.stroke()
          break
        }
        case 'starved':
        case 'old': {
          if (layer !== 'under') break
          ctx.fillStyle = `rgba(120, 110, 95, ${0.22 * (1 - t)})`
          ctx.beginPath()
          ctx.arc(x, y, inner * (0.008 + 0.01 * t), 0, Math.PI * 2)
          ctx.fill()
          break
        }
        case 'arrived':
        case 'released':
        case 'culled': {
          if (layer !== 'over') break
          const color = f.kind === 'culled' ? '150, 150, 150' : f.species ? '255, 140, 60' : '250, 245, 225'
          ctx.strokeStyle = `rgba(${color}, ${0.85 * (1 - t)})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, inner * (0.012 + 0.03 * t), 0, Math.PI * 2)
          ctx.stroke()
          break
        }
        default: {
          const never: never = f.kind
          throw new Error(`unknown fx ${String(never)}`)
        }
      }
    }
  }
}
