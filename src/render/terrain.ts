/** Calm procedural meadow and berry bushes. Visual only; seeded so a seed always looks the same. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(px: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = Math.ceil(px)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  return [c, ctx]
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color.replace('ALPHA', String(alpha)))
  g.addColorStop(1, color.replace('ALPHA', '0'))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

export interface TerrainLayers {
  base: HTMLCanvasElement
  snow: HTMLCanvasElement
}

/** The meadow at `size` device pixels. Patches are in unit coordinates. */
export function paintTerrain(size: number, seed: number, patches: [number, number][]): TerrainLayers {
  const rand = mulberry32(seed * 7919 + 17)
  const [c, ctx] = canvas(size)
  const S = size

  const base = ctx.createLinearGradient(0, 0, S, S)
  base.addColorStop(0, '#86a860')
  base.addColorStop(0.5, '#7b9f57')
  base.addColorStop(1, '#6f9350')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)

  // broad, soft variation in the sward
  for (let i = 0; i < 70; i++) {
    const light = rand() < 0.5
    blob(
      ctx,
      rand() * S,
      rand() * S,
      S * (0.08 + rand() * 0.22),
      light ? 'rgba(170, 196, 110, ALPHA)' : 'rgba(70, 108, 52, ALPHA)',
      0.1 + rand() * 0.14,
    )
  }
  // a few damp hollows
  for (let i = 0; i < 5; i++) {
    blob(ctx, rand() * S, rand() * S, S * (0.06 + rand() * 0.08), 'rgba(58, 96, 60, ALPHA)', 0.22)
  }

  // grazed earth around each bush
  for (const [px, py] of patches) {
    const x = px * S
    const y = py * S
    blob(ctx, x, y, S * 0.06, 'rgba(150, 128, 82, ALPHA)', 0.45)
    blob(ctx, x, y, S * 0.035, 'rgba(128, 104, 66, ALPHA)', 0.35)
  }

  // grass tufts
  const tufts = Math.round((S * S) / 90)
  ctx.lineCap = 'round'
  for (let i = 0; i < tufts; i++) {
    const x = rand() * S
    const y = rand() * S
    const len = S * (0.004 + rand() * 0.006)
    const shade = rand()
    ctx.strokeStyle =
      shade < 0.33 ? 'rgba(60, 96, 42, 0.45)' : shade < 0.66 ? 'rgba(150, 184, 98, 0.4)' : 'rgba(98, 138, 64, 0.45)'
    ctx.lineWidth = Math.max(1, S * 0.0014)
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a + 0.5) * len * 0.7, y + Math.sin(a + 0.5) * len * 0.7)
    ctx.stroke()
  }

  // wildflower drifts
  const palette = ['#f6f1e4', '#f3d65a', '#c7a6de', '#f1b7c4']
  for (let d = 0; d < 14; d++) {
    const cx = rand() * S
    const cy = rand() * S
    const color = palette[Math.floor(rand() * palette.length)]
    const n = 8 + Math.floor(rand() * 18)
    for (let i = 0; i < n; i++) {
      const r = S * 0.03 * Math.sqrt(rand())
      const a = rand() * Math.PI * 2
      ctx.fillStyle = color
      ctx.globalAlpha = 0.75
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(0.8, S * 0.0022), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  // rocks, kept clear of bushes
  let placed = 0
  for (let tries = 0; tries < 200 && placed < 7; tries++) {
    const x = rand()
    const y = rand()
    if (patches.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < 0.08 ** 2)) continue
    placed++
    drawRock(ctx, x * S, y * S, S * (0.008 + rand() * 0.012), rand)
  }

  // soft vignette
  const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(20, 35, 15, 0.28)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, S, S)

  return { base: c, snow: paintSnow(size, seed) }
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rand: () => number): void {
  ctx.fillStyle = 'rgba(25, 35, 20, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x + r * 0.25, y + r * 0.3, r * 1.1, r * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()
  const pts = 8
  ctx.beginPath()
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2
    const rr = r * (0.8 + rand() * 0.3)
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr * 0.8
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.1)
  g.addColorStop(0, '#c9c6bb')
  g.addColorStop(1, '#85827a')
  ctx.fillStyle = g
  ctx.fill()
  ctx.fillStyle = 'rgba(110, 140, 80, 0.35)'
  ctx.beginPath()
  ctx.ellipse(x + r * 0.2, y + r * 0.35, r * 0.4, r * 0.2, 0.3, 0, Math.PI * 2)
  ctx.fill()
}

function paintSnow(size: number, seed: number): HTMLCanvasElement {
  const rand = mulberry32(seed * 31 + 5)
  const [c, ctx] = canvas(size)
  const S = size
  ctx.fillStyle = 'rgba(236, 242, 248, 0.55)'
  ctx.fillRect(0, 0, S, S)
  for (let i = 0; i < 60; i++) {
    blob(ctx, rand() * S, rand() * S, S * (0.05 + rand() * 0.16), 'rgba(255, 255, 255, ALPHA)', 0.35 + rand() * 0.3)
  }
  for (let i = 0; i < 18; i++) {
    blob(ctx, rand() * S, rand() * S, S * (0.04 + rand() * 0.06), 'rgba(150, 170, 150, ALPHA)', 0.2)
  }
  return c
}

export interface BushSprite {
  foliage: HTMLCanvasElement
  twigs: HTMLCanvasElement
  berries: [number, number][]
  size: number
}

/** One berry bush, `r` CSS px radius at full stock. Berries are placed at unit offsets. */
export function paintBush(r: number, dpr: number, variant: number): BushSprite {
  const rand = mulberry32(variant * 104729 + 3)
  const size = r * 2.6
  const [f, ctx] = canvas(size * dpr)
  ctx.scale(dpr, dpr)
  ctx.translate(size / 2, size / 2)
  ctx.fillStyle = 'rgba(15, 30, 10, 0.35)'
  ctx.beginPath()
  ctx.ellipse(r * 0.12, r * 0.16, r * 1.05, r * 0.95, 0, 0, Math.PI * 2)
  ctx.fill()
  const lobes = 9
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + rand() * 0.6 + layer
      const d = r * (0.55 - layer * 0.2) * (0.8 + rand() * 0.3)
      const x = Math.cos(a) * d
      const y = Math.sin(a) * d
      const lr = r * (0.42 - layer * 0.05) * (0.85 + rand() * 0.3)
      const g = ctx.createRadialGradient(x - lr * 0.3, y - lr * 0.35, lr * 0.1, x, y, lr)
      const tones = [
        ['#4f7d34', '#2f5320'],
        ['#5d8d3b', '#355d24'],
        ['#6c9c45', '#3e6a2a'],
      ][layer]
      g.addColorStop(0, tones[0])
      g.addColorStop(1, tones[1])
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, lr, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // leaf speckle
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2
    const d = r * 0.85 * Math.sqrt(rand())
    ctx.fillStyle = rand() < 0.5 ? 'rgba(160, 200, 110, 0.45)' : 'rgba(25, 50, 18, 0.35)'
    ctx.beginPath()
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.07, r * 0.035, a, 0, Math.PI * 2)
    ctx.fill()
  }

  const [t, tctx] = canvas(size * dpr)
  tctx.scale(dpr, dpr)
  tctx.translate(size / 2, size / 2)
  tctx.strokeStyle = '#6a4f35'
  tctx.lineCap = 'round'
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.5
    tctx.lineWidth = Math.max(1, r * 0.08)
    tctx.beginPath()
    tctx.moveTo(0, 0)
    const ex = Math.cos(a) * r * 0.7
    const ey = Math.sin(a) * r * 0.7
    tctx.lineTo(ex, ey)
    tctx.lineWidth = Math.max(0.8, r * 0.05)
    tctx.moveTo(ex * 0.6, ey * 0.6)
    tctx.lineTo(ex * 0.6 + Math.cos(a + 0.7) * r * 0.25, ey * 0.6 + Math.sin(a + 0.7) * r * 0.25)
    tctx.stroke()
  }
  tctx.fillStyle = 'rgba(95, 125, 60, 0.8)'
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2
    tctx.beginPath()
    tctx.ellipse(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, r * 0.1, r * 0.05, a, 0, Math.PI * 2)
    tctx.fill()
  }

  const berries: [number, number][] = []
  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2
    const d = 0.75 * Math.sqrt((i + 0.5) / 24)
    berries.push([Math.cos(a) * d, Math.sin(a) * d])
  }
  return { foliage: f, twigs: t, berries, size }
}
