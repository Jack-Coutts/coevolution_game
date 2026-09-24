"""Visualisation for coevo.py: records one run and writes a self-contained viz.html.

Every EVERY-th tick the recorder stores each living animal (id, position, heading, a few
status bits) and every patch's stock. Frames are packed as little-endian binary,
gzip-compressed and base64-embedded, so the page needs no server or network.
"""

import base64
import gzip
import json
import math
import struct

EVERY = 5
KINDS = {"eaten": 0, "prey_starved": 1, "prey_old": 2, "pred_starved": 3, "pred_old": 4,
         "prey_born": 5, "pred_born": 6}


class Recorder:
    def __init__(self, patches, prey_life, pred_life):
        """prey_life and pred_life are (adult age, ticks to starve) for the status bits."""
        self.patches = [[round(x, 5), round(y, 5)] for x, y in patches]
        self.lives = (prey_life, pred_life)
        self.buf = bytearray()
        self.ticks = []
        self.events = []

    def event(self, tick, kind, a):
        self.events.append([tick, KINDS[kind], round(a.x, 4), round(a.y, 4)])

    def frame(self, tick, prey, preds, stock):
        self.ticks.append(tick)
        self.buf += struct.pack("<HHH", tick, len(prey), len(preds))
        self.buf += bytes(stock)
        for group, (adult, starve) in zip((prey, preds), self.lives):
            for a in group:
                heading = round(math.atan2(a.hy, a.hx) / (2 * math.pi) * 256) & 255
                flags = (1 if a.age < adult else 0) | (min(3, a.hunger * 4 // starve) << 1)
                self.buf += struct.pack("<HHHBB", a.id & 0xFFFF, round(a.x * 65535),
                                        round(a.y * 65535), heading, flags)


def write_html(path, rec, world, seed, label, survival):
    data = base64.b64encode(gzip.compress(bytes(rec.buf), 9, mtime=0)).decode("ascii")
    meta = {
        "seed": seed,
        "label": label,
        "survival": survival,
        "world": world,
        "patches": rec.patches,
        "frames": len(rec.ticks),
        "events": rec.events,
    }
    html = (TEMPLATE.replace("__META__", json.dumps(meta, separators=(",", ":")))
            .replace("__DATA__", data))
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coevolution: a living meadow</title>
<style>
  :root {
    --bg: #060a09; --panel: #0c1311; --line: #1b2824; --text: #e6eee9; --muted: #8a9e95;
    --prey: #f3e4c4; --gold: #ffcf5a; --pred: #ff4d5e; --food: #86e08a;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text);
    font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .app { display: grid; grid-template-columns: minmax(0, 1fr) 310px;
    grid-template-rows: auto minmax(0, 1fr) auto; height: 100vh; }
  header { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
    padding: 12px 18px; border-bottom: 1px solid var(--line); }
  header h1 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: .01em; }
  header .sub { color: var(--muted); font-size: 13px; }
  .stage { position: relative; display: flex; align-items: center; justify-content: center;
    padding: 14px; min-height: 0; min-width: 0; }
  #world { display: block; border-radius: 8px; box-shadow: 0 0 0 1px #2b3c35, 0 24px 70px rgba(0,0,0,.65); }
  .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: var(--muted); font-size: 15px; text-align: center; padding: 24px; }
  aside { border-left: 1px solid var(--line); background: var(--panel); padding: 16px 16px 20px; overflow: auto; }
  .tick { font-size: 30px; font-weight: 700; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
  .tick small { font-size: 15px; color: var(--muted); font-weight: 500; }
  .runbar { height: 4px; background: #17221f; border-radius: 3px; margin: 8px 0 4px; overflow: hidden; }
  .runbar > div { height: 100%; width: 0; background: linear-gradient(90deg, #6fcf8f, var(--gold)); }
  .runlabel { color: var(--muted); font-size: 12px; }
  .badge { display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 999px; font-size: 12px;
    background: #3a1c22; color: #ffb3bc; border: 1px solid #5b2a33; }
  .badge.ok { background: #1a3323; color: #b6f0c4; border-color: #2c5a3a; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0; }
  .card { background: #111b18; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .card .k { color: var(--muted); font-size: 12px; }
  .card .v { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .card .v small { font-size: 12px; color: var(--muted); font-weight: 500; }
  .v.prey { color: var(--gold); } .v.pred { color: var(--pred); } .v.food { color: var(--food); }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 18px 0 8px; font-weight: 600; }
  #chart { width: 100%; height: 130px; display: block; cursor: pointer; border-radius: 8px; background: #0f1816; border: 1px solid var(--line); }
  .chartkey { display: flex; gap: 14px; font-size: 12px; color: var(--muted); margin-top: 6px; }
  .chartkey i { display: inline-block; width: 10px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 5px; }
  .legend { display: grid; grid-template-columns: 26px 1fr; gap: 7px 8px; align-items: center; font-size: 13px; }
  .legend canvas { width: 26px; height: 22px; }
  .keys { color: var(--muted); font-size: 12px; line-height: 1.9; }
  kbd { font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 6px; border-radius: 5px;
    border: 1px solid #2c3d37; background: #13201c; color: var(--text); }
  .controls { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 10px 16px; border-top: 1px solid var(--line); background: var(--panel); }
  button { font: inherit; color: var(--text); background: #15211d; border: 1px solid #263631; border-radius: 9px;
    height: 36px; min-width: 36px; padding: 0 10px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  button:hover { background: #1b2a25; }
  button:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
  button.primary { background: #e9c25a; color: #1a1406; border-color: #e9c25a; min-width: 44px; }
  button.primary:hover { background: #f5d172; }
  button svg { width: 16px; height: 16px; fill: currentColor; }
  #scrub { flex: 1; min-width: 160px; accent-color: var(--gold); height: 28px; }
  .speed { display: inline-flex; border: 1px solid #263631; border-radius: 9px; overflow: hidden; }
  .speed button { border: 0; border-radius: 0; height: 34px; min-width: 38px; padding: 0 8px; background: #121d1a; font-size: 12px; color: var(--muted); }
  .speed button.on { background: #24362f; color: var(--text); }
  .scrublabel { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 13px; min-width: 84px; text-align: right; }
  @media (max-width: 860px) {
    .app { grid-template-columns: 1fr; grid-template-rows: auto auto auto auto; height: auto; }
    .stage { padding: 10px; }
    aside { border-left: 0; border-top: 1px solid var(--line); }
    .controls { position: sticky; bottom: 0; }
  }
</style>
</head>
<body>
<div class="app">
  <header>
    <h1>Coevolution in a living meadow</h1>
    <span class="sub" id="subtitle"></span>
  </header>
  <div class="stage" id="stage">
    <canvas id="world" aria-label="Simulation of prey, predators and food patches"></canvas>
    <div class="overlay" id="overlay">Unpacking the recording&hellip;</div>
  </div>
  <aside>
    <div class="tick">Tick <span id="tickNum">0</span> <small>/ <span id="tickMax">0</span></small></div>
    <div class="runbar"><div id="runFill"></div></div>
    <div class="runlabel" id="runLabel"></div>
    <div id="badges"></div>
    <div class="cards">
      <div class="card"><div class="k">Prey</div><div class="v prey" id="preyN">0</div></div>
      <div class="card"><div class="k">Predators</div><div class="v pred" id="predN">0</div></div>
      <div class="card"><div class="k">Food in patches</div><div class="v food" id="foodN">0</div></div>
      <div class="card"><div class="k">Prey eaten so far</div><div class="v" id="eatenN">0</div></div>
    </div>
    <h2>Populations over the run</h2>
    <canvas id="chart" aria-label="Prey and predator counts over time"></canvas>
    <div class="chartkey"><span><i style="background:var(--gold)"></i>prey</span>
      <span><i style="background:var(--pred)"></i>predators</span>
      <span><i style="background:var(--food)"></i>food</span></div>
    <h2>Field guide</h2>
    <div class="legend" id="legend"></div>
    <h2>Keys</h2>
    <div class="keys"><kbd>Space</kbd> play / pause &nbsp; <kbd>&larr;</kbd> <kbd>&rarr;</kbd> step 5 ticks<br>
      <kbd>&uarr;</kbd> <kbd>&darr;</kbd> speed &nbsp; <kbd>Home</kbd> <kbd>End</kbd> start / end</div>
  </aside>
  <div class="controls">
    <button id="prev" title="Step back 5 ticks (Left arrow)" aria-label="Step back">
      <svg viewBox="0 0 16 16"><path d="M3 2h2v12H3zM14 2v12L6 8z"/></svg></button>
    <button id="play" class="primary" title="Play / pause (Space)" aria-label="Play"></button>
    <button id="next" title="Step forward 5 ticks (Right arrow)" aria-label="Step forward">
      <svg viewBox="0 0 16 16"><path d="M11 2h2v12h-2zM2 2v12l8-6z"/></svg></button>
    <input id="scrub" type="range" min="0" max="1" value="0" step="1" aria-label="Time">
    <span class="scrublabel" id="scrubLabel">tick 0</span>
    <div class="speed" id="speed" role="group" aria-label="Speed"></div>
  </div>
</div>
<script>
"use strict";
const META = __META__;
const DATA = "__DATA__";

const W = META.world, PATCHES = META.patches, NPATCH = PATCHES.length;
const BASE_RATE = 60;            // ticks per second at 1x
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];
const TRAIL = 8;                 // recorded frames of trail behind each animal
const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2v12l10-6z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16"><path d="M3 2h4v12H3zM9 2h4v12H9z"/></svg>';

const $ = id => document.getElementById(id);
const canvas = $("world"), ctx = canvas.getContext("2d");
let F = [], playing = false, speedIdx = 3, pos = 0;      // pos: fractional frame index
let size = 600, dpr = 1, terrain = null, lastTime = 0, clock = 0;

// ---------------------------------------------------------------- data
async function unpack() {
  const bin = Uint8Array.from(atob(DATA), c => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer(), dv = new DataView(buf);
  let o = 0;
  for (let f = 0; f < META.frames; f++) {
    const tick = dv.getUint16(o, true), np = dv.getUint16(o + 2, true), nq = dv.getUint16(o + 4, true);
    o += 6;
    const stock = new Uint8Array(buf, o, NPATCH).slice(); o += NPATCH;
    const read = n => {
      const a = { id: new Uint16Array(n), x: new Float32Array(n), y: new Float32Array(n),
        h: new Float32Array(n), young: new Uint8Array(n), hunger: new Uint8Array(n), index: new Map() };
      for (let i = 0; i < n; i++, o += 8) {
        a.id[i] = dv.getUint16(o, true);
        a.x[i] = dv.getUint16(o + 2, true) / 65535; a.y[i] = dv.getUint16(o + 4, true) / 65535;
        a.h[i] = dv.getUint8(o + 6) / 256 * 2 * Math.PI;
        const fl = dv.getUint8(o + 7); a.young[i] = fl & 1; a.hunger[i] = fl >> 1;
        a.index.set(a.id[i], i);
      }
      return a;
    };
    const prey = read(np), pred = read(nq);
    F.push({ tick, stock, prey, pred });
  }
  let eaten = 0, e = 0;
  const ev = META.events;
  for (const fr of F) { while (e < ev.length && ev[e][0] <= fr.tick) { if (ev[e][1] === 0) eaten++; e++; } fr.eaten = eaten; }
}

const lerpAngle = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; };

// ---------------------------------------------------------------- habitat (bonus B1)
function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let r = Math.imul(seed ^ seed >>> 15, 1 | seed);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; };
}
const X = x => x * size, Y = y => (1 - y) * size;

function valueNoise(rand, n) {
  const grid = Array.from({ length: n + 1 }, () => Array.from({ length: n + 1 }, rand));
  const sm = v => v * v * (3 - 2 * v);
  return (x, y) => {
    x *= n; y *= n; const i = Math.min(n - 1, Math.floor(x)), j = Math.min(n - 1, Math.floor(y));
    const u = sm(x - i), v = sm(y - j);
    const a = grid[i][j] + (grid[i + 1][j] - grid[i][j]) * u;
    const b = grid[i][j + 1] + (grid[i + 1][j + 1] - grid[i][j + 1]) * u;
    return a + (b - a) * v;
  };
}
const rand0 = mulberry(20260924 + META.seed);
const NOISE = [valueNoise(rand0, 4), valueNoise(rand0, 9), valueNoise(rand0, 23)];
const fbm = (x, y) => NOISE[0](x, y) * 0.55 + NOISE[1](x, y) * 0.3 + NOISE[2](x, y) * 0.15;
const nearPatch = (x, y, r) => PATCHES.some(([px, py]) => Math.hypot(x - px, y - py) < r);
function scatter(rand, count, clear) {
  const pts = [];
  for (let tries = 0; pts.length < count && tries < count * 50; tries++) {
    const x = 0.03 + rand() * 0.94, y = 0.03 + rand() * 0.94;
    if (!nearPatch(x, y, clear)) pts.push([x, y, rand(), rand()]);
  }
  return pts;
}
const ROCKS = scatter(mulberry(7), 18, 0.07);
const SHRUBS = scatter(mulberry(11), 22, 0.08);
const TUFTS = scatter(mulberry(13), 240, 0.03);
const FLOWERS = scatter(mulberry(17), 90, 0.02);
const FLIES = Array.from({ length: 34 }, (_, i) => { const r = mulberry(100 + i); return [r(), r(), r() * 6.28, 0.5 + r()]; });
const BUSHES = PATCHES.map((_, k) => { const r = mulberry(300 + k);
  return Array.from({ length: 7 }, () => [r() * 6.283, Math.sqrt(r()), 0.6 + r() * 0.5, r(), r()]); });

function buildTerrain() {
  const c = document.createElement("canvas");
  c.width = c.height = Math.round(size * dpr);
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  const n = 140, img = new ImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n, y = 1 - (j + 0.5) / n, h = fbm(x, y);
    let moist = 0;
    for (const [px, py] of PATCHES) moist = Math.max(moist, 1 - Math.hypot(x - px, y - py) / 0.13);
    const k = (j * n + i) * 4;
    img.data[k] = 10 + h * 18 + moist * 5;
    img.data[k + 1] = 22 + h * 34 + moist * 18;
    img.data[k + 2] = 18 + h * 20 + moist * 7;
    img.data[k + 3] = 255;
  }
  const small = document.createElement("canvas"); small.width = small.height = n;
  small.getContext("2d").putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(small, 0, 0, size, size);

  // contour lines of the ground (marching squares)
  const m = 110, vals = new Float32Array((m + 1) * (m + 1));
  for (let j = 0; j <= m; j++) for (let i = 0; i <= m; i++) vals[j * (m + 1) + i] = fbm(i / m, j / m);
  g.lineWidth = 1;
  for (let level = 0.3; level < 0.8; level += 0.06) {
    g.strokeStyle = "rgba(170, 220, 180, 0.07)";
    g.beginPath();
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const a = vals[j * (m + 1) + i], b = vals[j * (m + 1) + i + 1];
      const cc = vals[(j + 1) * (m + 1) + i + 1], d = vals[(j + 1) * (m + 1) + i];
      const pts = [];
      const edge = (v1, v2, x1, y1, x2, y2) => {
        if ((v1 > level) !== (v2 > level)) { const f = (level - v1) / (v2 - v1); pts.push(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f); }
      };
      edge(a, b, i, j, i + 1, j); edge(b, cc, i + 1, j, i + 1, j + 1);
      edge(cc, d, i + 1, j + 1, i, j + 1); edge(d, a, i, j + 1, i, j);
      for (let k = 0; k + 3 < pts.length; k += 4) {
        g.moveTo(X(pts[k] / m), Y(pts[k + 1] / m)); g.lineTo(X(pts[k + 2] / m), Y(pts[k + 3] / m));
      }
    }
    g.stroke();
  }

  // shrubs, rocks and flowers (decoration only: animals walk straight over them)
  for (const [x, y, r1, r2] of SHRUBS) {              // dark ferns, clearly not food
    const cx = X(x), cy = Y(y), s = size * (0.012 + r1 * 0.012);
    const rs = mulberry(Math.floor(r2 * 1e6));
    g.strokeStyle = "rgba(24, 58, 44, 0.9)"; g.lineWidth = Math.max(1, size * 0.0018);
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.42 + (rs() - 0.5) * 0.2, len = s * (0.7 + rs() * 0.5);
      g.beginPath(); g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.3, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      g.stroke();
    }
  }
  for (const [x, y, r1, r2] of ROCKS) {
    const cx = X(x), cy = Y(y), s = size * (0.007 + r1 * 0.012), rot = r2 * 3.14;
    g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(cx + s * 0.3, cy + s * 0.35, s * 1.1, s * 0.7, rot, 0, 7); g.fill();
    g.fillStyle = "#3b4642"; g.beginPath(); g.ellipse(cx, cy, s, s * 0.68, rot, 0, 7); g.fill();
    g.fillStyle = "rgba(200,215,208,0.16)"; g.beginPath(); g.ellipse(cx - s * 0.25, cy - s * 0.2, s * 0.5, s * 0.3, rot, 0, 7); g.fill();
  }
  for (const [x, y, r1] of FLOWERS) {
    g.fillStyle = r1 < 0.33 ? "rgba(255,240,200,0.55)" : r1 < 0.66 ? "rgba(190,170,255,0.5)" : "rgba(255,190,120,0.5)";
    g.beginPath(); g.arc(X(x), Y(y), size * 0.0018, 0, 7); g.fill();
  }
  // bare, grazed earth under each patch
  for (const [px, py] of PATCHES) {
    const grad = g.createRadialGradient(X(px), Y(py), 0, X(px), Y(py), size * 0.05);
    grad.addColorStop(0, "rgba(70, 55, 35, 0.55)"); grad.addColorStop(1, "rgba(70, 55, 35, 0)");
    g.fillStyle = grad; g.beginPath(); g.arc(X(px), Y(py), size * 0.05, 0, 7); g.fill();
  }
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.75);
  grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  return c;
}

// ---------------------------------------------------------------- drawing
function drawAmbient() {
  ctx.lineWidth = Math.max(1, size * 0.0016);
  ctx.strokeStyle = "rgba(120, 175, 120, 0.30)";
  ctx.beginPath();
  for (const [x, y, r1, r2] of TUFTS) {
    const cx = X(x), cy = Y(y), h = size * (0.007 + r1 * 0.007);
    const sway = Math.sin(clock * 1.4 + x * 9 + y * 5) * h * 0.35;
    for (let b = -1; b <= 1; b++) {
      ctx.moveTo(cx + b * h * 0.25, cy);
      ctx.quadraticCurveTo(cx + b * h * 0.35, cy - h * 0.6, cx + b * h * 0.5 + sway, cy - h * (0.9 + r2 * 0.3));
    }
  }
  ctx.stroke();
}

const DAY = 1200;                // ticks in one day of the meadow's light cycle
const nightness = tick => Math.max(0, -Math.cos(2 * Math.PI * tick / DAY)) ** 1.5;
function drawFlies(night) {
  for (const [x0, y0, ph, sp] of FLIES) {
    const x = (x0 + 0.05 * Math.sin(clock * 0.3 * sp + ph) + 1) % 1, y = (y0 + 0.04 * Math.cos(clock * 0.23 * sp + ph * 2) + 1) % 1;
    const a = Math.max(0, Math.sin(clock * 1.7 * sp + ph)) * 0.8 * night;
    if (a < 0.03) continue;
    const g = ctx.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), size * 0.008);
    g.addColorStop(0, `rgba(215, 255, 140, ${a})`); g.addColorStop(1, "rgba(215, 255, 140, 0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(x), Y(y), size * 0.008, 0, 7); ctx.fill();
  }
}

function drawPatch(g, cx, cy, k, frac, s) {
  // a berry bush whose size follows the patch stock
  const r = s * (0.012 + 0.03 * frac);
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2 + s * 0.01);
  glow.addColorStop(0, `rgba(120, 230, 120, ${0.12 + 0.25 * frac})`); glow.addColorStop(1, "rgba(120, 230, 120, 0)");
  g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, r * 2.2 + s * 0.01, 0, 7); g.fill();
  if (frac <= 0) {
    g.strokeStyle = "rgba(160, 130, 90, 0.7)"; g.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) { const a = i * 1.26; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * s * 0.01, cy + Math.sin(a) * s * 0.01); g.stroke(); }
    return;
  }
  for (const [a, d, sz, c1] of BUSHES[k]) {
    const bx = cx + Math.cos(a) * d * r * 0.7, by = cy + Math.sin(a) * d * r * 0.7;
    g.fillStyle = `rgb(${50 + c1 * 30}, ${120 + c1 * 60 + frac * 20}, ${62 + c1 * 22})`;
    g.beginPath(); g.arc(bx, by, r * 0.5 * sz, 0, 7); g.fill();
  }
  const berries = Math.round(3 + frac * 9);
  for (let i = 0; i < berries; i++) {
    const [a, d, , , c2] = BUSHES[k][i % 7], ang = a + i * 2.1;
    const bx = cx + Math.cos(ang) * d * r * 0.8, by = cy + Math.sin(ang) * d * r * 0.8;
    g.fillStyle = c2 < 0.5 ? "#e3445f" : "#b061ff";
    g.beginPath(); g.arc(bx, by, Math.max(1.2, s * 0.0026), 0, 7); g.fill();
  }
}

function drawPatches(fr, nx, f) {
  const feed = W.feed_r * size;
  for (let k = 0; k < NPATCH; k++) {
    const stock = fr.stock[k] + ((nx ? nx.stock[k] : fr.stock[k]) - fr.stock[k]) * f;
    const cx = X(PATCHES[k][0]), cy = Y(PATCHES[k][1]);
    drawPatch(ctx, cx, cy, k, stock / W.patch_stock, size);
    ctx.save(); ctx.setLineDash([3, 3]); ctx.lineDashOffset = -clock * 6;
    ctx.strokeStyle = "rgba(150, 240, 150, 0.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, feed, 0, 7); ctx.stroke(); ctx.restore();
  }
}

function drawPrey(g, x, y, ang, r, body, outline) {
  g.save();
  g.translate(x, y); g.rotate(-ang);
  g.fillStyle = body; g.strokeStyle = outline; g.lineWidth = Math.max(0.8, r * 0.18);
  g.beginPath(); g.moveTo(-r * 1.2, 0); g.lineTo(-r * 1.9, r * 0.25); g.stroke();           // tail
  g.beginPath(); g.ellipse(-r * 0.1, 0, r * 1.15, r * 0.78, 0, 0, 7); g.fill(); g.stroke(); // body
  g.beginPath(); g.arc(r * 1.05, 0, r * 0.55, 0, 7); g.fill(); g.stroke();                  // head
  g.beginPath(); g.ellipse(r * 0.75, -r * 0.55, r * 0.32, r * 0.2, -0.6, 0, 7); g.fill();  // ears
  g.beginPath(); g.ellipse(r * 0.75, r * 0.55, r * 0.32, r * 0.2, 0.6, 0, 7); g.fill();
  g.fillStyle = "#1a120a"; g.beginPath(); g.arc(r * 1.3, -r * 0.2, r * 0.12, 0, 7); g.arc(r * 1.3, r * 0.2, r * 0.12, 0, 7); g.fill();
  g.restore();
}

function drawPredator(g, x, y, ang, p, fill, edge) {
  g.save(); g.translate(x, y); g.rotate(-ang);
  g.fillStyle = fill;
  g.beginPath(); g.moveTo(p, 0); g.lineTo(-p * 0.7, p * 0.62); g.lineTo(-p * 0.4, 0); g.lineTo(-p * 0.7, -p * 0.62); g.closePath();
  g.fill();
  if (edge) { g.strokeStyle = edge; g.lineWidth = Math.max(1, p * 0.1); g.stroke(); }
  g.restore();
}

// Draw one species at fractional time: interpolate each animal toward its next frame;
// animals missing from the next frame fade out, newborns fade in.
function drawSpecies(i, f, pred) {
  const fr = F[i], nx = F[Math.min(F.length - 1, i + 1)];
  const a = pred ? fr.pred : fr.prey, b = pred ? nx.pred : nx.prey;
  const out = [];
  for (let k = 0; k < a.id.length; k++) {
    const j = b.index.get(a.id[k]);
    if (j === undefined) out.push([a.x[k], a.y[k], a.h[k], a.young[k], a.hunger[k], 1 - f, a.id[k]]);
    else out.push([a.x[k] + (b.x[j] - a.x[k]) * f, a.y[k] + (b.y[j] - a.y[k]) * f, lerpAngle(a.h[k], b.h[j], f), b.young[j], b.hunger[j], 1, a.id[k]]);
  }
  for (let j = 0; j < b.id.length; j++) if (!a.index.has(b.id[j])) out.push([b.x[j], b.y[j], b.h[j], 1, 0, f, b.id[j]]);

  // trails
  ctx.lineWidth = Math.max(1, size * (pred ? 0.0022 : 0.0015)); ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [x, y, , , , alpha, id] of out) {
    ctx.strokeStyle = pred ? `rgba(255, 77, 94, ${0.35 * alpha})` : `rgba(243, 228, 196, ${0.18 * alpha})`;
    ctx.beginPath(); ctx.moveTo(X(x), Y(y));
    for (let back = 0; back < TRAIL && i - back >= 0; back++) {
      const s = pred ? F[i - back].pred : F[i - back].prey, k = s.index.get(id);
      if (k === undefined) break;
      ctx.lineTo(X(s.x[k]), Y(s.y[k]));
    }
    ctx.stroke();
  }
  for (const [x, y, h, young, hunger, alpha] of out) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (pred) {
      const p = size * (young ? 0.012 : 0.017);
      ctx.shadowColor = "rgba(255, 60, 80, 0.7)"; ctx.shadowBlur = size * 0.012;
      drawPredator(ctx, X(x), Y(y), h, p, hunger >= 3 ? "#b8404d" : "#ff4d5e", "#3a0c12");
      ctx.shadowBlur = 0;
    } else {
      const r = size * (young ? 0.0068 : 0.0095);
      drawPrey(ctx, X(x), Y(y), h, r, hunger >= 3 ? "#c9bca4" : "#f3e4c4", "rgba(60, 40, 20, 0.85)");
    }
  }
  ctx.globalAlpha = 1;
}

function drawEvents(tick) {
  for (const [t, kind, x, y] of recentEvents(tick, 25)) {
    const age = (tick - t) / 25;
    if (age < 0 || age > 1) continue;
    if (kind === 0) {
      ctx.strokeStyle = `rgba(255, 90, 90, ${0.9 * (1 - age)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(x), Y(y), size * (0.01 + age * 0.03), 0, 7); ctx.stroke();
    } else if (kind === 5 || kind === 6) {
      ctx.strokeStyle = kind === 5 ? `rgba(255, 220, 140, ${0.7 * (1 - age)})` : `rgba(255, 150, 160, ${0.7 * (1 - age)})`;
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(x), Y(y), size * (0.006 + age * 0.018), 0, 7); ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(170, 170, 160, ${0.45 * (1 - age)})`;
      ctx.beginPath(); ctx.arc(X(x), Y(y), size * (0.006 + age * 0.012), 0, 7); ctx.fill();
    }
  }
}
function recentEvents(tick, span) {
  const ev = META.events;
  let lo = 0, hi = ev.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ev[mid][0] < tick - span) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let k = lo; k < ev.length && ev[k][0] <= tick; k++) out.push(ev[k]);
  return out;
}

function draw() {
  if (!F.length) return;
  const i = Math.min(F.length - 1, Math.floor(pos)), f = i < F.length - 1 ? pos - i : 0;
  const fr = F[i], nx = F[Math.min(F.length - 1, i + 1)];
  const tick = fr.tick + (nx.tick - fr.tick) * f;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(terrain, 0, 0, size, size);
  drawAmbient();
  drawPatches(fr, nx, f);
  drawEvents(tick);
  drawSpecies(i, f, false);
  drawSpecies(i, f, true);
  const night = nightness(tick);
  if (night > 0.01) { ctx.fillStyle = `rgba(8, 14, 40, ${0.32 * night})`; ctx.fillRect(0, 0, size, size); drawFlies(night); }
  ctx.strokeStyle = "rgba(210, 235, 220, 0.55)"; ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, size - 1.5, size - 1.5);
  updatePanel(i, tick);
}

// ---------------------------------------------------------------- panel
let chartCtx = null, chartW = 0, chartH = 0, maxPop = 1;
function sizeChart() {
  const c = $("chart"), r = c.getBoundingClientRect();
  chartW = r.width; chartH = r.height;
  c.width = Math.round(chartW * dpr); c.height = Math.round(chartH * dpr);
  chartCtx = c.getContext("2d"); chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function renderChart() {
  const g = chartCtx, w = chartW, h = chartH, pad = 8, n = F.length;
  if (!g || !n) return;
  g.clearRect(0, 0, w, h);
  const xs = i => pad + (w - 2 * pad) * i / Math.max(1, n - 1), ys = v => h - pad - (h - 2 * pad) * v / maxPop;
  g.strokeStyle = "rgba(255,255,255,0.06)"; g.lineWidth = 1;
  for (let v = 0; v <= maxPop; v += 25) { g.beginPath(); g.moveTo(pad, ys(v)); g.lineTo(w - pad, ys(v)); g.stroke(); }
  const line = (get, color, scale = 1) => { g.strokeStyle = color; g.lineWidth = 1.4; g.beginPath();
    F.forEach((fr, i) => { const v = get(fr) * scale; i ? g.lineTo(xs(i), ys(v)) : g.moveTo(xs(i), ys(v)); }); g.stroke(); };
  line(fr => fr.stock.reduce((a, b) => a + b, 0), "rgba(134, 224, 138, 0.45)", maxPop / (NPATCH * W.patch_stock));
  line(fr => fr.prey.id.length, "rgba(255, 207, 90, 0.95)");
  line(fr => fr.pred.id.length, "rgba(255, 77, 94, 0.95)");
  g.strokeStyle = "#e6eee9"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xs(pos), 2); g.lineTo(xs(pos), h - 2); g.stroke();
}

function updatePanel(i, tick) {
  const fr = F[i];
  $("tickNum").textContent = Math.round(tick);
  $("runFill").style.width = (100 * tick / META.survival) + "%";
  $("preyN").textContent = fr.prey.id.length;
  $("predN").textContent = fr.pred.id.length;
  $("foodN").innerHTML = `${fr.stock.reduce((a, b) => a + b, 0)} <small>/ ${NPATCH * W.patch_stock}</small>`;
  $("eatenN").textContent = fr.eaten;
  $("scrubLabel").textContent = `tick ${fr.tick}`;
  $("scrub").value = i;
}

function setBadges() {
  const done = META.survival >= W.horizon;
  const last = F[F.length - 1];
  const who = !last.prey.id.length ? "prey died out" : !last.pred.id.length ? "predators died out" : "";
  $("runLabel").textContent = done ? `both species lived to the ${W.horizon}-tick horizon`
    : `the run ended at tick ${META.survival}: ${who}`;
  $("badges").innerHTML = done ? '<span class="badge ok">survived the whole horizon</span>'
    : `<span class="badge">${who} at tick ${META.survival}</span>`;
}

function buildLegend() {
  const items = [["prey", "Prey, a small grazer"], ["young", "Young prey (not yet able to breed)"],
    ["pred", "Predator (triangle)"], ["hungry", "Predator close to starving"], ["patch", "Food patch, sized by its stock"],
    ["eaten", "A prey being eaten"]];
  const box = $("legend");
  for (const [kind, text] of items) {
    const c = document.createElement("canvas"); c.width = 52; c.height = 44;
    const g = c.getContext("2d"); g.scale(2, 2);
    const cx = 13, cy = 11;
    if (kind === "prey") drawPrey(g, cx, cy, 0, 5.2, "#f3e4c4", "rgba(60,40,20,.85)");
    if (kind === "young") drawPrey(g, cx, cy, 0, 3.6, "#f3e4c4", "rgba(60,40,20,.85)");
    if (kind === "pred") drawPredator(g, cx, cy, 0, 9, "#ff4d5e", "#3a0c12");
    if (kind === "hungry") drawPredator(g, cx, cy, 0, 9, "#b8404d", "#3a0c12");
    if (kind === "patch") drawPatch(g, cx, cy, 0, 0.7, 300);
    if (kind === "eaten") { g.strokeStyle = "rgba(255,90,90,.9)"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.stroke(); }
    const label = document.createElement("span"); label.textContent = text;
    box.append(c, label);
  }
}

// ---------------------------------------------------------------- controls
function seek(p) { pos = Math.max(0, Math.min(F.length - 1, p)); renderChart(); draw(); }
function setPlaying(p) {
  playing = p;
  if (playing && pos >= F.length - 1) pos = 0;
  const b = $("play");
  b.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  b.setAttribute("aria-label", playing ? "Pause" : "Play");
}
function setSpeed(i) {
  speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, i));
  [...$("speed").children].forEach((b, k) => b.classList.toggle("on", k === speedIdx));
}
function step(d) { seek(Math.round(pos) + d); }

let chartTimer = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000 || 0);
  lastTime = now; clock += dt;
  if (playing && F.length) {
    pos += dt * BASE_RATE * SPEEDS[speedIdx] / 5;
    if (pos >= F.length - 1) { pos = F.length - 1; setPlaying(false); }
    if ((chartTimer += dt) > 0.1) { chartTimer = 0; renderChart(); }
  }
  draw();
  requestAnimationFrame(frame);
}

function resize() {
  const st = $("stage"), r = st.getBoundingClientRect();
  const narrow = window.innerWidth <= 860;
  const avail = narrow ? r.width - 20 : Math.min(r.width, r.height) - 28;
  size = Math.max(260, Math.floor(avail));
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
  canvas.style.width = size + "px"; canvas.style.height = size + "px";
  terrain = buildTerrain();
  sizeChart(); renderChart(); draw();
}

function wire() {
  $("subtitle").textContent = `seed ${META.seed} · a continuous ecology, recorded every 5th tick · evolved by ${META.label}`;
  $("tickMax").textContent = META.survival;
  SPEEDS.forEach((v, i) => { const b = document.createElement("button"); b.textContent = v + "×";
    b.title = `Speed ${v}×`; b.onclick = () => { setSpeed(i); b.blur(); }; $("speed").append(b); });
  setSpeed(speedIdx); setPlaying(false);
  $("play").onclick = e => { setPlaying(!playing); e.currentTarget.blur(); };
  $("prev").onclick = e => { step(-1); e.currentTarget.blur(); };
  $("next").onclick = e => { step(1); e.currentTarget.blur(); };
  $("scrub").oninput = e => seek(+e.target.value);
  const pick = e => { const r = $("chart").getBoundingClientRect(); seek(Math.round((e.clientX - r.left - 8) / (r.width - 16) * (F.length - 1))); };
  $("chart").addEventListener("pointerdown", e => { pick(e); $("chart").setPointerCapture(e.pointerId); });
  $("chart").addEventListener("pointermove", e => { if (e.buttons) pick(e); });
  window.addEventListener("keydown", e => {
    if (e.key === " " || e.code === "Space") { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSpeed(speedIdx + 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSpeed(speedIdx - 1); }
    else if (e.key === "Home") { e.preventDefault(); seek(0); }
    else if (e.key === "End") { e.preventDefault(); seek(F.length - 1); }
  });
  window.addEventListener("resize", resize);
}

wire();
resize();
unpack().then(() => {
  $("overlay").remove();
  $("scrub").max = F.length - 1;
  maxPop = Math.max(10, Math.ceil(Math.max(...F.map(fr => Math.max(fr.prey.id.length, fr.pred.id.length))) / 25) * 25);
  buildLegend(); setBadges();
  seek(0);
  setPlaying(true);
  requestAnimationFrame(frame);
}).catch(err => {
  $("overlay").textContent = "This browser could not unpack the recording (it needs DecompressionStream: Chrome 80+, Firefox 113+, Safari 16.4+). " + err;
});
</script>
</body>
</html>
"""
