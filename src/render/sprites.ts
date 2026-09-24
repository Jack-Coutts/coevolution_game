/**
 * Procedural top-down animal sprites, drawn once per size into offscreen canvases.
 * Every sprite faces +x; the renderer rotates it to the animal's heading.
 */
export const GAIT_FRAMES = 6

export interface SpriteSheet {
  frames: HTMLCanvasElement[]
  /** Canvas size in CSS pixels (square); the animal is centred. */
  size: number
}

function makeCanvas(px: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = Math.ceil(px)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  return [c, ctx]
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
}

/** Rabbit, body length L (px). Grey-brown agouti coat, long laid-back ears, white scut. */
function drawRabbit(ctx: CanvasRenderingContext2D, L: number, phase: number): void {
  const swing = Math.sin(phase * Math.PI * 2)
  const hop = Math.max(0, Math.sin(phase * Math.PI * 2))

  ctx.fillStyle = 'rgba(20, 30, 10, 0.28)'
  ellipse(ctx, 0.04 * L, 0.07 * L, 0.52 * L, 0.3 * L)
  ctx.fill()

  // hind feet, pushed back during the hop
  ctx.fillStyle = '#6d5a47'
  const hindX = -0.28 * L - 0.06 * L * hop
  for (const s of [-1, 1]) {
    ellipse(ctx, hindX, s * 0.2 * L, 0.17 * L, 0.07 * L)
    ctx.fill()
  }
  // front paws
  ctx.fillStyle = '#7a6651'
  for (const s of [-1, 1]) {
    ellipse(ctx, 0.2 * L + 0.04 * L * swing * s, s * 0.13 * L, 0.07 * L, 0.045 * L)
    ctx.fill()
  }

  // body
  const body = ctx.createRadialGradient(-0.05 * L, -0.06 * L, 0.02 * L, -0.05 * L, 0, 0.42 * L)
  body.addColorStop(0, '#b19a7e')
  body.addColorStop(0.55, '#927a61')
  body.addColorStop(1, '#6f5b47')
  ctx.fillStyle = body
  ellipse(ctx, -0.08 * L, 0, 0.36 * L, 0.25 * L)
  ctx.fill()
  // agouti ticking along the back
  ctx.fillStyle = 'rgba(70, 55, 40, 0.35)'
  ellipse(ctx, -0.12 * L, 0, 0.22 * L, 0.07 * L)
  ctx.fill()

  // scut
  ctx.fillStyle = '#f4efe6'
  ellipse(ctx, -0.45 * L, 0, 0.085 * L, 0.08 * L)
  ctx.fill()

  // head
  const head = ctx.createRadialGradient(0.3 * L, -0.03 * L, 0.01 * L, 0.3 * L, 0, 0.17 * L)
  head.addColorStop(0, '#b8a286')
  head.addColorStop(1, '#836d56')
  ctx.fillStyle = head
  ellipse(ctx, 0.3 * L, 0, 0.16 * L, 0.13 * L)
  ctx.fill()
  // muzzle
  ctx.fillStyle = '#c9b69c'
  ellipse(ctx, 0.43 * L, 0, 0.055 * L, 0.06 * L)
  ctx.fill()

  // ears, laid back along the shoulders
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.translate(0.22 * L, s * 0.07 * L)
    ctx.rotate(s * (0.22 + 0.04 * swing))
    ctx.fillStyle = '#6c5744'
    ellipse(ctx, -0.18 * L, 0, 0.22 * L, 0.06 * L)
    ctx.fill()
    ctx.fillStyle = 'rgba(214, 160, 150, 0.7)'
    ellipse(ctx, -0.15 * L, 0, 0.14 * L, 0.025 * L)
    ctx.fill()
    ctx.fillStyle = '#4a3b2d'
    ellipse(ctx, -0.34 * L, 0, 0.035 * L, 0.035 * L)
    ctx.fill()
    ctx.restore()
  }

  // eyes
  ctx.fillStyle = '#1b130d'
  for (const s of [-1, 1]) {
    ellipse(ctx, 0.34 * L, s * 0.105 * L, 0.025 * L, 0.02 * L)
    ctx.fill()
  }
}

/** Fox, body length L (px). Rust coat, dark legs and ear backs, bushy white-tipped tail. */
function drawFox(ctx: CanvasRenderingContext2D, L: number, phase: number): void {
  const swing = Math.sin(phase * Math.PI * 2)
  const sway = Math.sin(phase * Math.PI * 2 + 0.8)

  ctx.fillStyle = 'rgba(20, 30, 10, 0.28)'
  ellipse(ctx, 0.0, 0.08 * L, 0.62 * L, 0.2 * L)
  ctx.fill()

  // legs, trotting diagonal pairs
  ctx.fillStyle = '#2b1d16'
  const legs: [number, number, number][] = [
    [0.2, -1, swing],
    [0.2, 1, -swing],
    [-0.2, -1, -swing],
    [-0.2, 1, swing],
  ]
  for (const [x, s, w] of legs) {
    ellipse(ctx, x * L + 0.07 * L * w, s * 0.13 * L, 0.075 * L, 0.035 * L)
    ctx.fill()
  }

  // tail
  ctx.save()
  ctx.translate(-0.3 * L, 0)
  ctx.rotate(0.18 * sway)
  const tail = ctx.createLinearGradient(0, 0, -0.62 * L, 0)
  tail.addColorStop(0, '#b95a22')
  tail.addColorStop(0.7, '#c9692c')
  tail.addColorStop(0.78, '#e9e3d6')
  tail.addColorStop(1, '#fbf8f1')
  ctx.fillStyle = tail
  ctx.beginPath()
  ctx.moveTo(0, -0.07 * L)
  ctx.bezierCurveTo(-0.2 * L, -0.15 * L, -0.5 * L, -0.13 * L, -0.64 * L, 0)
  ctx.bezierCurveTo(-0.5 * L, 0.13 * L, -0.2 * L, 0.15 * L, 0, 0.07 * L)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // body
  const body = ctx.createLinearGradient(0, -0.16 * L, 0, 0.16 * L)
  body.addColorStop(0, '#a94b18')
  body.addColorStop(0.5, '#dc7732')
  body.addColorStop(1, '#a94b18')
  ctx.fillStyle = body
  ellipse(ctx, -0.02 * L, 0, 0.35 * L, 0.175 * L)
  ctx.fill()
  ctx.fillStyle = 'rgba(110, 45, 15, 0.35)'
  ellipse(ctx, -0.05 * L, 0, 0.26 * L, 0.045 * L)
  ctx.fill()

  // head: a wedge with a pointed muzzle
  ctx.fillStyle = '#d06a2a'
  ctx.beginPath()
  ctx.moveTo(0.22 * L, -0.12 * L)
  ctx.quadraticCurveTo(0.38 * L, -0.13 * L, 0.56 * L, -0.01 * L)
  ctx.lineTo(0.56 * L, 0.01 * L)
  ctx.quadraticCurveTo(0.38 * L, 0.13 * L, 0.22 * L, 0.12 * L)
  ctx.quadraticCurveTo(0.17 * L, 0, 0.22 * L, -0.12 * L)
  ctx.fill()
  // white cheeks
  ctx.fillStyle = '#f1e9dc'
  for (const s of [-1, 1]) {
    ellipse(ctx, 0.37 * L, s * 0.075 * L, 0.08 * L, 0.03 * L, s * 0.35)
    ctx.fill()
  }
  // nose
  ctx.fillStyle = '#1a120e'
  ellipse(ctx, 0.56 * L, 0, 0.022 * L, 0.02 * L)
  ctx.fill()
  // ears: triangles with black backs
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#2a1a12'
    ctx.beginPath()
    ctx.moveTo(0.3 * L, s * 0.05 * L)
    ctx.lineTo(0.18 * L, s * 0.19 * L)
    ctx.lineTo(0.24 * L, s * 0.03 * L)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#c4622a'
    ctx.beginPath()
    ctx.moveTo(0.285 * L, s * 0.055 * L)
    ctx.lineTo(0.2 * L, s * 0.16 * L)
    ctx.lineTo(0.245 * L, s * 0.045 * L)
    ctx.closePath()
    ctx.fill()
  }
  // eyes
  ctx.fillStyle = '#20150c'
  for (const s of [-1, 1]) {
    ellipse(ctx, 0.37 * L, s * 0.045 * L, 0.018 * L, 0.012 * L, s * 0.4)
    ctx.fill()
  }
}

function sheet(draw: typeof drawRabbit, length: number, dpr: number): SpriteSheet {
  const size = length * 1.8
  const frames: HTMLCanvasElement[] = []
  for (let f = 0; f < GAIT_FRAMES; f++) {
    const [c, ctx] = makeCanvas(size * dpr)
    ctx.scale(dpr, dpr)
    ctx.translate(size / 2, size / 2)
    draw(ctx, length, f / GAIT_FRAMES)
    frames.push(c)
  }
  return { frames, size }
}

export function rabbitSheet(length: number, dpr: number): SpriteSheet {
  return sheet(drawRabbit, length, dpr)
}

export function foxSheet(length: number, dpr: number): SpriteSheet {
  return sheet(drawFox, length, dpr)
}

/** Standalone icons for the UI (HUD, legend). */
export function animalIcon(kind: 'prey' | 'pred', px: number): string {
  const [c, ctx] = makeCanvas(px * 2)
  ctx.scale(2, 2)
  ctx.translate(px / 2, px / 2)
  ctx.rotate(-Math.PI / 4)
  if (kind === 'prey') {
    ctx.translate(px * 0.04, 0)
    drawRabbit(ctx, px * 0.9, 0.1)
  } else {
    ctx.translate(px * 0.14, 0)
    drawFox(ctx, px * 0.78, 0.1)
  }
  return c.toDataURL()
}
