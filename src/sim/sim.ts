import {
  bodyGene,
  crossover,
  mutateGenome,
  N_IN,
  N_OUT,
  OUT,
  randomGenome,
  SENSE,
  think,
  traits,
  type Genome,
  type Traits,
} from './brain'
import type { SimParams, SpeciesParams } from './params'
import { Rng } from './rng'
import { calendar, type Season } from './time'

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
  kind: 'eaten' | 'born' | 'starved' | 'old' | 'arrived' | 'released' | 'culled' | 'sprouted' | 'withered'
  species: Species
  x: number
  y: number
}

export interface Bush {
  id: number
  x: number
  y: number
  stock: number
  /** Consecutive hours below WITHER_LEVEL of full stock. */
  grazedFor: number
  /** Hours since it sprouted. */
  age: number
}

const WITHER_LEVEL = 0.15
const SPROUT_STOCK = 3
const SPROUT_GAP = 0.05
const SPROUT_SEASON: Record<Season, number> = { autumn: 0.7, winter: 0.45, spring: 1.35, summer: 1 }

export interface World {
  patches: [number, number][]
  prey: [number, number][]
  preds: [number, number][]
}

export function placeWorld(seed: number, p: SimParams): World {
  const rng = new Rng(seed)
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

/** A species as data: what it eats, its body, and its population ceiling. */
export interface SpeciesDef {
  key: Species
  eatsPlants: boolean
  eats: Species[]
  body: SpeciesParams
  ceiling: number
}

export function speciesDefs(p: SimParams): Record<Species, SpeciesDef> {
  return {
    prey: { key: 'prey', eatsPlants: true, eats: [], body: p.prey, ceiling: p.eco.ceilingPrey },
    pred: { key: 'pred', eatsPlants: false, eats: ['prey'], body: p.pred, ceiling: p.eco.ceilingPred },
  }
}

const SPECIES: Species[] = ['prey', 'pred']

export class Creature {
  readonly id: number
  readonly species: Species
  x: number
  y: number
  hx: number
  hy: number
  readonly brain: Genome
  energy: number
  readonly gen: number
  lineage: number
  readonly parent: number
  readonly view: number
  readonly maxTurn: number
  age = 0
  hunger = 0
  meals = 0
  lastBirth = -1
  kits = 0
  pace = 0
  mem = 0
  inCover = false
  /** Tick a predator first came close; -1 when not being chased. */
  threatSince = -1

  constructor(
    id: number,
    species: Species,
    x: number,
    y: number,
    heading: number,
    brain: Genome,
    body: SpeciesParams,
    energy: number,
    gen: number,
    lineage: number,
    parent: number,
  ) {
    this.id = id
    this.species = species
    this.x = x
    this.y = y
    this.hx = Math.cos(heading)
    this.hy = Math.sin(heading)
    this.brain = brain
    this.energy = energy
    this.gen = gen
    this.lineage = lineage
    this.parent = parent
    this.view = trait(bodyGene(brain, 0), body.view)
    this.maxTurn = trait(bodyGene(brain, 1), body.turn)
  }
}

function trait(g: number, span: [number, number]): number {
  const [lo, hi] = span
  return lo + ((hi - lo) * (Math.min(1, Math.max(-1, g)) + 1)) / 2
}

const CELL = 0.1
const CELLS = 10

/** Uniform grid over the unit square for neighbour queries. */
class Grid {
  private cells: Creature[][] = Array.from({ length: CELLS * CELLS }, () => [])

  build(pop: Creature[]): void {
    for (const c of this.cells) c.length = 0
    for (const a of pop) this.cells[cellOf(a.x, a.y)].push(a)
  }

  each(x: number, y: number, r: number, fn: (a: Creature) => void): void {
    const x0 = Math.max(0, Math.floor((x - r) / CELL))
    const x1 = Math.min(CELLS - 1, Math.floor((x + r) / CELL))
    const y0 = Math.max(0, Math.floor((y - r) / CELL))
    const y1 = Math.min(CELLS - 1, Math.floor((y + r) / CELL))
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const a of this.cells[gy * CELLS + gx]) fn(a)
  }
}

function cellOf(x: number, y: number): number {
  const gx = Math.min(CELLS - 1, Math.floor(x / CELL))
  const gy = Math.min(CELLS - 1, Math.floor(y / CELL))
  return gy * CELLS + gx
}

export interface EvoCounters {
  /** Chases: a predator came within CHASE_R of a prey. */
  encounters: number
  escapes: number
  caught: number
  preyHours: number
  preyIntake: number
  predHours: number
  predHungryHours: number
}

const CHASE_R = 0.06
const CHASE_TICKS = 24

export interface EcoOptions {
  record?: boolean
  /** Assays: seed each population with these genomes instead of random founders. */
  genomes?: Partial<Record<Species, Genome[]>>
  counts?: Partial<Record<Species, number>>
  noBirths?: boolean
  noAging?: boolean
}

/** The meadow: species-generic ecology, energy, brains, births and deaths. */
export class Sim {
  readonly p: SimParams
  readonly seed: number
  bushes: Bush[] = []
  readonly cover: [number, number][]
  readonly dist: Disturbance
  readonly defs: Record<Species, SpeciesDef>
  pops: Record<Species, Creature[]>
  tick = 0
  ended = false
  counters: Counters = { preyBorn: 0, predBorn: 0, preyStarved: 0, preyEaten: 0, preyOld: 0, predStarved: 0, predOld: 0 }
  evo: EvoCounters = { encounters: 0, escapes: 0, caught: 0, preyHours: 0, preyIntake: 0, predHours: 0, predHungryHours: 0 }
  lastBirth = { prey: 0, pred: 0 }
  events: TickEvent[] = []
  private rng: Rng
  private evRng: Rng
  private nextId = { prey: 0, pred: 0 }
  private regrowAcc = 0
  private sproutAcc = 0
  private nextBush = 0
  private foodRng: Rng
  private pending: Intervention[] = []
  private grids: Record<Species, Grid> = { prey: new Grid(), pred: new Grid() }
  private opts: EcoOptions
  private x = new Float64Array(N_IN)
  private hid = new Float64Array(64)
  private out = new Float64Array(N_OUT)

  constructor(p: SimParams, seed: number, dist: Disturbance = NO_DISTURBANCE, opts: EcoOptions = {}) {
    this.p = p
    this.seed = seed
    this.dist = dist
    this.opts = opts
    this.defs = speciesDefs(p)
    const world = placeWorld(seed, p)
    this.cover = placeCover(seed, p, world.patches)
    this.foodRng = new Rng(seed + 40000)
    for (const [x, y] of world.patches) this.bushes.push({ id: this.nextBush++, x, y, stock: p.patchStock, grazedFor: 0, age: 9999 })
    this.rng = new Rng(seed + 10000)
    this.evRng = new Rng(seed + 20000)
    const starts: Record<Species, [number, number][]> = { prey: world.prey, pred: world.preds }
    this.pops = { prey: [], pred: [] }
    for (const s of SPECIES) {
      const given = opts.genomes?.[s]
      const n = opts.counts?.[s] ?? starts[s].length
      for (let i = 0; i < n; i++) {
        const [x, y] = starts[s][i] ?? [this.rng.random(), this.rng.random()]
        const brain = given?.length ? given[i % given.length] : randomGenome(this.rng, p.eco.hidden, p.geneInit)
        const a = this.spawn(s, x, y, brain, p.founderEnergy * this.defs[s].body.maxEnergy, 0, -1)
        this.pops[s].push(a)
      }
    }
    for (const s of SPECIES) for (const a of this.pops[s]) a.inCover = this.inCover(a.x, a.y)
  }

  get prey(): Creature[] {
    return this.pops.prey
  }

  get preds(): Creature[] {
    return this.pops.pred
  }

  get survived(): boolean {
    return this.tick >= this.p.horizon && this.prey.length > 0 && this.preds.length > 0
  }

  queue(action: Intervention): void {
    this.pending.push(action)
  }

  /** Performance ceiling. Ecology, not this number, is what limits a normal meadow. */
  cap(s: Species): number {
    return this.defs[s].ceiling
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

  traits(s: Species): Traits | null {
    const pop = this.pops[s]
    if (pop.length === 0) return null
    const sum: Traits = { cruise: 0, sprint: 0, chase: 0, flee: 0, forage: 0, herd: 0, hide: 0 }
    for (const a of pop) {
      const t = traits(a.brain, this.defs[s].eatsPlants)
      for (const k of Object.keys(sum) as (keyof Traits)[]) sum[k] += t[k]
    }
    for (const k of Object.keys(sum) as (keyof Traits)[]) sum[k] /= pop.length
    return sum
  }

  find(s: Species, id: number): Creature | undefined {
    return this.pops[s].find((a) => a.id === id)
  }

  private spawn(s: Species, x: number, y: number, brain: Genome, energy: number, gen: number, parent: number): Creature {
    const id = this.nextId[s]++
    const lineage = parent < 0 ? id : -1
    return new Creature(id, s, x, y, this.rng.uniform(0, 2 * Math.PI), brain, this.defs[s].body, energy, gen, lineage, parent)
  }

  private emit(kind: TickEvent['kind'], species: Species, a: { x: number; y: number }): void {
    if (this.opts.record) this.events.push({ kind, species, x: a.x, y: a.y })
  }

  inCover(x: number, y: number): boolean {
    const r2 = this.p.eco.coverR * this.p.eco.coverR
    for (const [cx, cy] of this.cover) if ((cx - x) ** 2 + (cy - y) ** 2 <= r2) return true
    return false
  }

  step(): boolean {
    if (this.ended) return false
    const p = this.p
    this.events.length = 0
    this.tick += 1
    const tick = this.tick

    for (const arr of this.dist.arrivals) if (arr.tick === tick) this.arrive(arr)
    for (const action of this.pending) this.intervene(action)
    this.pending.length = 0

    for (const s of SPECIES) {
      for (const a of this.pops[s]) {
        if (!this.opts.noAging) a.age += 1
        a.hunger += 1
      }
      this.grids[s].build(this.pops[s])
    }

    const met = this.metabolismFactor(tick)
    for (const s of SPECIES) for (const a of this.pops[s]) this.move(a, met)
    for (const s of SPECIES) this.grids[s].build(this.pops[s])

    this.graze()
    this.hunt(tick)

    for (const s of SPECIES) this.pops[s] = this.cull(s)

    if (!this.opts.noBirths) for (const s of SPECIES) for (const parent of this.pops[s].slice()) this.giveBirth(parent)

    this.growFood(tick)

    this.evo.preyHours += this.prey.length
    this.evo.predHours += this.preds.length
    if (this.prey.length === 0 || this.preds.length === 0 || tick >= p.horizon) {
      this.ended = true
      return false
    }
    return true
  }

/** Regrow, wither and sprout. Bushes are not permanent: overgrazed ones die and new ones appear. */
  private growFood(tick: number): void {
    const p = this.p
    const f = this.regrowFactor(tick)
    this.regrowAcc += f
    const regrow = this.regrowAcc >= p.regrowEvery
    if (regrow) this.regrowAcc -= p.regrowEvery
    const low = WITHER_LEVEL * p.patchStock
    const kept: Bush[] = []
    for (const b of this.bushes) {
      b.age++
      if (regrow && b.stock < p.patchStock) b.stock += 1
      b.grazedFor = b.stock < low ? b.grazedFor + 1 : 0
      if (b.grazedFor >= p.witherHours) {
        this.emit('withered', 'prey', b)
        continue
      }
      kept.push(b)
    }
    this.bushes = kept
    this.sproutAcc += (p.sproutPerDay / 24) * f * SPROUT_SEASON[calendar(tick).season]
    const rng = this.foodRng
    while (this.sproutAcc >= 1) {
      this.sproutAcc -= 1
      if (this.bushes.length >= p.maxBushes) continue
      const near = this.bushes.length > 0 && rng.random() < p.seedSpread
      let x: number
      let y: number
      if (near) {
        const parent = this.bushes[Math.floor(rng.random() * this.bushes.length)]
        x = parent.x + rng.gauss(0, 0.08)
        y = parent.y + rng.gauss(0, 0.08)
      } else {
        x = rng.random()
        y = rng.random()
      }
      x = Math.min(0.97, Math.max(0.03, x))
      y = Math.min(0.97, Math.max(0.03, y))
      if (this.bushes.some((b) => (b.x - x) ** 2 + (b.y - y) ** 2 < SPROUT_GAP * SPROUT_GAP)) continue
      const b: Bush = { id: this.nextBush++, x, y, stock: SPROUT_STOCK, grazedFor: 0, age: 0 }
      this.bushes.push(b)
      this.emit('sprouted', 'prey', b)
    }
  }

  /** Fill `this.x` with the creature's senses, by category: threat, food, kin, self, cover. */
  private sense(a: Creature): void {
    const x = this.x
    const def = this.defs[a.species]
    const p = this.p
    x.fill(0)

    let t1: Creature | null = null
    let t2: Creature | null = null
    let d1 = Infinity
    let d2 = Infinity
    let count = 0
    for (const s of SPECIES) {
      if (!this.defs[s].eats.includes(a.species)) continue
      const r = a.view
      this.grids[s].each(a.x, a.y, r, (o) => {
        const d = (o.x - a.x) ** 2 + (o.y - a.y) ** 2
        if (d >= r * r) return
        count++
        if (d < d1) {
          t2 = t1
          d2 = d1
          t1 = o
          d1 = d
        } else if (d < d2) {
          t2 = o
          d2 = d
        }
      })
    }
    if (t1) relative(a, (t1 as Creature).x, (t1 as Creature).y, a.view, x, SENSE.threat1)
    if (t2) relative(a, (t2 as Creature).x, (t2 as Creature).y, a.view, x, SENSE.threat2)
    x[SENSE.threatCount] = Math.min(1, count / 5)
    if (a.species === 'prey') {
      const near = t1 ? Math.sqrt(d1) : Infinity
      if (near < CHASE_R && a.threatSince < 0) {
        a.threatSince = this.tick
        this.evo.encounters++
      }
    }

    if (def.eatsPlants) {
      let k1 = -1
      let k2 = -1
      let e1 = Infinity
      let e2 = Infinity
      const bushes = this.bushes
      for (let k = 0; k < bushes.length; k++) {
        const b = bushes[k]
        if (b.stock < 1) continue
        const d = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
        if (d < e1) {
          k2 = k1
          e2 = e1
          k1 = k
          e1 = d
        } else if (d < e2) {
          k2 = k
          e2 = d
        }
      }
      if (k1 >= 0) {
        relative(a, bushes[k1].x, bushes[k1].y, p.foodScent, x, SENSE.food1)
        x[SENSE.foodAmount] = bushes[k1].stock / p.patchStock
      }
      if (k2 >= 0) relative(a, bushes[k2].x, bushes[k2].y, p.foodScent, x, SENSE.food2)
    } else {
      let f1: Creature | null = null
      let f2: Creature | null = null
      let e1 = Infinity
      let e2 = Infinity
      let n = 0
      const sight2 = p.eco.coverSight * p.eco.coverSight
      for (const s of def.eats) {
        const r = a.view
        this.grids[s].each(a.x, a.y, r, (o) => {
          const d = (o.x - a.x) ** 2 + (o.y - a.y) ** 2
          if (d >= r * r || (o.inCover && d > sight2)) return
          n++
          if (d < e1) {
            f2 = f1
            e2 = e1
            f1 = o
            e1 = d
          } else if (d < e2) {
            f2 = o
            e2 = d
          }
        })
      }
      if (f1) relative(a, (f1 as Creature).x, (f1 as Creature).y, a.view, x, SENSE.food1)
      if (f2) relative(a, (f2 as Creature).x, (f2 as Creature).y, a.view, x, SENSE.food2)
      x[SENSE.foodAmount] = Math.min(1, n / 10)
    }

    const kr = p.eco.kinR
    let kx = 0
    let ky = 0
    let kn = 0
    this.grids[a.species].each(a.x, a.y, kr, (o) => {
      if (o === a) return
      const d = (o.x - a.x) ** 2 + (o.y - a.y) ** 2
      if (d >= kr * kr) return
      kx += o.x
      ky += o.y
      kn++
    })
    if (kn > 0) {
      relative(a, kx / kn, ky / kn, kr, x, SENSE.kin)
      x[SENSE.kin + 2] = Math.min(1, kn / 8)
    }

    x[SENSE.hunger] = 1 - a.energy / def.body.maxEnergy
    x[SENSE.inCover] = a.inCover ? 1 : 0
    x[SENSE.wall] = wallAhead(a, p.wallView)
    x[SENSE.memory] = a.mem
    x[SENSE.bias] = 1

    if (this.cover.length > 0) {
      let best = Infinity
      let bx = 0
      let by = 0
      for (const [cx, cy] of this.cover) {
        const d = (cx - a.x) ** 2 + (cy - a.y) ** 2
        if (d < best) {
          best = d
          bx = cx
          by = cy
        }
      }
      relative(a, bx, by, 0.3, x, SENSE.cover)
      if (a.inCover) x[SENSE.cover + 2] = 1
    }
  }

  private move(a: Creature, met: number): void {
    const body = this.defs[a.species].body
    const eco = this.p.eco
    this.sense(a)
    think(a.brain, this.x, this.hid, this.out)
    const turn = Math.tanh(this.out[OUT.turn])
    const pace = 0.5 + 0.5 * Math.tanh(this.out[OUT.pace])
    a.mem = eco.memory ? Math.tanh(this.out[OUT.memory]) : 0
    const angle = a.maxTurn * turn
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const hx = a.hx * c - a.hy * s
    const hy = a.hx * s + a.hy * c
    const n = Math.sqrt(hx * hx + hy * hy)
    a.hx = hx / n
    a.hy = hy / n
    const step = body.step * pace * (a.inCover ? eco.coverSlow : 1)
    a.x = Math.min(1, Math.max(0, a.x + a.hx * step))
    a.y = Math.min(1, Math.max(0, a.y + a.hy * step))
    a.pace = step / body.step
    a.inCover = this.cover.length > 0 && this.inCover(a.x, a.y)
    const r = step / body.baseStep
    a.energy -=
      (body.metabolism + body.visionUpkeep * a.view + eco.brainUpkeep * a.brain.nHid) * met + body.speedCost * r * r
  }

  private graze(): void {
    const p = this.p
    const body = p.prey
    const feed2 = p.feedR * p.feedR
    const full = body.maxEnergy - 0.5 * body.mealEnergy
    for (const s of SPECIES) {
      if (!this.defs[s].eatsPlants) continue
      for (const a of this.pops[s]) {
        if (a.energy > full) continue
        let best = feed2
        let bk = -1
        for (let k = 0; k < this.bushes.length; k++) {
          const b = this.bushes[k]
          if (b.stock < 1) continue
          const d2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
          if (d2 <= best) {
            best = d2
            bk = k
          }
        }
        if (bk >= 0) {
          this.bushes[bk].stock -= 1
          a.hunger = 0
          a.meals += 1
          const gain = Math.min(this.defs[s].body.maxEnergy - a.energy, this.defs[s].body.mealEnergy)
          a.energy += gain
          this.evo.preyIntake += gain
        }
      }
    }
  }

  private hunt(tick: number): void {
    const eat2 = this.p.eatR * this.p.eatR
    for (const s of SPECIES) {
      const def = this.defs[s]
      if (def.eats.length === 0) continue
      const full = def.body.maxEnergy - 0.5 * def.body.mealEnergy
      for (const a of this.pops[s]) if (a.energy <= full) this.evo.predHungryHours++
      for (const victim of def.eats) {
        const survivors: Creature[] = []
        for (const a of this.pops[victim]) {
          let best = eat2
          let hunter: Creature | null = null
          this.grids[s].each(a.x, a.y, this.p.eatR, (q) => {
            const d2 = (q.x - a.x) ** 2 + (q.y - a.y) ** 2
            if (d2 <= best) {
              best = d2
              hunter = q
            }
          })
          if (hunter === null) {
            if (a.threatSince >= 0 && tick - a.threatSince >= CHASE_TICKS) {
              a.threatSince = -1
              this.evo.escapes++
            }
            survivors.push(a)
            continue
          }
          const h = hunter as Creature
          h.hunger = 0
          h.meals += 1
          h.energy = Math.min(def.body.maxEnergy, h.energy + def.body.mealEnergy)
          if (a.threatSince >= 0) this.evo.caught++
          this.counters.preyEaten += 1
          this.emit('eaten', victim, a)
        }
        this.pops[victim] = survivors
      }
    }
  }

  private cull(s: Species): Creature[] {
    const body = this.defs[s].body
    const alive: Creature[] = []
    const c = this.counters
    for (const a of this.pops[s]) {
      const starved = a.energy <= 0
      const old = a.age >= body.lifespan
      if (!starved && !old) {
        alive.push(a)
        continue
      }
      if (s === 'prey' && a.threatSince >= 0) a.threatSince = -1
      if (starved) {
        if (s === 'prey') c.preyStarved += 1
        else c.predStarved += 1
        this.emit('starved', s, a)
      } else {
        if (s === 'prey') c.preyOld += 1
        else c.predOld += 1
        this.emit('old', s, a)
      }
    }
    return alive
  }

  private findMate(parent: Creature): Creature | null {
    const r = this.p.eco.mateR
    const adult = this.defs[parent.species].body.adultAge
    let best = r * r
    let mate: Creature | null = null
    this.grids[parent.species].each(parent.x, parent.y, r, (o) => {
      if (o === parent || o.age < adult || o.energy <= 0) return
      const d = (o.x - parent.x) ** 2 + (o.y - parent.y) ** 2
      if (d < best) {
        best = d
        mate = o
      }
    })
    return mate
  }

  private giveBirth(parent: Creature): void {
    const p = this.p
    const s = parent.species
    const body = this.defs[s].body
    const pop = this.pops[s]
    const cap = this.cap(s)
    const since = parent.lastBirth < 0 ? body.birthGap : parent.age - parent.lastBirth
    if (pop.length >= cap || parent.age < body.adultAge || since < body.birthGap) return
    const childCost = body.childEnergy * body.maxEnergy
    if (parent.energy < body.breedEnergy * body.maxEnergy || parent.energy <= childCost) return
    const mate = p.eco.sexual ? this.findMate(parent) : null
    if (p.eco.sexual && !mate) return
    const rng = this.rng
    for (let n = 0; n < body.litter; n++) {
      if (pop.length >= cap || parent.energy <= childCost) break
      const angle = rng.uniform(0, 2 * Math.PI)
      const r = p.birthR * Math.sqrt(rng.random())
      const x = Math.min(1, Math.max(0, parent.x + r * Math.cos(angle)))
      const y = Math.min(1, Math.max(0, parent.y + r * Math.sin(angle)))
      let brain: Genome
      if (!p.eco.heredity) brain = randomGenome(rng, p.eco.hidden, p.geneInit)
      else {
        const base = mate ? crossover(rng, parent.brain, mate.brain) : parent.brain
        brain = mutateGenome(rng, base, p.mutationRate, p.mutationSigma, p.eco.growRate, p.eco.maxHidden)
      }
      const gen = Math.max(parent.gen, mate?.gen ?? 0) + 1
      const child = this.spawn(s, x, y, brain, childCost, gen, parent.id)
      child.lineage = p.eco.heredity ? parent.lineage : child.id
      child.inCover = this.cover.length > 0 && this.inCover(x, y)
      parent.energy -= childCost
      parent.kits += 1
      pop.push(child)
      if (s === 'prey') this.counters.preyBorn += 1
      else this.counters.predBorn += 1
      this.emit('born', s, child)
    }
    parent.meals = 0
    parent.lastBirth = parent.age
    this.lastBirth[s] = this.tick
  }

  private newcomer(s: Species, x: number, y: number): Creature {
    const ev = this.evRng
    const p = this.p
    const pop = this.pops[s]
    const brain =
      pop.length > 0
        ? mutateGenome(ev, pop[Math.floor(ev.random() * pop.length)].brain, p.mutationRate, p.mutationSigma, 0, p.eco.maxHidden)
        : randomGenome(ev, p.eco.hidden, p.geneInit)
    const a = this.spawn(s, x, y, brain, this.defs[s].body.maxEnergy, 0, -1)
    a.inCover = this.cover.length > 0 && this.inCover(x, y)
    return a
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
    const [ex, ey] = this.edgePoint()
    for (let i = 0; i < arr.count; i++) {
      const x = Math.min(1, Math.max(0, ex + this.evRng.uniform(-0.05, 0.05)))
      const y = Math.min(1, Math.max(0, ey + this.evRng.uniform(-0.05, 0.05)))
      const a = this.newcomer(arr.species, x, y)
      this.pops[arr.species].push(a)
      this.emit('arrived', arr.species, a)
    }
  }

  private intervene(action: Intervention): void {
    const ev = this.evRng
    switch (action) {
      case 'rain':
        for (const b of this.bushes) b.stock = this.p.patchStock
        break
      case 'releasePrey': {
        const room = Math.max(0, this.cap('prey') - this.prey.length)
        for (let i = 0; i < Math.min(8, room); i++) {
          const spot = this.bushes.length ? this.bushes[Math.floor(ev.random() * this.bushes.length)] : { x: 0.5, y: 0.5 }
          const [px, py] = [spot.x, spot.y]
          const x = Math.min(1, Math.max(0, px + ev.uniform(-0.04, 0.04)))
          const y = Math.min(1, Math.max(0, py + ev.uniform(-0.04, 0.04)))
          const a = this.newcomer('prey', x, y)
          this.prey.push(a)
          this.emit('released', 'prey', a)
        }
        break
      }
      case 'releasePred': {
        const room = Math.max(0, this.cap('pred') - this.preds.length)
        const [ex, ey] = this.edgePoint()
        for (let i = 0; i < Math.min(3, room); i++) {
          const a = this.newcomer('pred', ex, ey)
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

function relative(a: Creature, tx: number, ty: number, reach: number, x: Float64Array, at: number): void {
  const dx = tx - a.x
  const dy = ty - a.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < 1e-12) {
    x[at + 2] = 1
    return
  }
  const ux = dx / d
  const uy = dy / d
  x[at] = a.hx * uy - a.hy * ux
  x[at + 1] = a.hx * ux + a.hy * uy
  x[at + 2] = Math.max(0, 1 - d / reach)
}

function wallAhead(a: Creature, wallView: number): number {
  const tx = a.hx > 1e-9 ? (1 - a.x) / a.hx : a.hx < -1e-9 ? a.x / -a.hx : 9
  const ty = a.hy > 1e-9 ? (1 - a.y) / a.hy : a.hy < -1e-9 ? a.y / -a.hy : 9
  return Math.max(0, 1 - Math.min(tx, ty) / wallView)
}

/** Tall-grass patches, kept off the bushes so hiding and eating are a trade-off. */
export function placeCover(seed: number, p: SimParams, patches: [number, number][]): [number, number][] {
  const rng = new Rng(seed + 30000)
  const out: [number, number][] = []
  const r = p.eco.coverR
  for (let i = 0; i < p.eco.cover; i++) {
    for (let t = 0; t < 200; t++) {
      const x = r + rng.random() * (1 - 2 * r)
      const y = r + rng.random() * (1 - 2 * r)
      const clearBush = patches.every(([px, py]) => (px - x) ** 2 + (py - y) ** 2 >= (r + 0.04) ** 2)
      const clearCover = out.every(([cx, cy]) => (cx - x) ** 2 + (cy - y) ** 2 >= (2 * r) ** 2)
      if (clearBush && clearCover) {
        out.push([x, y])
        break
      }
    }
  }
  return out
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
