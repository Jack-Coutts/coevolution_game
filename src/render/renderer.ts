import { ANIMAL_STRIDE, BUSH_STRIDE, EVENT_KIND, EVENT_STRIDE, type FrameData } from '@/worker/protocol'
import { foxSheet, GAIT_FRAMES, rabbitSheet, type SpriteSheet } from './sprites'
import { paintBush, paintEarth, paintTerrain, type BushSprite, type TerrainLayers } from './terrain'

export interface Weather {
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
  illness: 900,
  old: 700,
  arrived: 1400,
  released: 1100,
  culled: 900,
  sprouted: 1400,
  withered: 1400,
}

/** Fox births and deaths are rare and matter, so they get longer, always-on markers. */
function fxDuration(f: Fx): number {
  if (f.species === 1 && (f.kind === 'born' || f.kind === 'old')) return 1800
  return FX_MS[f.kind]
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
  private patchStock = 30
  private terrain: TerrainLayers | null = null
  private rabbits: SpriteSheet | null = null
  private foxes: SpriteSheet | null = null
  private bushSprites = new Map<number, BushSprite>()
  private earth: HTMLCanvasElement | null = null
  private fx: Fx[] = []
  private idIndex = new Map<number, number>()
  private worldKey = ''
  private cover: [number, number][] = []
  private coverR = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    this.ctx = ctx
  }

  setWorld(cover: [number, number][], coverR: number, seed: number, patchStock: number): void {
    const key = `${seed}:${cover.map(([x, y]) => `${x},${y}`).join(';')}`
    this.patchStock = patchStock
    this.fx = []
    if (key === this.worldKey) return
    this.worldKey = key
    this.cover = cover
    this.coverR = coverR
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
    this.terrain = paintTerrain(
      this.size * this.dpr,
      this.seed,
      this.cover.map(([x, y]) => this.toCanvas(x, y, 1)),
      this.coverR * (1 - 2 * MARGIN),
    )
    this.earth = paintEarth(this.size * 0.12, this.dpr)
    this.rabbits = rabbitSheet(RABBIT_LEN * inner, this.dpr)
    this.foxes = foxSheet(FOX_LEN * inner, this.dpr)
    this.bushSprites.clear()
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
      const fox = ev[i + 1] === 1
      if (kind === 'old' && !fox) continue
      if (busy && !fox && (kind === 'born' || kind === 'starved')) continue
      if (busy && kind === 'sprouted' && this.fx.length > 12) continue
      this.fx.push({ kind, species: ev[i + 1], x: ev[i + 2], y: ev[i + 3], t0: now })
    }
    const cap = busy ? 24 : 240
    if (this.fx.length > cap) this.fx.splice(0, this.fx.length - cap)
  }

  clearFx(): void {
    this.fx = []
  }

  draw(a: FrameData, b: FrameData, alpha: number, weather: Weather, now: number): void {
    const { ctx, dpr } = this
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

    this.drawBushes(b.bushes)
    this.drawFx(now, 'under')
    this.drawAnimals(a.prey, b.prey, alpha, this.rabbits, RABBIT_LEN, now, 2.4)
    this.drawAnimals(a.preds, b.preds, alpha, this.foxes, FOX_LEN, now, 1.8)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(this.terrain.grass, 0, 0)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.drawFx(now, 'over')
  }

  private bushSprite(id: number): BushSprite {
    let sprite = this.bushSprites.get(id)
    if (!sprite) {
      const inner = this.size * (1 - 2 * MARGIN)
      sprite = paintBush(BUSH_R * inner, this.dpr, this.seed * 31 + id)
      this.bushSprites.set(id, sprite)
    }
    return sprite
  }

  /** Bushes come and go: a sprout grows in over two days, an overgrazed bush browns and shrinks before it withers. */
  private drawBushes(bushes: Float32Array): void {
    const ctx = this.ctx
    const inner = this.size * (1 - 2 * MARGIN)
    const live = new Set<number>()
    for (let i = 0; i < bushes.length; i += BUSH_STRIDE) {
      const id = bushes[i]
      live.add(id)
      const fullness = bushes[i + 3]
      const grown = bushes[i + 4]
      const wither = Math.min(1, bushes[i + 5])
      const sprite = this.bushSprite(id)
      const [x, y] = this.toCanvas(bushes[i + 1], bushes[i + 2], this.size)
      const s = sprite.size
      const g = 0.25 + 0.75 * (1 - (1 - grown) ** 2)
      if (this.earth) {
        const e = this.earth.width / this.dpr
        ctx.globalAlpha = 0.25 + 0.5 * grown
        ctx.drawImage(this.earth, x - e / 2, y - e / 2, e, e)
        ctx.globalAlpha = 1
      }
      ctx.drawImage(sprite.twigs, x - (s * g) / 2, y - (s * g) / 2, s * g, s * g)
      const k = (fullness * this.patchStock < 1 ? 0.34 : 0.42 + 0.58 * fullness) * g * (1 - 0.45 * wither)
      ctx.globalAlpha = (fullness * this.patchStock < 1 ? 0.75 : 1) * (1 - 0.55 * wither)
      ctx.drawImage(sprite.foliage, x - (s * k) / 2, y - (s * k) / 2, s * k, s * k)
      ctx.globalAlpha = 1
      if (wither > 0.2) {
        ctx.fillStyle = `rgba(150, 110, 55, ${0.45 * wither})`
        ctx.beginPath()
        ctx.arc(x, y, (s * k) / 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
      const r = BUSH_R * inner * k
      const n = Math.round(fullness * sprite.berries.length)
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
    if (this.bushSprites.size > live.size + 32) for (const id of this.bushSprites.keys()) if (!live.has(id)) this.bushSprites.delete(id)
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
      if (b[i + 21] > 0) {
        ctx.strokeStyle = '#bd85ff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, len * S * scale * 0.75, 0, Math.PI * 2)
        ctx.stroke()
      }
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
    this.fx = this.fx.filter((f) => now - f.t0 < fxDuration(f))
    for (const f of this.fx) {
      const t = (now - f.t0) / fxDuration(f)
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
          if (f.species === 1) {
            if (layer !== 'over') break
            const pulse = 1 - t
            ctx.strokeStyle = `rgba(255, 170, 90, ${0.95 * pulse})`
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(x, y, inner * (0.014 + 0.03 * t), 0, Math.PI * 2)
            ctx.stroke()
            ctx.strokeStyle = `rgba(255, 235, 200, ${0.7 * pulse})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(x, y, inner * (0.008 + 0.018 * t), 0, Math.PI * 2)
            ctx.stroke()
            ctx.fillStyle = `rgba(255, 245, 225, ${0.9 * pulse})`
            ctx.font = `600 ${Math.max(9, inner * 0.018)}px Geist Variable, sans-serif`
            ctx.textAlign = 'center'
            ctx.fillText('kit', x, y - inner * (0.03 + 0.02 * t))
            ctx.textAlign = 'left'
            break
          }
          if (layer !== 'under') break
          ctx.strokeStyle = f.species ? `rgba(255, 190, 120, ${0.5 * (1 - t)})` : `rgba(235, 250, 220, ${0.4 * (1 - t)})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(x, y, inner * (0.005 + 0.01 * t), 0, Math.PI * 2)
          ctx.stroke()
          break
        }
        case 'illness':
        case 'starved':
        case 'old': {
          if (layer !== 'under') break
          ctx.fillStyle = f.species === 1 ? `rgba(90, 80, 70, ${0.4 * (1 - t)})` : `rgba(120, 110, 95, ${0.22 * (1 - t)})`
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
        case 'sprouted': {
          if (layer !== 'under') break
          ctx.strokeStyle = `rgba(190, 240, 140, ${0.8 * (1 - t)})`
          ctx.lineWidth = 1.5
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + t * 1.5
            const d = inner * (0.012 + 0.02 * t)
            ctx.beginPath()
            ctx.moveTo(x + Math.cos(a) * d * 0.5, y + Math.sin(a) * d * 0.5)
            ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
            ctx.stroke()
          }
          break
        }
        case 'withered': {
          if (layer !== 'over') break
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + f.x * 30
            const d = inner * (0.01 + 0.03 * t)
            ctx.fillStyle = `rgba(160, 115, 55, ${0.8 * (1 - t)})`
            ctx.beginPath()
            ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d + inner * 0.01 * t, inner * 0.005, inner * 0.0025, a, 0, Math.PI * 2)
            ctx.fill()
          }
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
