"""Coevolution benchmark: a self-sustaining predator-prey ecology.

There are no generations. Animals live, eat, give birth and die tick by tick. Each animal
steers with a small evolved controller (a one-layer network) whose weights are its genes;
children inherit the parent's genes with mutation. Selection is purely ecological.

Standard library only. Run with:  python3 coevo.py
"""

import json
import math
import os
import random
import time
from multiprocessing import Pool

import viz

# ---------------------------------------------------------------- the world (fixed)
INITIAL_PREY = 30
INITIAL_PREDATORS = 6
PREY_STEP = 0.010
PRED_STEP = 0.014
EAT_R = 0.025
N_PATCHES = 10
PATCH_STOCK = 30
FEED_R = 0.020
REGROW_EVERY = 15
HORIZON = 8000
PATCH_SPACING = 0.15
SEEDS = list(range(10))
LABEL = "claude-opus-5.5"

PREY_ADULT, PREY_MEALS, PREY_GAP, PREY_CAP = 80, 2, 150, 150
PRED_ADULT, PRED_MEALS, PRED_GAP, PRED_CAP = 100, 2, 200, 40
PREY_OLD, PREY_STARVE = 600, 100
PRED_OLD, PRED_STARVE = 700, 150
BIRTH_R = 0.02
# How to read "at least 150 (200) ticks have passed since that birth":
#   True  - the gap counts from the animal's own birth or its last birth given, so a first
#           birth waits until age 150 (200)
#   False - the gap applies only after the animal has given birth; a first birth needs
#           only adulthood (age 80 / 100) and 2 meals
GAP_FROM_OWN_BIRTH = False

# ---------------------------------------------------------------- the genes (my choices)
# Each animal has a heading and a small evolved controller. Every tick its senses, taken
# relative to that heading (how far a thing is to the left, how far ahead, how close), are
# weighted by its genes: one weighted sum sets how hard it turns, another sets its pace.
# Founders draw every weight at random, so a founder may be drawn toward food or away from
# it, toward a predator or away from it. Nothing in the code says which way to go; seeking
# and fleeing appear only when the weights that produce them are inherited.
#
# Turning has no bias term, so an animal that senses nothing walks straight and explores.
# Some senses are also given multiplied by hunger, so behaviour can evolve to depend on
# how hungry the animal is (for example: go to food only when hungry).
#
# Prey sense:      nearest patch with food, nearest predator in view, hunger, wall ahead
# Predators sense: nearest prey in view, nearest patch, hunger, wall ahead
# Predators also carry two body genes: how far they can see prey and how sharply they
# can turn. Prey see and turn the same fixed amount.
PREY_SENSES = 11  # food left/ahead/near (plain and x hunger), predator left/ahead/near,
                  # hunger, wall ahead
PRED_SENSES = 11  # prey left/ahead/near (plain and x hunger), patch left/ahead/near,
                  # hunger, wall ahead
PREY_VIEW = (0.2, 0.2)   # range (low, high) a gene maps into: how far a prey sees a predator
PRED_VIEW = (0.1, 1.0)   # how far a predator sees a prey
PREY_TURN = (1.0, 1.0)   # most a prey can turn in one tick (radians)
PRED_TURN = (0.2, 0.8)   # most a predator can turn in one tick (radians)
PREY_MIN_PACE = 1.0      # slowest pace as a fraction of the step limit (prey always walk fast)
PRED_MIN_PACE = 0.3
FOOD_SCENT = 0.3         # food closeness falls to zero at this distance
WALL_VIEW = 0.10
GENE_INIT = 1.0          # founders' weights are uniform in [-GENE_INIT, GENE_INIT]
MUTATION_RATE = 0.1      # chance that each gene of a child mutates
MUTATION_SIGMA = 0.1     # size of a mutation (Gaussian)


def random_genes(rng, n_senses):
    """Turn weights, pace bias and pace weights, then the two body genes."""
    return ([rng.uniform(-GENE_INIT, GENE_INIT) for _ in range(2 * n_senses + 1)]
            + [rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)])


def trait(g, span):
    lo, hi = span
    return lo + (hi - lo) * (min(1.0, max(-1.0, g)) + 1.0) / 2


def mutate(rng, genes):
    return [g + rng.gauss(0.0, MUTATION_SIGMA) if rng.random() < MUTATION_RATE else g
            for g in genes]


def think(genes, senses):
    """Returns (turn in [-1, 1], pace in [0, 1]) from the weighted senses."""
    n = len(senses)
    turn = 0.0
    pace = genes[n]
    for i, v in enumerate(senses):
        turn += genes[i] * v
        pace += genes[n + 1 + i] * v
    return math.tanh(turn), 0.5 + 0.5 * math.tanh(pace)


class Animal:
    __slots__ = ("id", "x", "y", "hx", "hy", "age", "hunger", "meals", "last_birth", "genes",
                 "view", "max_turn")

    def __init__(self, aid, x, y, heading, genes, view_range, turn_range):
        self.id, self.x, self.y = aid, x, y
        self.hx, self.hy = math.cos(heading), math.sin(heading)
        self.age = self.hunger = self.meals = 0
        self.last_birth = None  # age at which it last gave birth; None until it first does
        self.genes = genes
        self.view = trait(genes[-2], view_range)
        self.max_turn = trait(genes[-1], turn_range)


# ---------------------------------------------------------------- senses and movement
def relative(a, tx, ty, reach):
    """(left, ahead, closeness) of a target seen from animal a; closeness is 0 at reach."""
    dx, dy = tx - a.x, ty - a.y
    d = math.sqrt(dx * dx + dy * dy)
    if d < 1e-12:
        return 0.0, 0.0, 1.0
    ux, uy = dx / d, dy / d
    return (a.hx * uy - a.hy * ux, a.hx * ux + a.hy * uy, max(0.0, 1.0 - d / reach))


def wall_ahead(a):
    hx, hy = a.hx, a.hy
    tx = (1.0 - a.x) / hx if hx > 1e-9 else a.x / -hx if hx < -1e-9 else 9.0
    ty = (1.0 - a.y) / hy if hy > 1e-9 else a.y / -hy if hy < -1e-9 else 9.0
    return max(0.0, 1.0 - min(tx, ty) / WALL_VIEW)


def nearest(a, others, reach):
    best, found = reach * reach, None
    x, y = a.x, a.y
    for o in others:
        dx, dy = o.x - x, o.y - y
        d2 = dx * dx + dy * dy
        if d2 < best:
            best, found = d2, o
    return found


def steer(a, turn, pace, min_pace, limit):
    """Turn by the controller's output, then walk along the new heading. The step is
    between min_pace and 1 times the step limit, set by the controller's pace."""
    angle = a.max_turn * turn
    c, s = math.cos(angle), math.sin(angle)
    hx, hy = a.hx * c - a.hy * s, a.hx * s + a.hy * c
    n = math.sqrt(hx * hx + hy * hy)
    a.hx, a.hy = hx / n, hy / n
    step = limit * (min_pace + (1.0 - min_pace) * pace)
    a.x = min(1.0, max(0.0, a.x + a.hx * step))
    a.y = min(1.0, max(0.0, a.y + a.hy * step))


# ---------------------------------------------------------------- one run
def place_world(seed):
    rng = random.Random(seed)
    patches = []
    for _ in range(N_PATCHES):
        for _ in range(1000):
            x, y = rng.random(), rng.random()
            if all((x - px) ** 2 + (y - py) ** 2 >= PATCH_SPACING ** 2 for px, py in patches):
                break
        patches.append((x, y))
    prey = [(rng.random(), rng.random()) for _ in range(INITIAL_PREY)]
    preds = [(rng.random(), rng.random()) for _ in range(INITIAL_PREDATORS)]
    return patches, prey, preds


def give_birth(rng, parent, aid, pop, cap, adult, meals, gap, view_range, turn_range):
    if parent.last_birth is None:
        since = parent.age if GAP_FROM_OWN_BIRTH else gap
    else:
        since = parent.age - parent.last_birth
    if len(pop) >= cap or parent.age < adult or parent.meals < meals or since < gap:
        return None
    angle, r = rng.uniform(0, 2 * math.pi), BIRTH_R * math.sqrt(rng.random())
    x = min(1.0, max(0.0, parent.x + r * math.cos(angle)))
    y = min(1.0, max(0.0, parent.y + r * math.sin(angle)))
    parent.meals = 0
    parent.last_birth = parent.age
    return Animal(aid, x, y, rng.uniform(0, 2 * math.pi), mutate(rng, parent.genes),
                  view_range, turn_range)


def run(seed, record=False):
    """Simulate one seed. Returns (result dict, recording or None)."""
    patch_xy, prey_xy, pred_xy = place_world(seed)
    rng = random.Random(seed + 10000)
    prey = [Animal(i, x, y, rng.uniform(0, 2 * math.pi), random_genes(rng, PREY_SENSES),
                   PREY_VIEW, PREY_TURN) for i, (x, y) in enumerate(prey_xy)]
    preds = [Animal(i, x, y, rng.uniform(0, 2 * math.pi), random_genes(rng, PRED_SENSES),
                    PRED_VIEW, PRED_TURN) for i, (x, y) in enumerate(pred_xy)]
    stock = [PATCH_STOCK] * N_PATCHES
    next_prey_id, next_pred_id = len(prey), len(preds)
    rec = (viz.Recorder(patch_xy, (PREY_ADULT, PREY_STARVE), (PRED_ADULT, PRED_STARVE))
           if record else None)

    tick = 0
    while tick < HORIZON:
        tick += 1

        # 1. age
        for a in prey:
            a.age += 1
            a.hunger += 1
        for a in preds:
            a.age += 1
            a.hunger += 1

        # 2. prey move
        stocked = [(x, y) for (x, y), s in zip(patch_xy, stock) if s >= 1]
        for a in prey:
            fl = fa = fc = 0.0
            if stocked:
                bx, by = min(stocked, key=lambda p: (p[0] - a.x) ** 2 + (p[1] - a.y) ** 2)
                fl, fa, fc = relative(a, bx, by, FOOD_SCENT)
            pl = pa = pc = 0.0
            p = nearest(a, preds, a.view)
            if p is not None:
                pl, pa, pc = relative(a, p.x, p.y, a.view)
            h = a.hunger / PREY_STARVE
            turn, pace = think(a.genes, (fl, fa, fc, h * fl, h * fa, h * fc, pl, pa, pc,
                                          h, wall_ahead(a)))
            steer(a, turn, pace, PREY_MIN_PACE, PREY_STEP)

        # 3. predators move
        for a in preds:
            ql = qa = qc = 0.0
            q = nearest(a, prey, a.view)
            if q is not None:
                ql, qa, qc = relative(a, q.x, q.y, a.view)
            bx, by = min(patch_xy, key=lambda p: (p[0] - a.x) ** 2 + (p[1] - a.y) ** 2)
            gl, ga, gc = relative(a, bx, by, FOOD_SCENT)
            h = a.hunger / PRED_STARVE
            turn, pace = think(a.genes, (ql, qa, qc, h * ql, h * qa, h * qc, gl, ga, gc,
                                          h, wall_ahead(a)))
            steer(a, turn, pace, PRED_MIN_PACE, PRED_STEP)

        # 4. prey feed
        for a in prey:
            best, bk = FEED_R * FEED_R, -1
            for k, (x, y) in enumerate(patch_xy):
                if stock[k] >= 1:
                    d2 = (x - a.x) ** 2 + (y - a.y) ** 2
                    if d2 <= best:
                        best, bk = d2, k
            if bk >= 0:
                stock[bk] -= 1
                a.hunger = 0
                a.meals += 1

        # 5. predators hunt
        survivors = []
        for a in prey:
            best, hunter = EAT_R * EAT_R, None
            for p in preds:
                d2 = (p.x - a.x) ** 2 + (p.y - a.y) ** 2
                if d2 <= best:
                    best, hunter = d2, p
            if hunter is None:
                survivors.append(a)
            else:
                hunter.hunger = 0
                hunter.meals += 1
                if rec:
                    rec.event(tick, "eaten", a)
        prey = survivors

        # 6. starvation and old age
        if rec:
            for a in prey:
                if a.hunger >= PREY_STARVE or a.age >= PREY_OLD:
                    rec.event(tick, "prey_starved" if a.hunger >= PREY_STARVE else "prey_old", a)
            for a in preds:
                if a.hunger >= PRED_STARVE or a.age >= PRED_OLD:
                    rec.event(tick, "pred_starved" if a.hunger >= PRED_STARVE else "pred_old", a)
        prey = [a for a in prey if a.hunger < PREY_STARVE and a.age < PREY_OLD]
        preds = [a for a in preds if a.hunger < PRED_STARVE and a.age < PRED_OLD]

        # 7. births, prey then predators, lowest parent id first
        for parent in list(prey):
            child = give_birth(rng, parent, next_prey_id, prey, PREY_CAP,
                               PREY_ADULT, PREY_MEALS, PREY_GAP, PREY_VIEW, PREY_TURN)
            if child:
                prey.append(child)
                next_prey_id += 1
                if rec:
                    rec.event(tick, "prey_born", child)
        for parent in list(preds):
            child = give_birth(rng, parent, next_pred_id, preds, PRED_CAP,
                               PRED_ADULT, PRED_MEALS, PRED_GAP, PRED_VIEW, PRED_TURN)
            if child:
                preds.append(child)
                next_pred_id += 1
                if rec:
                    rec.event(tick, "pred_born", child)

        # 8. regrow
        if tick % REGROW_EVERY == 0:
            stock = [s + 1 if s < PATCH_STOCK else s for s in stock]

        if rec and (tick % viz.EVERY == 0 or not prey or not preds):
            rec.frame(tick, prey, preds, stock)

        # 9. extinction ends the run
        if not prey or not preds:
            break

    result = {"seed": seed, "survival_ticks": tick, "survived": tick == HORIZON,
              "prey_end": len(prey), "predator_end": len(preds)}
    return result, rec


def run_seed(seed):
    return run(seed)[0]


def median(values):
    v = sorted(values)
    k = len(v) // 2
    return v[k] if len(v) % 2 else (v[k - 1] + v[k]) / 2


def main():
    here = os.path.dirname(os.path.abspath(__file__))

    t0 = time.perf_counter()
    with Pool(min(len(SEEDS), os.cpu_count() or 1)) as pool:
        runs = pool.map(run_seed, SEEDS)
    runtime = time.perf_counter() - t0

    again, recording = run(0, record=True)
    reproducible = again["survival_ticks"] == runs[0]["survival_ticks"]

    ticks = [r["survival_ticks"] for r in runs]
    mid = median(ticks)
    agg = {
        "survival_rate": sum(r["survived"] for r in runs) / len(runs),
        "median_survival_ticks": int(mid) if mid == int(mid) else mid,
        "min_survival_ticks": min(ticks),
        "max_survival_ticks": max(ticks),
        "runtime_seconds": round(runtime, 2),
        "reproducible": reproducible,
    }
    summary = {
        "label": LABEL,
        "world": {
            "square": [0, 1],
            "initial_prey": INITIAL_PREY,
            "initial_predators": INITIAL_PREDATORS,
            "prey_step_limit": PREY_STEP,
            "predator_step_limit": PRED_STEP,
            "eat_radius": EAT_R,
            "food_patches": N_PATCHES,
            "patch_stock": PATCH_STOCK,
            "feeding_radius": FEED_R,
            "regrow_every": REGROW_EVERY,
            "horizon": HORIZON,
        },
        "seeds": SEEDS,
        "runs": runs,
        "aggregate": agg,
    }
    os.makedirs(os.path.join(here, "results"), exist_ok=True)
    with open(os.path.join(here, "results", "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
        f.write("\n")

    world = {"prey_step": PREY_STEP, "pred_step": PRED_STEP, "eat_r": EAT_R, "feed_r": FEED_R,
             "patch_stock": PATCH_STOCK, "horizon": HORIZON, "prey_adult": PREY_ADULT,
             "pred_adult": PRED_ADULT}
    viz.write_html(os.path.join(here, "viz.html"), recording, world, seed=0, label=LABEL,
                   survival=again["survival_ticks"])

    print(f"survival_rate={agg['survival_rate']:.2f} "
          f"median_survival_ticks={agg['median_survival_ticks']:g} "
          f"min_survival_ticks={agg['min_survival_ticks']} "
          f"max_survival_ticks={agg['max_survival_ticks']} "
          f"runtime_s={agg['runtime_seconds']:.2f} "
          f"reproducible={'true' if reproducible else 'false'}")


if __name__ == "__main__":
    main()
