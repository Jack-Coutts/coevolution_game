import type { BodyEvolution, SpeciesParams } from './params'
import type { Rng } from './rng'

/**
 * Inherited body size (docs/game-design.md, "Inherited body size"). One gene in [-1, 1];
 * the body is `SIZE_BASE ** gene` times its species' base body: ×0.8 to ×1.25.
 */
export const SIZE_BASE = 1.25
export const SIZE_MIN = 1 / SIZE_BASE
export const SIZE_MAX = SIZE_BASE
/** Exponents: basal metabolism grows slower than reserves; top speed falls as size grows. */
export const METABOLISM_EXPONENT = 0.75
export const SPEED_EXPONENT = -0.5

export function defaultBody(): BodyEvolution {
  return { spread: 1, sigma: 0.1 }
}

export function clampGene(g: number): number {
  return Math.min(1, Math.max(-1, g))
}

/** Body size multiplier for a gene. Gene 0 gives exactly 1. */
export function sizeOf(gene: number): number {
  return SIZE_BASE ** clampGene(gene)
}

/** A body's values once its size is known. With size 1 each equals the species value exactly. */
export interface BodyValues {
  size: number
  maxEnergy: number
  metabolism: number
  topStep: number
}

export function bodyValues(body: SpeciesParams, size: number): BodyValues {
  return {
    size,
    maxEnergy: body.maxEnergy * size,
    metabolism: body.metabolism * size ** METABOLISM_EXPONENT,
    topStep: body.step * size ** SPEED_EXPONENT,
  }
}

/** A founder's gene: uniform in [-spread, spread]. */
export function founderGene(rng: Rng, cfg: BodyEvolution): number {
  return clampGene(rng.uniform(-cfg.spread, cfg.spread))
}

/**
 * A child's gene: the parent's, or either parent's with equal chance when there is a mate;
 * then with probability `rate` a normal step of `cfg.sigma`, clamped to the bounds.
 * Draws one value for the mate choice (with a mate), one for the mutation check, and a normal on mutation.
 */
export function childGene(rng: Rng, parent: number, mate: number | null, rate: number, cfg: BodyEvolution): number {
  let g = mate === null ? parent : rng.random() < 0.5 ? parent : mate
  if (rng.random() < rate) g += rng.gauss(0, cfg.sigma)
  return clampGene(g)
}
