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
import {
  emptyTally,
  perSpecies,
  speciesDefs,
  speciesList,
  type Diet,
  type Species,
  type SpeciesDef,
  type Tally,
} from './species'

export { speciesDefs, type Species, type SpeciesDef }
/** The eight Open meadow actions, plus two vole actions for the Vole meadow (docs/third-species.md section 9). */
export type Intervention = 'rain' | 'releasePrey' | 'cullPred' | 'releasePred' | 'plantBushes' | 'feedFoxes' | 'illnessPrey' | 'illnessPred'
  | 'releaseVole' | 'illnessVole'

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

export type DeathCause = 'starved' | 'eaten' | 'old' | 'illness'

export interface TickEvent {
  kind: 'eaten' | 'born' | 'starved' | 'old' | 'arrived' | 'released' | 'culled' | 'sprouted' | 'withered' | 'illness'
  /** null for plant events (bushes sprouting or withering). */
  species: Species | null
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

/**
 * Intervention and illness constants, exported so experiments can record them.
 * Illness is an abstract game mechanic, not a model of any real disease.
 */
export const EFFECTS = {
  illness: {
    /** Cases seeded by the action: a share of susceptible animals, at least one, at most `seedMax`. */
    seedMax: 6,
    seedShare: 0.2,
    /** Every `every` hours each case can infect each susceptible same-species animal within `radius`. */
    every: 6,
    radius: 0.045,
    chance: 0.15,
    /** Extra energy per hour while ill. */
    drain: 0.65,
    /** Step multiplier while ill. 1 = no slowdown (the game); 0.6 was explored for tuning and not adopted. */
    slow: 1,
    hours: 240,
    /** Immunity lasts this long from infection, so it outlasts the illness itself. */
    immunity: 720,
  },
  plant: { count: 4, stockShare: 0.5 },
  releasePrey: 8,
  releasePred: 3,
  /** Voles released into tall grass, descended from living voles. */
  releaseVole: 12,
  /** A cull removes floor(foxes / cullDivisor), always leaving one. */
  cullDivisor: 3,
}

const WITHER_LEVEL = 0.15
const SPROUT_STOCK = 3
const SPROUT_GAP = 0.05
const SPROUT_SEASON: Record<Season, number> = { autumn: 0.7, winter: 0.45, spring: 1.35, summer: 1 }

export interface World {
  patches: [number, number][]
  prey: [number, number][]
  preds: [number, number][]
  /** Empty without voles. Placed after foxes so two-species worlds draw the same numbers. */
  voles: [number, number][]
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
  const voles: [number, number][] = []
  if (p.vole) for (let i = 0; i < p.vole.body.initial; i++) voles.push([rng.random(), rng.random()])
  return { patches, prey, preds, voles }
}

/** Rabbit and fox counts under their original names, as scripts, statistics and old saves read them. */
export interface Counters {
  preyBorn: number
  predBorn: number
  preyStarved: number
  preyEaten: number
  preyOld: number
  predCulled: number
  preyIllness: number
  predIllness: number
  predStarved: number
  predOld: number
}

export function legacyCounters(t: Record<Species, Tally>): Counters {
  return {
    preyBorn: t.prey.born, predBorn: t.pred.born, preyStarved: t.prey.starved, preyEaten: t.prey.eaten,
    preyOld: t.prey.old, predStarved: t.pred.starved, predOld: t.pred.old, predCulled: t.pred.culled,
    preyIllness: t.prey.illness, predIllness: t.pred.illness,
  }
}

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
  illUntil = 0
  immuneUntil = 0
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
  /** Seed heads left in each tall-grass patch (same order as `cover`). Empty without voles. */
  grassSeed: number[] = []
  readonly dist: Disturbance
  /** The species living here, in simulation order. */
  readonly species: Species[]
  readonly defs: Record<Species, SpeciesDef>
  pops: Record<Species, Creature[]>
  tick = 0
  ended = false
  /** Births and deaths by species and cause. */
  tally: Record<Species, Tally> = perSpecies(emptyTally)
  evo: EvoCounters = { encounters: 0, escapes: 0, caught: 0, preyHours: 0, preyIntake: 0, predHours: 0, predHungryHours: 0 }
  lastBirth: Record<Species, number> = perSpecies(() => 0)
  events: TickEvent[] = []
  private founders: Record<Species, Genome[]> = perSpecies(() => [])
  ceilingHits = 0
  private rng: Rng
  private evRng: Rng
  private nextId: Record<Species, number> = perSpecies(() => 0)
  private regrowAcc = 0
  private sproutAcc = 0
  private seedAcc = 0
  private nextBush = 0
  private foodRng: Rng
  private pending: Intervention[] = []
  private grids: Record<Species, Grid> = perSpecies(() => new Grid())
  private opts: EcoOptions
  private x = new Float64Array(N_IN)
  private hid = new Float64Array(64)
  private out = new Float64Array(N_OUT)

  constructor(p: SimParams, seed: number, dist: Disturbance = NO_DISTURBANCE, opts: EcoOptions = {}) {
    this.p = p
    this.seed = seed
    this.dist = dist
    this.opts = opts
    this.species = speciesList(p)
    this.defs = speciesDefs(p)
    const world = placeWorld(seed, p)
    this.cover = placeCover(seed, p, world.patches)
    if (p.vole) this.grassSeed = this.cover.map(() => p.vole!.seedStock)
    this.foodRng = new Rng(seed + 40000)
    for (const [x, y] of world.patches) this.bushes.push({ id: this.nextBush++, x, y, stock: p.patchStock, grazedFor: 0, age: 9999 })
    this.rng = new Rng(seed + 10000)
    this.evRng = new Rng(seed + 20000)
    const starts: Record<Species, [number, number][]> = { prey: world.prey, pred: world.preds, vole: world.voles }
    this.pops = perSpecies(() => [])
    for (const s of this.species) {
      const given = opts.genomes?.[s]
      const n = opts.counts?.[s] ?? starts[s].length
      for (let i = 0; i < n; i++) {
        const [x, y] = starts[s][i] ?? [this.rng.random(), this.rng.random()]
        const brain = given?.length ? given[i % given.length] : randomGenome(this.rng, p.eco.hidden, p.geneInit)
        const a = this.spawn(s, x, y, brain, p.founderEnergy * this.defs[s].body.maxEnergy, 0, -1)
        this.pops[s].push(a)
      }
    }
    for (const s of this.species) this.founders[s] = this.pops[s].map(a => a.brain)
    for (const s of this.species) for (const a of this.pops[s]) a.inCover = this.inCover(a.x, a.y)
  }

  /** Structured-cloneable checkpoint, including every random stream and pending action. */
  save(): MeadowState {
    return {
      version: 3, species: this.species, p: this.p, seed: this.seed, dist: this.dist, opts: this.opts,
      pops: this.pops, founders: this.founders, bushes: this.bushes, grassSeed: this.grassSeed,
      tick: this.tick, ended: this.ended, tally: this.tally, evo: this.evo,
      lastBirth: this.lastBirth, nextId: this.nextId, nextBush: this.nextBush,
      regrowAcc: this.regrowAcc, sproutAcc: this.sproutAcc, seedAcc: this.seedAcc, pending: this.pending,
      ceilingHits: this.ceilingHits,
      rng: this.rng.save(), evRng: this.evRng.save(), foodRng: this.foodRng.save(),
    }
  }

  /** Resume a checkpoint. Version-2 states (two-species saves) are migrated first. */
  static restore(data: MeadowState | MeadowStateV2): Sim {
    const state = migrateState(data)
    const s = new Sim(state.p, state.seed, state.dist, state.opts)
    if (state.species.join() !== s.species.join()) throw new Error('Meadow save species do not match its parameters')
    for (const key of ['pops', 'founders', 'bushes', 'grassSeed', 'tick', 'ended', 'tally', 'evo', 'lastBirth',
      'nextId', 'nextBush', 'regrowAcc', 'sproutAcc', 'seedAcc', 'pending', 'ceilingHits'] as const) {
      Object.assign(s, { [key]: structuredClone(state[key]) })
    }
    s.rng.restore(state.rng)
    s.evRng.restore(state.evRng)
    s.foodRng.restore(state.foodRng)
    return s
  }

  /** Rabbit and fox counts under their original flat names (a read-only view of `tally`). */
  get counters(): Counters {
    return legacyCounters(this.tally)
  }

  get voles(): Creature[] {
    return this.pops.vole
  }

  get prey(): Creature[] {
    return this.pops.prey
  }

  get preds(): Creature[] {
    return this.pops.pred
  }

  /** A year survived with every species still alive. */
  get survived(): boolean {
    return !this.p.endless && this.tick >= this.p.horizon && this.species.every((s) => this.pops[s].length > 0)
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
    if (this.p.endless) tick %= 8760
    for (const w of this.dist.regrow) if (tick >= w.from && tick < w.to) f *= w.factor
    return f
  }

  metabolismFactor(tick: number): number {
    let f = 1
    if (this.p.endless) tick %= 8760
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

  private emit(kind: TickEvent['kind'], species: Species | null, a: { x: number; y: number }): void {
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

    const species = this.species
    for (const s of species) {
      for (const a of this.pops[s]) {
        if (!this.opts.noAging) a.age += 1
        a.hunger += 1
      }
      this.grids[s].build(this.pops[s])
    }

    this.spreadIllness()
    const met = this.metabolismFactor(tick)
    for (const s of species) for (const a of this.pops[s]) this.move(a, met)
    for (const s of species) this.grids[s].build(this.pops[s])

    this.graze()
    this.hunt(tick)

    for (const s of species) this.pops[s] = this.cull(s)

    if (!this.opts.noBirths) for (const s of species) for (const parent of this.pops[s].slice()) this.giveBirth(parent)

    this.growFood(tick)

    this.evo.preyHours += this.prey.length
    this.evo.predHours += this.preds.length
    // The run ends at the first extinction of any species.
    if (species.some((s) => this.pops[s].length === 0) || (!p.endless && tick >= p.horizon)) {
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
        this.emit('withered', null, b)
        continue
      }
      kept.push(b)
    }
    this.bushes = kept
    if (p.vole) {
      // Grass seed regrows on the same weather as berries; rain does not refill it.
      this.seedAcc += f
      if (this.seedAcc >= p.vole.seedEvery) {
        this.seedAcc -= p.vole.seedEvery
        const max = p.vole.seedStock
        for (let k = 0; k < this.grassSeed.length; k++) this.grassSeed[k] = Math.min(max, this.grassSeed[k] + 1)
      }
    }
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
      this.emit('sprouted', null, b)
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
    for (const s of this.species) {
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
      // The two nearest food items over every plant food this species eats. Items are
      // numbered bushes first, then grass patches, so a berry-only diet sees exactly the bushes.
      let k1 = -1
      let k2 = -1
      let e1 = Infinity
      let e2 = Infinity
      const bushes = this.bushes
      const nb = bushes.length
      for (let i = 0; i < def.diet.length; i++) {
        const bite = def.diet[i].bite
        if (def.diet[i].food === 'berries') {
          for (let k = 0; k < nb; k++) {
            const b = bushes[k]
            if (b.stock < bite) continue
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
        } else {
          const seed = this.grassSeed
          const cover = this.cover
          for (let g = 0; g < seed.length; g++) {
            if (seed[g] < bite) continue
            const d = (cover[g][0] - a.x) ** 2 + (cover[g][1] - a.y) ** 2
            if (d < e1) {
              k2 = k1
              e2 = e1
              k1 = nb + g
              e1 = d
            } else if (d < e2) {
              k2 = nb + g
              e2 = d
            }
          }
        }
      }
      if (k1 >= 0) {
        if (k1 < nb) {
          relative(a, bushes[k1].x, bushes[k1].y, p.foodScent, x, SENSE.food1)
          x[SENSE.foodAmount] = bushes[k1].stock / p.patchStock
        } else {
          const g = k1 - nb
          relative(a, this.cover[g][0], this.cover[g][1], p.foodScent, x, SENSE.food1)
          x[SENSE.foodAmount] = this.grassSeed[g] / p.vole!.seedStock
        }
      }
      if (k2 >= 0) {
        if (k2 < nb) relative(a, bushes[k2].x, bushes[k2].y, p.foodScent, x, SENSE.food2)
        else relative(a, this.cover[k2 - nb][0], this.cover[k2 - nb][1], p.foodScent, x, SENSE.food2)
      }
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
    const def = this.defs[a.species]
    const body = def.body
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
    const step = body.step * pace * (a.inCover && def.coverSlows ? eco.coverSlow : 1) * (a.illUntil > this.tick ? EFFECTS.illness.slow : 1)
    a.x = Math.min(1, Math.max(0, a.x + a.hx * step))
    a.y = Math.min(1, Math.max(0, a.y + a.hy * step))
    a.pace = step / body.step
    a.inCover = this.cover.length > 0 && this.inCover(a.x, a.y)
    const r = step / body.baseStep
    a.energy -=
      (body.metabolism + body.visionUpkeep * a.view + eco.brainUpkeep * a.brain.nHid) * met + body.speedCost * r * r + (a.illUntil > this.tick ? EFFECTS.illness.drain : 0)
  }

  /** Hungry plant eaters take one bite of the first food in their diet that is within reach. */
  private graze(): void {
    const feed2 = this.p.feedR * this.p.feedR
    for (const s of this.species) {
      const def = this.defs[s]
      if (!def.eatsPlants) continue
      // Each species' own body sets when it is full (the census bug: this used the rabbit's).
      const full = def.body.maxEnergy - 0.5 * def.body.mealEnergy
      for (const a of this.pops[s]) {
        if (a.energy > full) continue
        for (let i = 0; i < def.diet.length; i++) if (this.bite(a, def, def.diet[i], feed2)) break
      }
    }
  }

  /** One bite of one plant food: seed in the tall-grass patch the animal stands in, or the nearest bush in reach. */
  private bite(a: Creature, def: SpeciesDef, diet: Diet, feed2: number): boolean {
    if (diet.food === 'seed') {
      if (!a.inCover) return false
      const r2 = this.p.eco.coverR * this.p.eco.coverR
      let g = -1
      for (let k = 0; k < this.cover.length; k++) {
        const [cx, cy] = this.cover[k]
        if (this.grassSeed[k] >= diet.bite && (cx - a.x) ** 2 + (cy - a.y) ** 2 <= r2) {
          g = k
          break
        }
      }
      if (g < 0) return false
      this.grassSeed[g] = trimStock(this.grassSeed[g] - diet.bite)
    } else {
      let best = feed2
      let bk = -1
      for (let k = 0; k < this.bushes.length; k++) {
        const b = this.bushes[k]
        if (b.stock < diet.bite) continue
        const d2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
        if (d2 <= best) {
          best = d2
          bk = k
        }
      }
      if (bk < 0) return false
      this.bushes[bk].stock = trimStock(this.bushes[bk].stock - diet.bite)
    }
    a.hunger = 0
    a.meals += 1
    const gain = Math.min(def.body.maxEnergy - a.energy, def.body.mealEnergy * diet.value)
    a.energy += gain
    if (def.key === 'prey') this.evo.preyIntake += gain
    return true
  }

  private hunt(tick: number): void {
    const eat2 = this.p.eatR * this.p.eatR
    for (const s of this.species) {
      const def = this.defs[s]
      if (def.eats.length === 0) continue
      const full = def.body.maxEnergy - 0.5 * def.body.mealEnergy
      if (s === 'pred') for (const a of this.pops[s]) if (a.energy <= full) this.evo.predHungryHours++
      for (const victim of def.eats) {
        // A small victim is a small meal: its worth is a share of the hunter's meal energy.
        const worth = def.body.mealEnergy * this.defs[victim].mealValue
        const survivors: Creature[] = []
        for (const a of this.pops[victim]) {
          let best = eat2
          let hunter: Creature | null = null
          this.grids[s].each(a.x, a.y, this.p.eatR, (q) => {
            if (q.energy > full) return
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
          h.energy = Math.min(def.body.maxEnergy, h.energy + worth)
          if (a.threatSince >= 0) this.evo.caught++
          this.tally[victim].eaten += 1
          this.emit('eaten', victim, a)
        }
        this.pops[victim] = survivors
      }
    }
  }

  private cull(s: Species): Creature[] {
    const body = this.defs[s].body
    const alive: Creature[] = []
    const t = this.tally[s]
    for (const a of this.pops[s]) {
      const starved = a.energy <= 0
      const old = a.age >= body.lifespan
      if (!starved && !old) {
        alive.push(a)
        continue
      }
      if (s === 'prey' && a.threatSince >= 0) a.threatSince = -1
      if (starved && a.illUntil > this.tick) {
        t.illness += 1
        this.emit('illness', s, a)
      } else if (starved) {
        t.starved += 1
        this.emit('starved', s, a)
      } else {
        t.old += 1
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
    if (pop.length >= cap) { this.ceilingHits++; return }
    if (parent.age < body.adultAge || since < body.birthGap) return
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
      if (!p.eco.heredity) brain = this.founders[s][Math.floor(rng.random() * this.founders[s].length)]
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
      this.tally[s].born += 1
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
    const ancestor = pop.length ? pop[Math.floor(ev.random() * pop.length)] : null
    const brain = !p.eco.heredity && this.founders[s].length
      ? this.founders[s][Math.floor(ev.random() * this.founders[s].length)]
      : ancestor
        ? mutateGenome(ev, ancestor.brain, p.mutationRate, p.mutationSigma, 0, p.eco.maxHidden)
        : randomGenome(ev, p.eco.hidden, p.geneInit)
    const inherited = p.eco.heredity && ancestor
    const a = this.spawn(s, x, y, brain, this.defs[s].body.maxEnergy, inherited ? ancestor.gen + 1 : 0, inherited ? ancestor.id : -1)
    if (inherited) a.lineage = ancestor.lineage
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
    const room = Math.max(0, this.cap(arr.species) - this.pops[arr.species].length)
    if (arr.count > room) this.ceilingHits += arr.count - room
    for (let i = 0; i < Math.min(arr.count, room); i++) {
      const x = Math.min(1, Math.max(0, ex + this.evRng.uniform(-0.05, 0.05)))
      const y = Math.min(1, Math.max(0, ey + this.evRng.uniform(-0.05, 0.05)))
      const a = this.newcomer(arr.species, x, y)
      this.pops[arr.species].push(a)
      this.emit('arrived', arr.species, a)
    }
  }

  private infect(a: Creature): void {
    a.illUntil = this.tick + EFFECTS.illness.hours
    a.immuneUntil = this.tick + EFFECTS.illness.immunity
  }

  /** Abstract game illness: local spread, extra energy costs, then recovery and temporary immunity. */
  private spreadIllness(): void {
    const { every, radius, chance } = EFFECTS.illness
    if (this.tick % every !== 0) return
    for (const s of this.species) {
      const sick = this.pops[s].filter(a => a.illUntil > this.tick)
      const exposed = new Set<Creature>()
      for (const a of sick) this.grids[s].each(a.x, a.y, radius, b => {
        if (b.immuneUntil > this.tick || (a.x - b.x) ** 2 + (a.y - b.y) ** 2 > radius ** 2) return
        if (this.evRng.random() < chance) exposed.add(b)
      })
      for (const a of exposed) this.infect(a)
    }
  }

  private intervene(action: Intervention): void {
    const ev = this.evRng
    switch (action) {
      case 'illnessPrey':
      case 'illnessPred':
      case 'illnessVole': {
        const species = ILLNESS_TARGET[action]
        const available = this.pops[species].filter(a => a.immuneUntil <= this.tick)
        const n = Math.min(EFFECTS.illness.seedMax, Math.max(1, Math.ceil(available.length * EFFECTS.illness.seedShare)))
        for (let i = 0; i < n && available.length; i++) {
          const at = Math.floor(ev.random() * available.length)
          this.infect(available.splice(at, 1)[0])
        }
        break
      }
      case 'plantBushes':
        for (let i = 0; i < EFFECTS.plant.count && this.bushes.length < this.p.maxBushes; i++) {
          const bush = { id: this.nextBush++, x: ev.uniform(0.05, 0.95), y: ev.uniform(0.05, 0.95),
            stock: this.p.patchStock * EFFECTS.plant.stockShare, grazedFor: 0, age: 0 }
          this.bushes.push(bush)
          this.emit('sprouted', null, bush)
        }
        break
      case 'feedFoxes':
        for (const a of this.preds) a.energy = this.p.pred.maxEnergy
        break
      case 'rain':
        for (const b of this.bushes) b.stock = this.p.patchStock
        break
      case 'releasePrey': {
        const want = EFFECTS.releasePrey
        const room = Math.max(0, this.cap('prey') - this.prey.length)
        if (room < want) this.ceilingHits += want - room
        for (let i = 0; i < Math.min(want, room); i++) {
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
        const want = EFFECTS.releasePred
        const room = Math.max(0, this.cap('pred') - this.preds.length)
        if (room < want) this.ceilingHits += want - room
        const [ex, ey] = this.edgePoint()
        for (let i = 0; i < Math.min(want, room); i++) {
          const a = this.newcomer('pred', ex, ey)
          this.preds.push(a)
          this.emit('released', 'pred', a)
        }
        break
      }
      case 'releaseVole': {
        // Only where voles live; into tall grass, where their seed is.
        if (!this.species.includes('vole')) break
        const want = EFFECTS.releaseVole
        const room = Math.max(0, this.cap('vole') - this.voles.length)
        if (room < want) this.ceilingHits += want - room
        const r = this.p.eco.coverR
        for (let i = 0; i < Math.min(want, room); i++) {
          const [cx, cy] = this.cover.length ? this.cover[Math.floor(ev.random() * this.cover.length)] : [0.5, 0.5]
          const d = r * Math.sqrt(ev.random())
          const angle = ev.uniform(0, 2 * Math.PI)
          const x = Math.min(1, Math.max(0, cx + d * Math.cos(angle)))
          const y = Math.min(1, Math.max(0, cy + d * Math.sin(angle)))
          const a = this.newcomer('vole', x, y)
          this.voles.push(a)
          this.emit('released', 'vole', a)
        }
        break
      }
      case 'cullPred': {
        const n = Math.floor(this.preds.length / EFFECTS.cullDivisor)
        for (let i = 0; i < n && this.preds.length > 1; i++) {
          const k = Math.floor(ev.random() * this.preds.length)
          this.tally.pred.culled++
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

type RngState = ReturnType<Rng['save']>

/** A meadow checkpoint, save version 3. It records its species list. */
export interface MeadowState {
  version: 3
  species: Species[]
  p: SimParams
  seed: number
  dist: Disturbance
  opts: EcoOptions
  pops: Record<Species, Creature[]>
  founders: Record<Species, Genome[]>
  bushes: Bush[]
  grassSeed: number[]
  tick: number
  ended: boolean
  tally: Record<Species, Tally>
  evo: EvoCounters
  lastBirth: Record<Species, number>
  nextId: Record<Species, number>
  nextBush: number
  regrowAcc: number
  sproutAcc: number
  seedAcc: number
  pending: Intervention[]
  ceilingHits: number
  rng: RngState
  evRng: RngState
  foodRng: RngState
}

type TwoSpecies<T> = { prey: T; pred: T }

/** A checkpoint from save version 2: always a two-species meadow, with flat rabbit and fox counters. */
export interface MeadowStateV2 {
  version: 2
  p: SimParams
  seed: number
  dist: Disturbance
  opts: EcoOptions
  pops: TwoSpecies<Creature[]>
  founders: TwoSpecies<Genome[]>
  bushes: Bush[]
  tick: number
  ended: boolean
  counters: Counters
  evo: EvoCounters
  lastBirth: TwoSpecies<number>
  nextId: TwoSpecies<number>
  nextBush: number
  regrowAcc: number
  sproutAcc: number
  pending: Intervention[]
  ceilingHits: number
  rng: RngState
  evRng: RngState
  foodRng: RngState
}

/**
 * Bring a checkpoint to version 3. A version-2 state becomes a two-species meadow with no
 * voles, no grass seed and zeroed vole counts, and then continues exactly as it would have
 * in the version-2 engine. Anything else is refused, never partly loaded.
 */
export function migrateState(data: MeadowState | MeadowStateV2): MeadowState {
  if (data?.version === 3) return data
  if (data?.version !== 2 || !data.counters || !data.pops?.prey || !data.pops?.pred || data.p?.vole)
    throw new Error('Unsupported meadow save version')
  const c = data.counters
  return {
    version: 3, species: ['prey', 'pred'], p: data.p, seed: data.seed, dist: data.dist, opts: data.opts,
    pops: { prey: data.pops.prey, pred: data.pops.pred, vole: [] },
    founders: { prey: data.founders.prey, pred: data.founders.pred, vole: [] },
    bushes: data.bushes, grassSeed: [], tick: data.tick, ended: data.ended,
    tally: {
      prey: { born: c.preyBorn, starved: c.preyStarved, eaten: c.preyEaten, old: c.preyOld, illness: c.preyIllness, culled: 0 },
      pred: { born: c.predBorn, starved: c.predStarved, eaten: 0, old: c.predOld, illness: c.predIllness, culled: c.predCulled },
      vole: emptyTally(),
    },
    evo: data.evo,
    lastBirth: { prey: data.lastBirth.prey, pred: data.lastBirth.pred, vole: 0 },
    nextId: { prey: data.nextId.prey, pred: data.nextId.pred, vole: 0 },
    nextBush: data.nextBush, regrowAcc: data.regrowAcc, sproutAcc: data.sproutAcc, seedAcc: 0,
    pending: data.pending, ceilingHits: data.ceilingHits, rng: data.rng, evRng: data.evRng, foodRng: data.foodRng,
  }
}

const ILLNESS_TARGET = { illnessPrey: 'prey', illnessPred: 'pred', illnessVole: 'vole' } as const satisfies Record<string, Species>

/** Round away float dust from fractional bites, so repeated 0.4 bites leave whole numbers whole. Integers are unchanged. */
function trimStock(x: number): number {
  return Math.round(x * 1e6) / 1e6
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
