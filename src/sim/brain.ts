import type { Rng } from './rng'

/**
 * Sense layout, by category rather than by species, so any species can be wired to any
 * other: threats are whatever eats you, food is whatever you eat, kin is your own kind.
 */
export const SENSE = {
  threat1: 0,
  threat2: 3,
  threatCount: 6,
  food1: 7,
  food2: 10,
  foodAmount: 13,
  kin: 14,
  hunger: 17,
  inCover: 18,
  wall: 19,
  memory: 20,
  bias: 21,
  cover: 22,
} as const
export const N_IN = 25
export const N_OUT = 3
export const OUT = { turn: 0, pace: 1, memory: 2 } as const

export const INPUT_LABELS = [
  'Threat 1 left',
  'Threat 1 ahead',
  'Threat 1 near',
  'Threat 2 left',
  'Threat 2 ahead',
  'Threat 2 near',
  'Threats in view',
  'Food 1 left',
  'Food 1 ahead',
  'Food 1 near',
  'Food 2 left',
  'Food 2 ahead',
  'Food 2 near',
  'Food amount',
  'Kin left',
  'Kin ahead',
  'Kin nearby',
  'Hunger',
  'In cover',
  'Wall ahead',
  'Memory',
  'Bias',
  'Cover left',
  'Cover ahead',
  'Cover near',
]
export const OUTPUT_LABELS = ['Turn', 'Pace', 'Memory']

/**
 * A brain whose size is part of its genes: inputs -> hidden (tanh) -> outputs, plus direct
 * input -> output weights. Structural mutation can add hidden neurons, so brains can grow.
 * Layout of `w`: [hidden-in (nHid x N_IN)] [hidden-out (N_OUT x nHid)] [skip (N_OUT x N_IN)] [body 2].
 */
export interface Genome {
  nHid: number
  w: Float64Array
}

export function genomeSize(nHid: number): number {
  return nHid * N_IN + N_OUT * nHid + N_OUT * N_IN + 2
}

export function offsets(nHid: number): { hidOut: number; skip: number; body: number } {
  const hidOut = nHid * N_IN
  const skip = hidOut + N_OUT * nHid
  const body = skip + N_OUT * N_IN
  return { hidOut, skip, body }
}

export function randomGenome(rng: Rng, nHid: number, init: number): Genome {
  const w = new Float64Array(genomeSize(nHid))
  for (let i = 0; i < w.length; i++) w[i] = rng.uniform(-init, init)
  return { nHid, w }
}

/** Body genes, in [-1, 1] before mapping: view range and turning. */
export function bodyGene(g: Genome, k: 0 | 1): number {
  return g.w[g.w.length - 2 + k]
}

export function mutateGenome(
  rng: Rng,
  g: Genome,
  rate: number,
  sigma: number,
  growRate: number,
  maxHid: number,
): Genome {
  const w = new Float64Array(g.w.length)
  for (let i = 0; i < w.length; i++) w[i] = rng.random() < rate ? g.w[i] + rng.gauss(0, sigma) : g.w[i]
  const child = { nHid: g.nHid, w }
  if (growRate > 0 && g.nHid < maxHid && rng.random() < growRate) return grow(rng, child, sigma)
  return child
}

/** Add one hidden neuron with random inputs and zero output weights: neutral until it mutates. */
export function grow(rng: Rng, g: Genome, sigma: number): Genome {
  const h = g.nHid
  const src = offsets(h)
  const dst = offsets(h + 1)
  const w = new Float64Array(genomeSize(h + 1))
  w.set(g.w.subarray(0, h * N_IN), 0)
  for (let i = 0; i < N_IN; i++) w[h * N_IN + i] = rng.gauss(0, sigma * 5)
  for (let o = 0; o < N_OUT; o++) {
    for (let j = 0; j < h; j++) w[dst.hidOut + o * (h + 1) + j] = g.w[src.hidOut + o * h + j]
    w[dst.hidOut + o * (h + 1) + h] = 0
  }
  w.set(g.w.subarray(src.skip), dst.skip)
  return { nHid: h + 1, w }
}

/** Uniform crossover over the genes both parents share; structure follows the first parent. */
export function crossover(rng: Rng, a: Genome, b: Genome): Genome {
  if (a.nHid !== b.nHid) return { nHid: a.nHid, w: a.w.slice() }
  const w = new Float64Array(a.w.length)
  for (let i = 0; i < w.length; i++) w[i] = rng.random() < 0.5 ? a.w[i] : b.w[i]
  return { nHid: a.nHid, w }
}

/** Forward pass. `hid` must hold at least nHid values; results land in `out` (raw sums). */
export function think(g: Genome, x: Float64Array, hid: Float64Array, out: Float64Array): void {
  const { nHid, w } = g
  const { hidOut, skip } = offsets(nHid)
  for (let j = 0; j < nHid; j++) {
    let s = 0
    const o = j * N_IN
    for (let i = 0; i < N_IN; i++) s += w[o + i] * x[i]
    hid[j] = Math.tanh(s)
  }
  for (let k = 0; k < N_OUT; k++) {
    let s = 0
    const o = skip + k * N_IN
    for (let i = 0; i < N_IN; i++) s += w[o + i] * x[i]
    const q = hidOut + k * nHid
    for (let j = 0; j < nHid; j++) s += w[q + j] * hid[j]
    out[k] = s
  }
}

/** Behavioural traits measured by probing a brain with standard situations. */
export interface Traits {
  /** Pace when nothing is in sight. */
  cruise: number
  /** Extra pace when a threat is close ahead. */
  sprint: number
  /** Extra pace when food is close ahead. */
  chase: number
  /** Turns away from a close threat (+) or towards it (-). */
  flee: number
  /** Turns towards food when hungry. */
  forage: number
  /** Turns towards kin. */
  herd: number
  /** Turns towards cover while a threat is in view. */
  hide: number
}

const px = new Float64Array(N_IN)
const ph = new Float64Array(64)
const po = new Float64Array(N_OUT)

function probe(g: Genome, set: (x: Float64Array) => void): [number, number] {
  px.fill(0)
  px[SENSE.bias] = 1
  px[SENSE.hunger] = 0.5
  set(px)
  think(g, px, ph, po)
  return [Math.tanh(po[OUT.turn]), 0.5 + 0.5 * Math.tanh(po[OUT.pace])]
}

/** How strongly the brain turns towards a stimulus placed at `base` (left/ahead/near triple). */
function approach(g: Genome, base: number, extra?: (x: Float64Array) => void): number {
  const left = probe(g, (x) => {
    x[base] = 0.7
    x[base + 1] = 0.7
    x[base + 2] = 0.6
    extra?.(x)
  })[0]
  const right = probe(g, (x) => {
    x[base] = -0.7
    x[base + 1] = 0.7
    x[base + 2] = 0.6
    extra?.(x)
  })[0]
  return (left - right) / 2
}

export function traits(g: Genome, eatsPlants: boolean): Traits {
  const idle = probe(g, () => {})[1]
  const scared = probe(g, (x) => {
    x[SENSE.threat1 + 1] = 1
    x[SENSE.threat1 + 2] = 0.7
    x[SENSE.threatCount] = 0.2
  })[1]
  const eager = probe(g, (x) => {
    x[SENSE.food1 + 1] = 1
    x[SENSE.food1 + 2] = 0.7
    x[SENSE.hunger] = 0.8
    x[SENSE.foodAmount] = eatsPlants ? 0.8 : 0.2
  })[1]
  const forage = approach(g, SENSE.food1, (x) => {
    x[SENSE.hunger] = 0.8
    x[SENSE.foodAmount] = eatsPlants ? 0.8 : 0.2
  })
  return {
    cruise: idle,
    sprint: scared - idle,
    chase: eager - probe(g, (x) => (x[SENSE.hunger] = 0.8))[1],
    flee: -approach(g, SENSE.threat1, (x) => (x[SENSE.threatCount] = 0.2)),
    forage,
    herd: approach(g, SENSE.kin),
    hide: approach(g, SENSE.cover, (x) => {
      x[SENSE.threat1 + 1] = 0.5
      x[SENSE.threat1 + 2] = 0.3
      x[SENSE.threatCount] = 0.2
    }),
  }
}
