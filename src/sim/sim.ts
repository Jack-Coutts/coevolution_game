import { PRED_SENSES, PREY_SENSES, type SimParams, type SpeciesParams } from './params'
import { PyRandom } from './rng'

export type Species = 'prey' | 'pred'
export type Intervention = 'rain' | 'releasePrey' | 'cullPred' | 'releasePred'

export interface Window {
  from: number
  to: number
  factor: number
}

export interface Arrival {
  tick: number
  species: Species
  count: number
  capBoost: number
}

/** Scenario disturbances. They use their own RNG so the animals' random stream is untouched. */
export interface Disturbance {
  regrow: Window[]
  metabolism: Window[]
  arrivals: Arrival[]
}

export const NO_DISTURBANCE: Disturbance = { regrow: [], metabolism: [], arrivals: [] }

export type DeathCause = 'starved' | 'eaten' | 'old'

export interface TickEvent {
  kind: 'eaten' | 'born' | 'starved' | 'old' | 'arrived' | 'released' | 'culled'
  species: Species
  x: number
  y: number
}

export class Animal {
  id: number
  x: number
  y: number
  hx: number
  hy: number
  age = 0
  hunger = 0
  meals = 0
  /** Age at which it last gave birth; -1 until it first does. */
  lastBirth = -1
  genes: number[]
  view: number
  maxTurn: number
  energy: number
  pace = 0
  gen: number

  constructor(
    id: number,
    x: number,
    y: number,
    heading: number,
    genes: number[],
    viewRange: [number, number],
    turnRange: [number, number],
    energy: number,
    gen: number,
  ) {
    this.id = id
    this.x = x
    this.y = y
    this.hx = Math.cos(heading)
    this.hy = Math.sin(heading)
    this.genes = genes
    this.view = trait(genes[genes.length - 2], viewRange)
    this.maxTurn = trait(genes[genes.length - 1], turnRange)
    this.energy = energy
    this.gen = gen
  }
}

function trait(g: number, span: [number, number]): number {
  const [lo, hi] = span
  return lo + ((hi - lo) * (Math.min(1.0, Math.max(-1.0, g)) + 1.0)) / 2
}

function randomGenes(rng: PyRandom, nSenses: number, geneInit: number): number[] {
  const genes: number[] = []
  for (let i = 0; i < 2 * nSenses + 1; i++) genes.push(rng.uniform(-geneInit, geneInit))
  genes.push(rng.uniform(-1.0, 1.0))
  genes.push(rng.uniform(-1.0, 1.0))
  return genes
}

function mutate(rng: PyRandom, genes: number[], rate: number, sigma: number): number[] {
  const out = new Array<number>(genes.length)
  for (let i = 0; i < genes.length; i++) {
    out[i] = rng.random() < rate ? genes[i] + rng.gauss(0.0, sigma) : genes[i]
  }
  return out
}

const senses = new Float64Array(11)
let outTurn = 0
let outPace = 0

function think(genes: number[], n: number): void {
  let turn = 0.0
  let pace = genes[n]
  for (let i = 0; i < n; i++) {
    const v = senses[i]
    turn += genes[i] * v
    pace += genes[n + 1 + i] * v
  }
  outTurn = Math.tanh(turn)
  outPace = 0.5 + 0.5 * Math.tanh(pace)
}

let relL = 0
let relA = 0
let relC = 0

function relative(a: Animal, tx: number, ty: number, reach: number): void {
  const dx = tx - a.x
  const dy = ty - a.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < 1e-12) {
    relL = 0.0
    relA = 0.0
    relC = 1.0
    return
  }
  const ux = dx / d
  const uy = dy / d
  relL = a.hx * uy - a.hy * ux
  relA = a.hx * ux + a.hy * uy
  relC = Math.max(0.0, 1.0 - d / reach)
}

function wallAhead(a: Animal, wallView: number): number {
  const hx = a.hx
  const hy = a.hy
  const tx = hx > 1e-9 ? (1.0 - a.x) / hx : hx < -1e-9 ? a.x / -hx : 9.0
  const ty = hy > 1e-9 ? (1.0 - a.y) / hy : hy < -1e-9 ? a.y / -hy : 9.0
  return Math.max(0.0, 1.0 - Math.min(tx, ty) / wallView)
}

function nearest(a: Animal, others: Animal[], reach: number): Animal | null {
  let best = reach * reach
  let found: Animal | null = null
  const x = a.x
  const y = a.y
  for (let i = 0; i < others.length; i++) {
    const o = others[i]
    const dx = o.x - x
    const dy = o.y - y
    const d2 = dx * dx + dy * dy
    if (d2 < best) {
      best = d2
      found = o
    }
  }
  return found
}

/** Turn by the controller's output, then take one step along the new heading. Returns the step. */
function steer(a: Animal, turn: number, pace: number, minPace: number, limit: number): number {
  const angle = a.maxTurn * turn
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const hx = a.hx * c - a.hy * s
  const hy = a.hx * s + a.hy * c
  const n = Math.sqrt(hx * hx + hy * hy)
  a.hx = hx / n
  a.hy = hy / n
  const step = limit * (minPace + (1.0 - minPace) * pace)
  a.x = Math.min(1.0, Math.max(0.0, a.x + a.hx * step))
  a.y = Math.min(1.0, Math.max(0.0, a.y + a.hy * step))
  return step
}

export interface World {
  patches: [number, number][]
  prey: [number, number][]
  preds: [number, number][]
}

export function placeWorld(seed: number, p: SimParams): World {
  const rng = new PyRandom(seed)
  const patches: [number, number][] = []
  const sp2 = p.patchSpacing * p.patchSpacing
  for (let k = 0; k < p.patches; k++) {
    let x = 0
    let y = 0
    for (let t = 0; t < 1000; t++) {
      x = rng.random()
      y = rng.random()
      let ok = true
      for (const [px, py] of patches) {
        if ((x - px) ** 2 + (y - py) ** 2 < sp2) {
          ok = false
          break
        }
      }
      if (ok) break
    }
    patches.push([x, y])
  }
  const prey: [number, number][] = []
  for (let i = 0; i < p.prey.initial; i++) prey.push([rng.random(), rng.random()])
  const preds: [number, number][] = []
  for (let i = 0; i < p.pred.initial; i++) preds.push([rng.random(), rng.random()])
  return { patches, prey, preds }
}

export interface Counters {
  preyBorn: number
  predBorn: number
  preyStarved: number
  preyEaten: number
  preyOld: number
  predStarved: number
  predOld: number
}

export class Sim {
  readonly p: SimParams
  readonly seed: number
  readonly patches: [number, number][]
  readonly dist: Disturbance
  stock: number[]
  prey: Animal[]
  preds: Animal[]
  tick = 0
  ended = false
  counters: Counters = {
    preyBorn: 0,
    predBorn: 0,
    preyStarved: 0,
    preyEaten: 0,
    preyOld: 0,
    predStarved: 0,
    predOld: 0,
  }
  lastBirth = { prey: 0, pred: 0 }
  events: TickEvent[] = []
  private rng: PyRandom
  private evRng: PyRandom
  private nextPreyId: number
  private nextPredId: number
  private regrowAcc = 0
  private capBoost = { prey: 0, pred: 0 }
  private pending: Intervention[] = []
  private recordEvents: boolean

  constructor(p: SimParams, seed: number, dist: Disturbance = NO_DISTURBANCE, recordEvents = false) {
    this.p = p
    this.seed = seed
    this.dist = dist
    this.recordEvents = recordEvents
    const world = placeWorld(seed, p)
    this.patches = world.patches
    this.rng = new PyRandom(seed + 10000)
    this.evRng = new PyRandom(seed + 20000)
    const rng = this.rng
    this.prey = world.prey.map(
      ([x, y], i) =>
        new Animal(
          i,
          x,
          y,
          rng.uniform(0, 2 * Math.PI),
          randomGenes(rng, PREY_SENSES, p.geneInit),
          p.prey.view,
          p.prey.turn,
          p.founderEnergy * p.prey.maxEnergy,
          0,
        ),
    )
    this.preds = world.preds.map(
      ([x, y], i) =>
        new Animal(
          i,
          x,
          y,
          rng.uniform(0, 2 * Math.PI),
          randomGenes(rng, PRED_SENSES, p.geneInit),
          p.pred.view,
          p.pred.turn,
          p.founderEnergy * p.pred.maxEnergy,
          0,
        ),
    )
    this.stock = new Array<number>(p.patches).fill(p.patchStock)
    this.nextPreyId = this.prey.length
    this.nextPredId = this.preds.length
  }

  get survived(): boolean {
    return this.tick === this.p.horizon && this.prey.length > 0 && this.preds.length > 0
  }

  queue(action: Intervention): void {
    this.pending.push(action)
  }

  regrowFactor(tick: number): number {
    let f = 1
    for (const w of this.dist.regrow) if (tick >= w.from && tick < w.to) f *= w.factor
    return f
  }

  metabolismFactor(tick: number): number {
    let f = 1
    for (const w of this.dist.metabolism) if (tick >= w.from && tick < w.to) f *= w.factor
    return f
  }

  cap(species: Species): number {
    return (species === 'prey' ? this.p.prey.cap : this.p.pred.cap) + this.capBoost[species]
  }

  private emit(kind: TickEvent['kind'], species: Species, a: Animal): void {
    if (this.recordEvents) this.events.push({ kind, species, x: a.x, y: a.y })
  }

  /** Advance one tick. Returns false once the run has ended. */
  step(): boolean {
    if (this.ended) return false
    const p = this.p
    const energy = p.rules === 'energy'
    this.events.length = 0
    this.tick += 1
    const tick = this.tick

    for (const arr of this.dist.arrivals) if (arr.tick === tick) this.arrive(arr)
    for (const action of this.pending) this.intervene(action)
    this.pending.length = 0

    // 1. age
    for (const a of this.prey) {
      a.age += 1
      a.hunger += 1
    }
    for (const a of this.preds) {
      a.age += 1
      a.hunger += 1
    }

    const met = energy ? this.metabolismFactor(tick) : 1

    // 2. prey move
    const stock = this.stock
    const patches = this.patches
    const stockedIdx: number[] = []
    for (let k = 0; k < patches.length; k++) if (stock[k] >= 1) stockedIdx.push(k)
    const pp = p.prey
    for (const a of this.prey) {
      let fl = 0.0
      let fa = 0.0
      let fc = 0.0
      if (stockedIdx.length > 0) {
        let bestD = Infinity
        let bx = 0
        let by = 0
        for (const k of stockedIdx) {
          const [px, py] = patches[k]
          const d = (px - a.x) ** 2 + (py - a.y) ** 2
          if (d < bestD) {
            bestD = d
            bx = px
            by = py
          }
        }
        relative(a, bx, by, p.foodScent)
        fl = relL
        fa = relA
        fc = relC
      }
      let pl = 0.0
      let pa = 0.0
      let pc = 0.0
      const q = nearest(a, this.preds, a.view)
      if (q !== null) {
        relative(a, q.x, q.y, a.view)
        pl = relL
        pa = relA
        pc = relC
      }
      const h = energy ? 1 - a.energy / pp.maxEnergy : a.hunger / pp.starve
      senses[0] = fl
      senses[1] = fa
      senses[2] = fc
      senses[3] = h * fl
      senses[4] = h * fa
      senses[5] = h * fc
      senses[6] = pl
      senses[7] = pa
      senses[8] = pc
      senses[9] = h
      senses[10] = wallAhead(a, p.wallView)
      think(a.genes, PREY_SENSES)
      const step = steer(a, outTurn, outPace, energy ? 0 : pp.minPace, pp.step)
      a.pace = step / pp.step
      if (energy) this.spend(a, pp, step, met)
    }

    // 3. predators move
    const dp = p.pred
    for (const a of this.preds) {
      let ql = 0.0
      let qa = 0.0
      let qc = 0.0
      const q = nearest(a, this.prey, a.view)
      if (q !== null) {
        relative(a, q.x, q.y, a.view)
        ql = relL
        qa = relA
        qc = relC
      }
      let bestD = Infinity
      let bx = 0
      let by = 0
      for (let k = 0; k < patches.length; k++) {
        const [px, py] = patches[k]
        const d = (px - a.x) ** 2 + (py - a.y) ** 2
        if (d < bestD) {
          bestD = d
          bx = px
          by = py
        }
      }
      relative(a, bx, by, p.foodScent)
      const h = energy ? 1 - a.energy / dp.maxEnergy : a.hunger / dp.starve
      senses[0] = ql
      senses[1] = qa
      senses[2] = qc
      senses[3] = h * ql
      senses[4] = h * qa
      senses[5] = h * qc
      senses[6] = relL
      senses[7] = relA
      senses[8] = relC
      senses[9] = h
      senses[10] = wallAhead(a, p.wallView)
      think(a.genes, PRED_SENSES)
      const step = steer(a, outTurn, outPace, energy ? 0 : dp.minPace, dp.step)
      a.pace = step / dp.step
      if (energy) this.spend(a, dp, step, met)
    }

    // 4. prey feed
    const feed2 = p.feedR * p.feedR
    const preyFull = pp.maxEnergy - 0.5 * pp.mealEnergy
    for (const a of this.prey) {
      if (energy && a.energy > preyFull) continue
      let best = feed2
      let bk = -1
      for (let k = 0; k < patches.length; k++) {
        if (stock[k] >= 1) {
          const [x, y] = patches[k]
          const d2 = (x - a.x) ** 2 + (y - a.y) ** 2
          if (d2 <= best) {
            best = d2
            bk = k
          }
        }
      }
      if (bk >= 0) {
        stock[bk] -= 1
        a.hunger = 0
        a.meals += 1
        if (energy) a.energy = Math.min(pp.maxEnergy, a.energy + pp.mealEnergy)
      }
    }

    // 5. predators hunt
    const eat2 = p.eatR * p.eatR
    const predFull = dp.maxEnergy - 0.5 * dp.mealEnergy
    const survivors: Animal[] = []
    for (const a of this.prey) {
      let best = eat2
      let hunter: Animal | null = null
      for (const q of this.preds) {
        if (energy && q.energy > predFull) continue
        const d2 = (q.x - a.x) ** 2 + (q.y - a.y) ** 2
        if (d2 <= best) {
          best = d2
          hunter = q
        }
      }
      if (hunter === null) {
        survivors.push(a)
      } else {
        hunter.hunger = 0
        hunter.meals += 1
        if (energy) hunter.energy = Math.min(dp.maxEnergy, hunter.energy + dp.mealEnergy)
        this.counters.preyEaten += 1
        this.emit('eaten', 'prey', a)
      }
    }
    this.prey = survivors

    // 6. starvation and old age
    this.prey = this.cull(this.prey, pp, 'prey', energy)
    this.preds = this.cull(this.preds, dp, 'pred', energy)

    // 7. births, prey then predators, lowest parent id first
    const preyParents = this.prey.slice()
    for (const parent of preyParents) this.giveBirth(parent, 'prey', energy)
    const predParents = this.preds.slice()
    for (const parent of predParents) this.giveBirth(parent, 'pred', energy)

    // 8. regrow
    this.regrowAcc += this.regrowFactor(tick)
    if (this.regrowAcc >= p.regrowEvery) {
      this.regrowAcc -= p.regrowEvery
      for (let k = 0; k < stock.length; k++) if (stock[k] < p.patchStock) stock[k] += 1
    }

    // 9. extinction ends the run
    if (this.prey.length === 0 || this.preds.length === 0 || tick >= p.horizon) {
      this.ended = true
      return false
    }
    return true
  }

  private spend(a: Animal, sp: SpeciesParams, step: number, met: number): void {
    const r = step / sp.baseStep
    a.energy -= (sp.metabolism + sp.visionUpkeep * a.view) * met + sp.speedCost * r * r
  }

  private cull(pop: Animal[], sp: SpeciesParams, species: Species, energy: boolean): Animal[] {
    const alive: Animal[] = []
    const c = this.counters
    for (const a of pop) {
      const starved = energy ? a.energy <= 0 : a.hunger >= sp.starve
      const old = a.age >= sp.lifespan
      if (!starved && !old) {
        alive.push(a)
        continue
      }
      if (starved) {
        if (species === 'prey') c.preyStarved += 1
        else c.predStarved += 1
        this.emit('starved', species, a)
      } else {
        if (species === 'prey') c.preyOld += 1
        else c.predOld += 1
        this.emit('old', species, a)
      }
    }
    return alive
  }

  private giveBirth(parent: Animal, species: Species, energy: boolean): void {
    const p = this.p
    const sp = species === 'prey' ? p.prey : p.pred
    const pop = species === 'prey' ? this.prey : this.preds
    const cap = this.cap(species)
    let since: number
    if (parent.lastBirth < 0) since = p.gapFromOwnBirth ? parent.age : sp.birthGap
    else since = parent.age - parent.lastBirth
    if (pop.length >= cap || parent.age < sp.adultAge || since < sp.birthGap) return
    const childCost = sp.childEnergy * sp.maxEnergy
    if (energy) {
      if (parent.energy < sp.breedEnergy * sp.maxEnergy || parent.energy <= childCost) return
    } else if (parent.meals < sp.mealsToBreed) {
      return
    }
    const rng = this.rng
    for (let n = 0; n < sp.litter; n++) {
      if (pop.length >= cap) break
      if (energy && parent.energy <= childCost) break
      const angle = rng.uniform(0, 2 * Math.PI)
      const r = p.birthR * Math.sqrt(rng.random())
      const x = Math.min(1.0, Math.max(0.0, parent.x + r * Math.cos(angle)))
      const y = Math.min(1.0, Math.max(0.0, parent.y + r * Math.sin(angle)))
      const heading = rng.uniform(0, 2 * Math.PI)
      const genes = mutate(rng, parent.genes, p.mutationRate, p.mutationSigma)
      const id = species === 'prey' ? this.nextPreyId++ : this.nextPredId++
      const child = new Animal(id, x, y, heading, genes, sp.view, sp.turn, childCost, parent.gen + 1)
      if (energy) parent.energy -= childCost
      pop.push(child)
      if (species === 'prey') this.counters.preyBorn += 1
      else this.counters.predBorn += 1
      this.emit('born', species, child)
    }
    parent.meals = 0
    parent.lastBirth = parent.age
    this.lastBirth[species] = this.tick
  }

  /** A newcomer cloned (with mutation) from a random living animal, or a random founder. */
  private newcomer(species: Species, x: number, y: number, fullEnergy: boolean): Animal {
    const p = this.p
    const ev = this.evRng
    const sp = species === 'prey' ? p.prey : p.pred
    const pop = species === 'prey' ? this.prey : this.preds
    const genes =
      pop.length > 0
        ? mutate(ev, pop[Math.floor(ev.random() * pop.length)].genes, p.mutationRate, p.mutationSigma)
        : randomGenes(ev, species === 'prey' ? PREY_SENSES : PRED_SENSES, p.geneInit)
    const id = species === 'prey' ? this.nextPreyId++ : this.nextPredId++
    const e = (fullEnergy ? 1 : p.founderEnergy) * sp.maxEnergy
    return new Animal(id, x, y, ev.uniform(0, 2 * Math.PI), genes, sp.view, sp.turn, e, 0)
  }

  private edgePoint(): [number, number] {
    const ev = this.evRng
    const t = ev.random()
    switch (Math.floor(ev.random() * 4)) {
      case 0:
        return [t, 0.02]
      case 1:
        return [t, 0.98]
      case 2:
        return [0.02, t]
      default:
        return [0.98, t]
    }
  }

  private arrive(arr: Arrival): void {
    this.capBoost[arr.species] += arr.capBoost
    const pop = arr.species === 'prey' ? this.prey : this.preds
    const [ex, ey] = this.edgePoint()
    for (let i = 0; i < arr.count; i++) {
      const x = Math.min(1, Math.max(0, ex + this.evRng.uniform(-0.05, 0.05)))
      const y = Math.min(1, Math.max(0, ey + this.evRng.uniform(-0.05, 0.05)))
      const a = this.newcomer(arr.species, x, y, true)
      pop.push(a)
      this.emit('arrived', arr.species, a)
    }
  }

  private intervene(action: Intervention): void {
    const ev = this.evRng
    switch (action) {
      case 'rain':
        this.stock.fill(this.p.patchStock)
        break
      case 'releasePrey': {
        const room = Math.max(0, this.cap('prey') - this.prey.length)
        for (let i = 0; i < Math.min(8, room); i++) {
          const [px, py] = this.patches[Math.floor(ev.random() * this.patches.length)]
          const x = Math.min(1, Math.max(0, px + ev.uniform(-0.04, 0.04)))
          const y = Math.min(1, Math.max(0, py + ev.uniform(-0.04, 0.04)))
          const a = this.newcomer('prey', x, y, true)
          this.prey.push(a)
          this.emit('released', 'prey', a)
        }
        break
      }
      case 'releasePred': {
        const room = Math.max(0, this.cap('pred') - this.preds.length)
        const [ex, ey] = this.edgePoint()
        for (let i = 0; i < Math.min(3, room); i++) {
          const a = this.newcomer('pred', ex, ey, true)
          this.preds.push(a)
          this.emit('released', 'pred', a)
        }
        break
      }
      case 'cullPred': {
        const n = Math.floor(this.preds.length / 3)
        for (let i = 0; i < n && this.preds.length > 1; i++) {
          const k = Math.floor(ev.random() * this.preds.length)
          this.emit('culled', 'pred', this.preds[k])
          this.preds.splice(k, 1)
        }
        break
      }
      default: {
        const never: never = action
        throw new Error(`unknown intervention ${String(never)}`)
      }
    }
  }
}

export interface RunResult {
  seed: number
  survival_ticks: number
  survived: boolean
  prey_end: number
  predator_end: number
}

export function runHeadless(p: SimParams, seed: number, dist: Disturbance = NO_DISTURBANCE): RunResult {
  const sim = new Sim(p, seed, dist)
  while (sim.step()) {
    /* run to the end */
  }
  return {
    seed,
    survival_ticks: sim.tick,
    survived: sim.survived,
    prey_end: sim.prey.length,
    predator_end: sim.preds.length,
  }
}
