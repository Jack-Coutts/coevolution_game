export type SeedChoice = { kind: 'daily' } | { kind: 'custom'; seed: number }

/** The same seed for everyone on a given (local) day. */
export function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function seedOf(c: SeedChoice): number {
  return c.kind === 'daily' ? dailySeed() : c.seed
}
