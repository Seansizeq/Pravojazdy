import * as THREE from 'three';
import type { Cell, Dir } from '../types';
import { DIR_VEC, LANE, OPP, RIGHT_OF, RING_R, TILE, cellCenter, type RoadGrid } from './build';

/** Кут сторони клітинки в математичних координатах (схід = 0, північ = π/2). */
const SIDE_ANGLE: Record<Dir, number> = { E: 0, N: Math.PI / 2, W: Math.PI, S: -Math.PI / 2 };

export type Turn = 'left' | 'right' | 'straight' | 'uturn';
const ORDER: Dir[] = ['N', 'E', 'S', 'W'];
export function relTurn(from: Dir, to: Dir): Turn {
  const d = (ORDER.indexOf(to) - ORDER.indexOf(from) + 4) % 4;
  return d === 0 ? 'straight' : d === 1 ? 'right' : d === 3 ? 'left' : 'uturn';
}

/**
 * Траєкторія по своїй (правій) смузі через клітинку: в'їзд у напрямку inDir, виїзд у напрямку outDir.
 * Повертає ламану з точок, по якій їдуть машини трафіку.
 */
export function lanePath(cell: Cell, inDir: Dir, outDir: Dir, roundabout: boolean): THREE.Vector3[] {
  const c = cellCenter(cell);
  const [ix, iz] = DIR_VEC[inDir];
  const [ox, oz] = DIR_VEC[outDir];
  const [irx, irz] = DIR_VEC[RIGHT_OF[inDir]];
  const [orx, orz] = DIR_VEC[RIGHT_OF[outDir]];
  const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  const entry = V(c.x - (ix * TILE) / 2 + irx * LANE, c.z - (iz * TILE) / 2 + irz * LANE);
  const exit = V(c.x + (ox * TILE) / 2 + orx * LANE, c.z + (oz * TILE) / 2 + orz * LANE);

  if (roundabout) {
    // рух по колу проти годинникової стрілки
    const a0 = SIDE_ANGLE[OPP[inDir]] + 0.5;
    let a1 = SIDE_ANGLE[outDir] - 0.5;
    while (a1 <= a0) a1 += Math.PI * 2;
    const pts = [entry];
    const steps = Math.ceil((a1 - a0) / (Math.PI / 12));
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(V(c.x + RING_R * Math.cos(a), c.z - RING_R * Math.sin(a)));
    }
    pts.push(exit);
    return pts;
  }

  if (inDir === outDir) return [entry, exit];

  if (outDir === OPP[inDir]) {
    // розворот у тупику: півколо навколо центру клітинки
    const pts = [entry];
    for (let i = 0; i <= 8; i++) {
      const f = (i / 8) * Math.PI;
      pts.push(V(c.x + irx * LANE * Math.cos(f) + ix * LANE * Math.sin(f), c.z + irz * LANE * Math.cos(f) + iz * LANE * Math.sin(f)));
    }
    pts.push(exit);
    return pts;
  }

  // поворот: дуга навколо кута між стороною в'їзду і стороною виїзду
  const turn = relTurn(inDir, outDir);
  const px = c.x + ((ox - ix) * TILE) / 2;
  const pz = c.z + ((oz - iz) * TILE) / 2;
  const rad = TILE / 2 + (turn === 'right' ? -LANE : LANE);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const f = (i / 8) * (Math.PI / 2);
    pts.push(V(px + rad * (-ox * Math.cos(f) + ix * Math.sin(f)), pz + rad * (-oz * Math.cos(f) + iz * Math.sin(f))));
  }
  return pts;
}

/** Довжина ламаної. */
export function pathLength(pts: THREE.Vector3[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]);
  return L;
}

/** Точка й напрямок на відстані s від початку ламаної. */
export function pointAt(pts: THREE.Vector3[], s: number) {
  for (let i = 1; i < pts.length; i++) {
    const seg = pts[i].distanceTo(pts[i - 1]);
    if (s <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, s / seg) : 0;
      const pos = pts[i - 1].clone().lerp(pts[i], t);
      const dir = pts[i].clone().sub(pts[i - 1]).normalize();
      return { pos, dir };
    }
    s -= seg;
  }
  return { pos: pts[0].clone(), dir: new THREE.Vector3(0, 0, -1) };
}

/** Номер з'їзду з рондо (1 — перший праворуч). */
export function rondoExit(grid: RoadGrid, cell: Cell, inDir: Dir, outDir: Dir) {
  const entrySide = OPP[inDir];
  const base = SIDE_ANGLE[entrySide];
  const angle = (d: Dir) => {
    let a = SIDE_ANGLE[d] - base;
    while (a <= 0) a += Math.PI * 2;
    return a;
  };
  const n = grid.neighbors(cell[0], cell[1]);
  const exits = (['N', 'E', 'S', 'W'] as Dir[]).filter((d) => n[d] && d !== entrySide);
  exits.sort((a, b) => angle(a) - angle(b));
  const k = exits.indexOf(outDir);
  return k >= 0 ? k + 1 : exits.length + 1; // розворот — останній «з'їзд»
}

/**
 * Найкоротший маршрут від клітинки from (рух у напрямку heading) до клітинки to.
 * Розворот дозволено лише в тупику; якщо шляху немає — дозволяємо розворот на старті.
 */
export function findRoute(grid: RoadGrid, from: Cell, heading: Dir, to: Cell): Cell[] | null {
  const search = (allowStartUturn: boolean) => {
    const key = (c: Cell, d: Dir) => `${c[0]},${c[1]},${d}`;
    const prev = new Map<string, string | null>();
    const cells = new Map<string, Cell>();
    const queue: [Cell, Dir][] = [[from, heading]];
    prev.set(key(from, heading), null);
    cells.set(key(from, heading), from);
    while (queue.length) {
      const [cell, d] = queue.shift()!;
      const k = key(cell, d);
      if (cell[0] === to[0] && cell[1] === to[1]) {
        const out: Cell[] = [];
        let cur: string | null = k;
        while (cur) {
          out.unshift(cells.get(cur)!);
          cur = prev.get(cur)!;
        }
        return out;
      }
      const exits = grid.exits(cell[0], cell[1]);
      const isStart = cell === from;
      let options = exits.filter((x) => x !== OPP[d] || (isStart && allowStartUturn));
      if (!options.length) options = exits;
      for (const x of options) {
        const [dx, dz] = DIR_VEC[x];
        const next: Cell = [cell[0] + dx, cell[1] + dz];
        const nk = key(next, x);
        if (prev.has(nk)) continue;
        prev.set(nk, k);
        cells.set(nk, next);
        queue.push([next, x]);
      }
    }
    return null;
  };
  return search(false) ?? search(true);
}
