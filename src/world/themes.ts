import * as THREE from 'three';
import type { Dir, Landmark, Level, Theme } from '../types';
import { TILE, type RoadGrid } from './build';
import { BOX, Batch } from './models';

/** Кольори місцевості: небо, земля, тротуар (у населеному пункті) і узбіччя (поза ним). */
export interface ThemeLook {
  sky: number;
  fogNear: number;
  fogFar: number;
  ground: number;
  sidewalk: number;
  shoulder: number;
  curb: number;
  asphalt: number;
}

export const THEME_LOOK: Record<Theme, ThemeLook> = {
  desert: { sky: 0xf0dcb6, fogNear: 120, fogFar: 340, ground: 0xe2c592, sidewalk: 0xeedcbc, shoulder: 0xd9bd8a, curb: 0xc9ab80, asphalt: 0x6e6259 },
  euro: { sky: 0xcbe0ee, fogNear: 100, fogFar: 300, ground: 0x8db86c, sidewalk: 0xd8d4cc, shoulder: 0x8aa865, curb: 0xa9a49b, asphalt: 0x56595f },
  taiga: { sky: 0xc6d7d1, fogNear: 70, fogFar: 270, ground: 0x557546, sidewalk: 0xb9b2a4, shoulder: 0x6b8a53, curb: 0xa9a393, asphalt: 0x5c5853 },
  village: { sky: 0xcfe6f3, fogNear: 110, fogFar: 330, ground: 0x8fb36a, sidewalk: 0xd6cfc2, shoulder: 0x8aa865, curb: 0xc9c2b2, asphalt: 0x66605a },
  mountain: { sky: 0xdbe7f1, fogNear: 140, fogFar: 560, ground: 0xeef3f7, sidewalk: 0xe4eaef, shoulder: 0xe8eef2, curb: 0xc9d1d8, asphalt: 0x6f6a66 },
  coast: { sky: 0xbfe1f2, fogNear: 120, fogFar: 360, ground: 0x9cbf74, sidewalk: 0xe9e2d4, shoulder: 0xd9cba4, curb: 0xc4baa6, asphalt: 0x5f5e60 },
};

/** Чи клітинка в забудові: усе місто або населений пункт (зона зі знаком D-42). */
export function urbanAt(level: Level, c: number, r: number) {
  if ((level.scenery ?? 'city') === 'city') return true;
  return (level.zones ?? []).some((z) => z.sign === 'D-42' && c >= z.from[0] && c <= z.to[0] && r >= z.from[1] && r <= z.to[1]);
}

// ------------------------------------------------------------------ примітиви (основа — на y = 0)

/** Двосхилий дах: трикутник шириною 1 і висотою 1, гребінь уздовж Z. */
const GABLE = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.5, 0);
  sh.lineTo(0.5, 0);
  sh.lineTo(0, 1);
  sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
})();
const CONE = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
const BALL = new THREE.IcosahedronGeometry(1, 1);
const PYR = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const DOME = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
const WHITE = new THREE.MeshLambertMaterial({ color: 0xffffff });
const WHITE_FLAT = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

/** Набори однакових примітивів для всієї місцевості (колір — на кожен екземпляр). */
class Kit {
  solid = new Batch(BOX, WHITE, true, true);
  flat = new Batch(BOX, WHITE, false, true);
  gable = new Batch(GABLE, WHITE, true, true);
  cone = new Batch(CONE, WHITE_FLAT, true, true);
  cyl = new Batch(CYL, WHITE, true, true);
  ball = new Batch(BALL, WHITE_FLAT, true, true);
  pyr = new Batch(PYR, WHITE, true, true);
  dome = new Batch(DOME, WHITE, true, true);
  all() {
    return [this.solid, this.flat, this.gable, this.cone, this.cyl, this.ball, this.pyr, this.dome];
  }
}

const pick = <T>(rand: () => number, list: T[]) => list[Math.floor(rand() * list.length)];

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  wall: number;
  /** колір даху; без нього — плаский дах із карнизом */
  roof?: number;
  roofH?: number;
  /** гребінь даху вздовж X (інакше — вздовж Z) */
  ridgeX?: boolean;
  /** чотирисхилий (шатровий) дах */
  hip?: boolean;
  /** фасади з вікнами */
  face?: Dir[];
  win?: number;
  frame?: number;
  floorH?: number;
  door?: number;
}

// ------------------------------------------------------------------ дрібні будівельні блоки

function building(k: Kit, b: Building) {
  const { x, z, w, d, h } = b;
  k.solid.add(x, h / 2, z, w, h, d, 0, b.wall);
  if (b.roof !== undefined && b.hip) {
    const s = Math.max(w, d) + 0.8;
    k.pyr.add(x, h, z, s * Math.SQRT2 * (w / Math.max(w, d)), b.roofH ?? 3, s * Math.SQRT2 * (d / Math.max(w, d)), 0, b.roof);
  } else if (b.roof !== undefined) {
    if (b.ridgeX) k.gable.add(x, h, z, d + 0.8, b.roofH ?? 3, w + 0.6, Math.PI / 2, b.roof);
    else k.gable.add(x, h, z, w + 0.8, b.roofH ?? 3, d + 0.6, 0, b.roof);
  } else {
    k.solid.add(x, h + 0.15, z, w + 0.3, 0.3, d + 0.3, 0, shade(b.wall, 1.08));
  }
  const fh = b.floorH ?? 3.1;
  const floors = Math.max(1, Math.floor((h - 0.6) / fh));
  const win = b.win ?? 0x41505e;
  for (const f of b.face ?? []) {
    const alongX = f === 'N' || f === 'S';
    const len = alongX ? w : d;
    const n = Math.max(1, Math.floor(len / 2.8));
    const off = (alongX ? d : w) / 2 + 0.05;
    const [fx, fz] = f === 'N' ? [0, -off] : f === 'S' ? [0, off] : f === 'W' ? [-off, 0] : [off, 0];
    for (let fl = 0; fl < floors; fl++) {
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + (len / n) * (i + 0.5);
        const px = x + fx + (alongX ? t : 0);
        const pz = z + fz + (alongX ? 0 : t);
        const door = fl === 0 && b.door !== undefined && i === Math.floor(n / 2);
        const ww = door ? 1.3 : 1.05, wh = door ? 2.2 : 1.35, wy = door ? 1.1 : 1.75 + fl * fh;
        if (b.frame !== undefined && !door) k.flat.add(px, wy, pz, alongX ? ww + 0.3 : 0.1, wh + 0.3, alongX ? 0.1 : ww + 0.3, 0, b.frame);
        const nudge = 0.04;
        k.flat.add(px + fx * nudge, wy, pz + fz * nudge, alongX ? ww : 0.12, wh, alongX ? 0.12 : ww, 0, door ? b.door! : win);
      }
    }
  }
}

function shade(color: number, f: number) {
  const c = new THREE.Color(color);
  c.r = Math.min(1, c.r * f);
  c.g = Math.min(1, c.g * f);
  c.b = Math.min(1, c.b * f);
  return c.getHex();
}

function tile(k: Kit, x0: number, z0: number, color: number, inset = 0) {
  k.flat.add(x0 + TILE / 2, 0.02, z0 + TILE / 2, TILE - inset * 2, 0.04, TILE - inset * 2, 0, color);
}

function tree(k: Kit, x: number, z: number, s: number, leaf: number, trunk = 0x7a5236) {
  k.cyl.add(x, 0, z, 0.22 * s, 1.9 * s, 0.22 * s, 0, trunk);
  k.ball.add(x, 2.5 * s, z, 1.35 * s, 1.45 * s, 1.35 * s, x * 0.7, leaf);
}

function conifer(k: Kit, x: number, z: number, h: number, leaf: number, snow = false) {
  k.cyl.add(x, 0, z, 0.22 + h * 0.012, h * 0.3, 0.22 + h * 0.012, 0, 0x5b4030);
  const layers: [number, number, number][] = [[0.18, 0.34, 0.45], [0.4, 0.26, 0.38], [0.6, 0.17, 0.4]];
  layers.forEach(([y, r, hh], i) => {
    const rot = x + i;
    k.cone.add(x, h * y, z, h * r, h * hh, h * r, rot, i === 1 ? shade(leaf, 1.08) : leaf);
    if (snow) k.cone.add(x, h * (y + hh * 0.55), z, h * r * 0.47, h * hh * 0.47, h * r * 0.47, rot, 0xf4f7fa);
  });
}

function birch(k: Kit, x: number, z: number, s: number, leaf: number) {
  k.cyl.add(x, 0, z, 0.16 * s, 3.2 * s, 0.16 * s, 0, 0xeeeae2);
  k.flat.add(x, 1.4 * s, z, 0.34 * s, 0.12, 0.34 * s, 0, 0x2a2a2a);
  k.ball.add(x, 3.6 * s, z, 1.1 * s, 1.7 * s, 1.1 * s, x, leaf);
}

function pine(k: Kit, x: number, z: number, h: number) {
  k.cyl.add(x, 0, z, 0.2 + h * 0.01, h * 0.8, 0.2 + h * 0.01, 0, 0x9a5b3a);
  k.ball.add(x, h * 0.82, z, h * 0.28, h * 0.13, h * 0.28, x, 0x3f6b3a);
  k.ball.add(x + h * 0.08, h * 0.95, z - h * 0.05, h * 0.2, h * 0.1, h * 0.2, z, 0x4a7a42);
}

function palm(k: Kit, x: number, z: number, h: number, rand: () => number) {
  k.cyl.add(x, 0, z, 0.24, h, 0.24, 0, 0x8a6a48);
  k.ball.add(x, h, z, 0.45, 0.4, 0.45, 0, 0x5b7a34);
  const n = 7;
  const a0 = rand() * Math.PI;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const len = 3.2 + rand() * 0.8;
    const out = len * 0.42;
    k.flat.add(x + Math.sin(a) * out, h - 0.35, z + Math.cos(a) * out, 0.6, 0.08, len, a, i % 2 ? 0x4f9a3c : 0x5fa848, 0.45);
  }
}

function cactus(k: Kit, x: number, z: number, h: number, rand: () => number) {
  const col = 0x5e8f46;
  k.cyl.add(x, 0, z, 0.34, h, 0.34, 0, col);
  k.ball.add(x, h, z, 0.34, 0.3, 0.34, 0, col);
  for (const side of [-1, 1]) {
    if (rand() < 0.35) continue;
    const y = h * (0.35 + rand() * 0.2);
    const len = 0.8 + rand() * 0.3;
    k.cyl.add(x, y, z, 0.22, len, 0.22, 0, col, 0, side * -Math.PI / 2);
    k.cyl.add(x + side * len, y - 0.1, z, 0.22, h * 0.35, 0.22, 0, col);
    k.ball.add(x + side * len, y - 0.1 + h * 0.35, z, 0.22, 0.2, 0.22, 0, col);
  }
}

function rock(k: Kit, x: number, z: number, s: number, color: number, snow = false) {
  k.ball.add(x, s * 0.25, z, s, s * 0.7, s * 0.85, x * 1.3, color);
  if (snow) k.ball.add(x, s * 0.55, z, s * 0.75, s * 0.32, s * 0.65, x * 1.3, 0xf2f5f8);
}

function fenceAlong(k: Kit, x0: number, z0: number, side: Dir, color: number, from = 0.6, to = TILE - 0.6) {
  const inset = 0.5;
  const alongX = side === 'N' || side === 'S';
  const fixed = side === 'N' ? z0 + inset : side === 'S' ? z0 + TILE - inset : side === 'W' ? x0 + inset : x0 + TILE - inset;
  const base = alongX ? x0 : z0;
  const len = to - from;
  const mid = base + (from + to) / 2;
  const at = (t: number, y: number, sx: number, sy: number, sz: number) =>
    alongX ? k.flat.add(t, y, fixed, sx, sy, sz, 0, color) : k.flat.add(fixed, y, t, sz, sy, sx, 0, color);
  at(mid, 0.75, len, 0.12, 0.08);
  at(mid, 0.4, len, 0.12, 0.08);
  for (let t = from; t <= to + 0.01; t += 1.6) at(base + t, 0.5, 0.12, 1.0, 0.12);
}

/** Бік клітинки, що дивиться на дорогу. */
function roadSides(grid: RoadGrid, c: number, r: number): Dir[] {
  const out: Dir[] = [];
  if (grid.isRoad(c, r - 1)) out.push('N');
  if (grid.isRoad(c, r + 1)) out.push('S');
  if (grid.isRoad(c - 1, r)) out.push('W');
  if (grid.isRoad(c + 1, r)) out.push('E');
  return out;
}

/**
 * Ділянки вздовж доріг: для кожного боку клітинки, що виходить на дорогу, — смуга завглибшки depth;
 * поперечні смуги коротші там, де вже стоять поздовжні (на розі не перетинаються).
 */
function frontage(x0: number, z0: number, sides: Dir[], depth: number, setback: number) {
  return sides.map((side) => {
    const alongX = side === 'N' || side === 'S';
    let a = 0, b = TILE;
    if (!alongX) {
      if (sides.includes('N')) a = depth + setback;
      if (sides.includes('S')) b = TILE - depth - setback;
    }
    const mid = side === 'N' ? z0 + setback + depth / 2 : side === 'S' ? z0 + TILE - setback - depth / 2
      : side === 'W' ? x0 + setback + depth / 2 : x0 + TILE - setback - depth / 2;
    return { side, alongX, a, b, mid };
  });
}

// ------------------------------------------------------------------ теми

interface CellCtx {
  k: Kit;
  rand: () => number;
  c: number;
  r: number;
  x0: number;
  z0: number;
  sides: Dir[];
  inMap: boolean;
  urban: boolean;
  /** відстань (у клітинках) до найближчої води: 1 — поруч */
  water: number;
  snow: boolean;
}

/** Ряд кам'яниць уздовж вулиці: вузькі будинки різної висоти й кольору, двосхилі дахи, вітрини. */
function euroCell(p: CellCtx) {
  const { k, rand, x0, z0 } = p;
  const walls = [0xf2d58c, 0xe9b4a4, 0xbfd8c4, 0xb9cde3, 0xf4ead6, 0xe6c49a, 0xd99a7a, 0xcfc3e0, 0xf0e1b0];
  const roofs = [0xa8432f, 0x8f3b2b, 0x6b4235, 0x5a5f66, 0xb5543a];
  tile(k, x0, z0, 0xbdb3a5);
  if (p.water <= 1) {
    // набережна: липи й лавки над водою
    for (const t of [4, 16]) tree(k, x0 + 10, z0 + t, 1.1, pick(rand, [0x6a9c57, 0x7fb069]));
    k.solid.add(x0 + 10, 0.45, z0 + 10, 0.6, 0.12, 2, 0, 0x8a5a3a);
    return;
  }
  if (!p.sides.length) {
    if (p.inMap) return parkCell(p, 0x86b86a);
    // за межами карти — суцільна забудова
    const h = 12 + Math.floor(rand() * 3) * 3;
    building(k, { x: x0 + 10, z: z0 + 10, w: 17, d: 17, h, wall: pick(rand, walls), roof: pick(rand, roofs), roofH: 4, ridgeX: rand() < 0.5 });
    return;
  }
  const D = 8.5;
  for (const f of frontage(x0, z0, p.sides, D, 0.3)) {
    let t = f.a;
    while (f.b - t > 4.5) {
      const w = Math.min(f.b - t, f.b - t < 11 ? f.b - t : 5.5 + rand() * 2);
      const floors = 3 + Math.floor(rand() * 3);
      const h = floors * 3.1 + 0.8;
      const c = t + w / 2;
      const x = f.alongX ? x0 + c : f.mid;
      const z = f.alongX ? f.mid : z0 + c;
      const wall = pick(rand, walls);
      building(k, {
        x, z, w: f.alongX ? w - 0.1 : D, d: f.alongX ? D : w - 0.1, h, wall,
        roof: pick(rand, roofs), roofH: 3.4, ridgeX: f.alongX, face: [f.side], win: 0x3e4c5a, frame: 0xf7f3ea, door: 0x5a3a2a,
      });
      // карниз між поверхами і інколи маркіза над вітриною
      if (rand() < 0.35) {
        const [ox, oz] = f.side === 'N' ? [0, -1] : f.side === 'S' ? [0, 1] : f.side === 'W' ? [-1, 0] : [1, 0];
        const off = D / 2 + 0.7;
        k.flat.add(x + ox * off, 3.0, z + oz * off, f.alongX ? w * 0.7 : 1.4, 0.08, f.alongX ? 1.4 : w * 0.7, f.alongX ? 0 : Math.PI / 2,
          pick(rand, [0x2f6f4f, 0xb03a3a, 0x2f5f9f, 0xd08a2a]), f.side === 'N' || f.side === 'E' ? -0.3 : 0.3);
      }
      if (rand() < 0.3) k.solid.add(x + (rand() - 0.5) * 2, h + 2.2, z + (rand() - 0.5) * 2, 0.7, 2.2, 0.7, 0, 0x8a5a48);
      t += w;
    }
  }
  // подвір'я: дерево, якщо вулиці не з усіх боків
  if (p.sides.length <= 2 && rand() < 0.7) tree(k, x0 + 10 + (rand() - 0.5) * 3, z0 + 10 + (rand() - 0.5) * 3, 1.1, pick(rand, [0x6a9c57, 0x7fb069]));
}

function parkCell(p: CellCtx, grass: number) {
  const { k, rand, x0, z0 } = p;
  tile(k, x0, z0, grass, 0.01);
  k.flat.add(x0 + 10, 0.05, z0 + 10, 2, 0.04, TILE, 0, 0xd8cdb6);
  k.flat.add(x0 + 10, 0.05, z0 + 10, TILE, 0.04, 2, 0, 0xd8cdb6);
  for (const [qx, qz] of [[5, 5], [15, 5], [5, 15], [15, 15]]) {
    if (rand() < 0.85) tree(k, x0 + qx + (rand() - 0.5) * 3, z0 + qz + (rand() - 0.5) * 3, 1 + rand() * 0.4, pick(rand, [0x6a9c57, 0x7fb069, 0x5f9450]));
  }
  k.solid.add(x0 + 12.5, 0.45, z0 + 7.5, 2, 0.12, 0.6, 0, 0x8a5a3a);
  k.solid.add(x0 + 7.5, 0.45, z0 + 12.5, 0.6, 0.12, 2, 0, 0x8a5a3a);
}

/** Пустеля: глинобитні будинки з пласкими дахами й куполами, пальми; за містом — дюни й кактуси. */
function desertCell(p: CellCtx) {
  const { k, rand, x0, z0 } = p;
  if (p.water <= 1) {
    // оаза: трава й пальми навколо води
    tile(k, x0, z0, 0x9cbf6a);
    for (let i = 0; i < 3; i++) palm(k, x0 + 3 + rand() * 14, z0 + 3 + rand() * 14, 6 + rand() * 3, rand);
    for (let i = 0; i < 3; i++) k.cone.add(x0 + rand() * 20, 0, z0 + rand() * 20, 0.5, 1.4, 0.5, 0, 0x6f9a4a);
    return;
  }
  if (p.urban) {
    tile(k, x0, z0, 0xe9d5ad);
    const walls = [0xe8d3ad, 0xdcbf94, 0xf2e6cf, 0xd2a77c, 0xe6c9a0, 0xc98f62, 0xf5efe3];
    const sides = p.sides.length ? p.sides : (['N'] as Dir[]);
    const lots = frontage(x0, z0, sides.slice(0, 2), 9, 0.6);
    for (const f of lots) {
      const len = f.b - f.a;
      const n = len > 15 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const w = len / n - 1.2;
        const c = f.a + (len / n) * (i + 0.5);
        const x = f.alongX ? x0 + c : f.mid, z = f.alongX ? f.mid : z0 + c;
        const h = rand() < 0.5 ? 3.6 : 6.7;
        const wall = pick(rand, walls);
        building(k, {
          x, z, w: f.alongX ? w : 9, d: f.alongX ? 9 : w, h, wall, face: p.sides.length ? [f.side] : [], win: 0x3a3330, door: 0x6b4a2e,
        });
        if (rand() < 0.3) k.dome.add(x, h + 0.3, z, 2.4, 2.2, 2.4, 0, pick(rand, [0xf4f1ea, 0x3d8fa8, 0xd9b26a]));
        else if (rand() < 0.4) building(k, { x: x + (rand() - 0.5) * 2, z: z + (rand() - 0.5) * 2, w: 4, d: 4, h: h + 2.8, wall: shade(wall, 0.95) });
        if (rand() < 0.4) k.cyl.add(x + 2, h + 0.3, z - 2, 0.7, 1.2, 0.7, 0, 0xdedad2);
      }
    }
    if (p.sides.length <= 2 && rand() < 0.6) palm(k, x0 + 10 + (rand() - 0.5) * 4, z0 + 10 + (rand() - 0.5) * 4, 6 + rand() * 2, rand);
    return;
  }
  tile(k, x0, z0, pick(rand, [0xe3c896, 0xe8cfa0, 0xdcbf8a, 0xe6cb98]));
  const roll = rand();
  if (roll < 0.4) {
    // дюна: біля дороги — невелика, щоб не залазила на узбіччя
    const big = !p.sides.length;
    const sx = big ? 7 + rand() * 4 : 4 + rand() * 2.5, sz = big ? 5 + rand() * 4 : 3.5 + rand() * 2.5;
    const off = big ? 4 : 1;
    k.ball.add(x0 + 10 + (rand() - 0.5) * off, -0.6, z0 + 10 + (rand() - 0.5) * off, sx, big ? 2 + rand() * 2.5 : 1.4 + rand(), sz, rand() * 3, pick(rand, [0xe7cb95, 0xdcbd85, 0xedd5a5]));
  }
  if (rand() < 0.45) cactus(k, x0 + 3 + rand() * 14, z0 + 3 + rand() * 14, 2.6 + rand() * 2.2, rand);
  if (rand() < 0.25) cactus(k, x0 + 3 + rand() * 14, z0 + 3 + rand() * 14, 1.8 + rand() * 1.5, rand);
  if (rand() < 0.35) rock(k, x0 + rand() * 20, z0 + rand() * 20, 0.8 + rand() * 1.6, pick(rand, [0xb98a62, 0xa77a55, 0xc7a07a]));
  if (rand() < 0.5) k.ball.add(x0 + rand() * 20, 0.3, z0 + rand() * 20, 0.6, 0.45, 0.6, 0, pick(rand, [0x9a9a5a, 0x8c8a52]));
}

/** Тайга: ялини й берези, мох, камені; у селищі — зрубні хати з парканами. */
function taigaCell(p: CellCtx) {
  const { k, rand, x0, z0 } = p;
  const greens = [0x2f5a3a, 0x37663f, 0x2a4f35, 0x406b44];
  if (p.water <= 1) {
    tile(k, x0, z0, 0xa9a184);
    for (let i = 0; i < 5; i++) k.cone.add(x0 + rand() * 20, 0, z0 + rand() * 20, 0.25, 1.3, 0.25, 0, 0x7d8f4a);
    if (rand() < 0.5) rock(k, x0 + rand() * 20, z0 + rand() * 20, 1 + rand(), 0x8a8a84);
    if (rand() < 0.6) conifer(k, x0 + 4 + rand() * 12, z0 + 4 + rand() * 12, 9 + rand() * 4, pick(rand, greens));
    return;
  }
  if (p.urban) {
    tile(k, x0, z0, 0x6f9055);
    const logs = [0x7a5232, 0x8b5e3c, 0x6e4a2e, 0x94693f];
    const roofs = [0x3f4a3f, 0x5a3a2a, 0x4a5560, 0x6b3a2a];
    for (const f of frontage(x0, z0, p.sides.slice(0, 2), 7, 3)) {
      const c = (f.a + f.b) / 2;
      const len = Math.min(9, f.b - f.a - 2);
      if (len < 5) continue;
      const x = f.alongX ? x0 + c : f.mid, z = f.alongX ? f.mid : z0 + c;
      const wall = pick(rand, logs);
      const w = f.alongX ? len : 6.5, d = f.alongX ? 6.5 : len;
      building(k, { x, z, w, d, h: 3.4, wall, roof: pick(rand, roofs), roofH: 2.8, ridgeX: f.alongX, face: [f.side], win: 0x3a4a55, frame: 0xf2efe6, door: 0x4a3020 });
      // вінці зрубу
      for (let i = 0; i < 4; i++) k.flat.add(x, 0.5 + i * 0.8, z, w + 0.12, 0.1, d + 0.12, 0, shade(wall, 0.75));
      k.solid.add(x + (f.alongX ? len / 3 : 1), 4.8, z + (f.alongX ? 1 : len / 3), 0.7, 2.2, 0.7, 0, 0x6f6a64);
      fenceAlong(k, x0, z0, f.side, 0x8a6a48);
      k.solid.add(x + (f.alongX ? -len / 2 - 1.5 : 2.5), 0.6, z + (f.alongX ? 2.5 : -len / 2 - 1.5), 1.2, 1.2, 2.4, 0, 0x9a7048);
    }
    for (let i = 0; i < 2; i++) conifer(k, x0 + 4 + rand() * 12, z0 + 4 + rand() * 12, 10 + rand() * 5, pick(rand, greens));
    return;
  }
  tile(k, x0, z0, pick(rand, [0x55774a, 0x5d7f4e, 0x4f6e44, 0x587a47]));
  const n = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const x = x0 + 2 + rand() * 16, z = z0 + 2 + rand() * 16;
    if (rand() < 0.14) birch(k, x, z, 1 + rand() * 0.4, pick(rand, [0x8fbf5a, 0x9ccc62, 0x86b551]));
    else conifer(k, x, z, 9 + rand() * 8, pick(rand, greens));
  }
  if (rand() < 0.3) rock(k, x0 + rand() * 20, z0 + rand() * 20, 0.9 + rand() * 1.4, pick(rand, [0x7d7f78, 0x8b8c84, 0x6f7a62]));
  for (let i = 0; i < 3; i++) k.cone.add(x0 + rand() * 20, 0, z0 + rand() * 20, 0.7, 0.8, 0.7, rand() * 3, 0x6f9a4a);
}

/** Село: хати з садами й парканами, стодоли; навколо — поля, сінники, сади, корови. */
function villageCell(p: CellCtx) {
  const { k, rand, x0, z0 } = p;
  if (p.water <= 1) {
    tile(k, x0, z0, 0x86b05e);
    for (let i = 0; i < 4; i++) k.cone.add(x0 + rand() * 20, 0, z0 + rand() * 20, 0.3, 1.4, 0.3, 0, 0x7d9a4a);
    if (rand() < 0.6) tree(k, x0 + 4 + rand() * 12, z0 + 4 + rand() * 12, 1.3, 0x7fa860);
    return;
  }
  if (p.urban) {
    tile(k, x0, z0, 0x8fbf6a);
    const walls = [0xf3ead8, 0xe9dcb8, 0xf2e2a8, 0xe8e2d6, 0xd9c49a];
    const roofs = [0xb04a32, 0x8f4030, 0x6b4a3a, 0x55585c, 0xa0522d];
    const lots = frontage(x0, z0, p.sides.slice(0, 1), 8, 2.5);
    for (const f of lots) {
      const c = (f.a + f.b) / 2;
      const x = f.alongX ? x0 + c : f.mid, z = f.alongX ? f.mid : z0 + c;
      const w = f.alongX ? 9.5 : 8, d = f.alongX ? 8 : 9.5;
      building(k, { x, z, w, d, h: rand() < 0.4 ? 6.6 : 3.6, wall: pick(rand, walls), roof: pick(rand, roofs), roofH: 3.6, ridgeX: f.alongX, face: [f.side], win: 0x3a4a5a, frame: 0xf7f3ea, door: 0x6a4026 });
      if (rand() < 0.6) k.solid.add(x + 2, 7.4, z + 1, 0.7, 2, 0.7, 0, 0x8a5a48);
      fenceAlong(k, x0, z0, f.side, rand() < 0.5 ? 0xf2efe6 : 0x8a6a48);
      // стодола або город позаду хати
      const [bx, bz] = f.side === 'N' ? [x, z0 + 16] : f.side === 'S' ? [x, z0 + 4] : f.side === 'W' ? [x0 + 16, z] : [x0 + 4, z];
      if (rand() < 0.55) {
        building(k, { x: bx, z: bz, w: f.alongX ? 9 : 6, d: f.alongX ? 6 : 9, h: 4.2, wall: pick(rand, [0x9c3b2e, 0x8a6440, 0x7a5a3a]), roof: 0x5a4a40, roofH: 3, ridgeX: f.alongX });
      } else {
        k.flat.add(bx, 0.05, bz, f.alongX ? 12 : 6, 0.05, f.alongX ? 6 : 12, 0, 0x7a5a3a);
        for (let i = -2; i <= 2; i++) {
          k.flat.add(bx + (f.alongX ? i * 2.2 : 0), 0.15, bz + (f.alongX ? 0 : i * 2.2), f.alongX ? 0.6 : 5, 0.2, f.alongX ? 5 : 0.6, 0, 0x5f9a3a);
        }
      }
    }
    if (!p.sides.length) for (let i = 0; i < 4; i++) tree(k, x0 + 3 + rand() * 14, z0 + 3 + rand() * 14, 0.9, pick(rand, [0x6a9c57, 0x7fb069]));
    else if (rand() < 0.6) tree(k, x0 + 3 + rand() * 14, z0 + 3 + rand() * 14, 0.9, 0x6f9f50);
    return;
  }
  const roll = rand();
  if (roll < 0.62) {
    // поле: смуги посівів
    const crop = pick(rand, [0xd8c46a, 0x9cc27a, 0xc9b25a, 0x86b05e, 0x9a7a52, 0xb7c97a]);
    tile(k, x0, z0, crop);
    const alongX = rand() < 0.5;
    for (let i = 0; i < 6; i++) {
      const o = -8.3 + i * 3.3;
      k.flat.add(x0 + 10 + (alongX ? 0 : o), 0.06, z0 + 10 + (alongX ? o : 0), alongX ? 19 : 1.1, 0.04, alongX ? 1.1 : 19, 0, shade(crop, 0.85));
    }
    if (crop === 0xd8c46a || crop === 0xc9b25a) {
      for (let i = 0; i < 3; i++) if (rand() < 0.6) k.cyl.add(x0 + 4 + rand() * 12 + 0.8, 0.75, z0 + 4 + rand() * 12, 0.75, 1.6, 0.75, rand() * 3, 0xe0c46a, 0, Math.PI / 2);
    }
  } else if (roll < 0.74) {
    // сад
    tile(k, x0, z0, 0x8fbf6a);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tree(k, x0 + 4 + i * 6, z0 + 4 + j * 6, 0.65, pick(rand, [0x6f9f50, 0x7aab55]));
  } else if (roll < 0.84) {
    // пасовище з коровами
    tile(k, x0, z0, 0x97c472);
    for (let i = 0; i < 2 + Math.floor(rand() * 2); i++) cow(k, x0 + 4 + rand() * 12, z0 + 4 + rand() * 12, rand() * 6, rand);
  } else {
    tile(k, x0, z0, 0x8fb36a);
    for (let i = 0; i < 3; i++) tree(k, x0 + 3 + rand() * 14, z0 + 3 + rand() * 14, 1 + rand() * 0.5, pick(rand, [0x6a9c57, 0x7fb069, 0x5f9450]));
  }
}

function cow(k: Kit, x: number, z: number, ry: number, rand: () => number) {
  const body = rand() < 0.5 ? 0xf4f1ea : 0x8a5a3a;
  const sx = Math.sin(ry), sz = Math.cos(ry);
  k.solid.add(x, 1.05, z, 0.8, 0.75, 1.7, ry, body);
  k.flat.add(x, 1.1, z, 0.82, 0.4, 0.6, ry, 0x2a2622);
  k.solid.add(x + sx * 1.0, 1.25, z + sz * 1.0, 0.5, 0.5, 0.55, ry, body);
  for (const [lx, lz] of [[-0.28, -0.6], [0.28, -0.6], [-0.28, 0.6], [0.28, 0.6]]) {
    const wx = x + lx * Math.cos(ry) + lz * Math.sin(ry), wz = z - lx * Math.sin(ry) + lz * Math.cos(ry);
    k.flat.add(wx, 0.35, wz, 0.18, 0.7, 0.18, ry, 0x3a3430);
  }
}

/** Гори взимку: шале з засніженими дахами, ялини під снігом, скелі. */
function mountainCell(p: CellCtx) {
  const { k, rand, x0, z0 } = p;
  const greens = [0x2f5040, 0x35584a, 0x2a4a3a];
  if (p.urban) {
    tile(k, x0, z0, 0xf2f6f9);
    for (const f of frontage(x0, z0, p.sides.slice(0, 2), 8, 1.5)) {
      const c = (f.a + f.b) / 2;
      const len = Math.min(10, f.b - f.a - 2);
      if (len < 5) continue;
      const x = f.alongX ? x0 + c : f.mid, z = f.alongX ? f.mid : z0 + c;
      const w = f.alongX ? len : 8, d = f.alongX ? 8 : len;
      const hotel = rand() < 0.3;
      k.solid.add(x, 1.3, z, w + 0.2, 2.6, d + 0.2, 0, 0x8d8a86);
      building(k, {
        x, z, w, d, h: hotel ? 9.5 : 6.2, wall: pick(rand, [0x8b5a3a, 0x9a6a44, 0x7a4e32]), roof: 0xf4f7fa, roofH: 4.4, ridgeX: !f.alongX,
        face: [f.side], win: 0x3a4a5a, frame: 0xf2ece0, door: 0x4a3020,
      });
      // дерев'яний балкон на фасаді
      const [ox, oz] = f.side === 'N' ? [0, -d / 2 - 0.6] : f.side === 'S' ? [0, d / 2 + 0.6] : f.side === 'W' ? [-w / 2 - 0.6, 0] : [w / 2 + 0.6, 0];
      k.flat.add(x + ox, 3.6, z + oz, f.alongX ? w * 0.8 : 1.2, 0.9, f.alongX ? 1.2 : d * 0.8, 0, 0x6e4528);
    }
    for (let i = 0; i < 2; i++) conifer(k, x0 + 3 + rand() * 14, z0 + 3 + rand() * 14, 8 + rand() * 4, pick(rand, greens), true);
    if (rand() < 0.15) {
      const x = x0 + 4 + rand() * 12, z = z0 + 4 + rand() * 12;
      k.ball.add(x, 0.6, z, 0.75, 0.7, 0.75, 0, 0xffffff);
      k.ball.add(x, 1.55, z, 0.52, 0.5, 0.52, 0, 0xffffff);
      k.ball.add(x, 2.25, z, 0.36, 0.35, 0.36, 0, 0xffffff);
      k.cone.add(x, 2.2, z - 0.35, 0.07, 0.35, 0.07, 0, 0xe07a2a, Math.PI / 2);
    }
    return;
  }
  tile(k, x0, z0, pick(rand, [0xf2f6f9, 0xeaf0f4, 0xf6f9fb]));
  const roll = rand();
  if (roll < 0.12) {
    rock(k, x0 + 10, z0 + 10, 6 + rand() * 3, 0x7d8590, true);
    return;
  }
  const n = roll < 0.75 ? 2 + Math.floor(rand() * 4) : 0;
  for (let i = 0; i < n; i++) conifer(k, x0 + 2 + rand() * 16, z0 + 2 + rand() * 16, 8 + rand() * 7, pick(rand, greens), true);
  if (rand() < 0.3) rock(k, x0 + rand() * 20, z0 + rand() * 20, 1 + rand() * 1.8, 0x868d96, true);
}

/** Узбережжя: пляж із парасолями, дюни, сосни; курорт — вілли й готелі. */
function coastCell(p: CellCtx) {
  const { k, rand, x0, z0 } = p;
  if (p.water <= 2 && !(p.urban && p.water > 1)) {
    tile(k, x0, z0, p.water <= 1 ? 0xf0e2bc : 0xe6d7ab);
    if (p.water <= 1) {
      for (let i = 0; i < 3; i++) {
        if (rand() < 0.35) continue;
        const x = x0 + 3 + rand() * 14, z = z0 + 3 + rand() * 14;
        k.cyl.add(x, 0, z, 0.06, 2.3, 0.06, 0, 0xf4f4f4);
        k.cone.add(x, 2.0, z, 1.5, 0.55, 1.5, 0, pick(rand, [0xe84f4f, 0x3b82f6, 0xf5c542, 0x22a06b, 0xf08a3c]));
        k.flat.add(x + 1.6, 0.3, z, 0.8, 0.12, 2, 0, 0xf7f2e8);
      }
    } else {
      for (let i = 0; i < 6; i++) k.cone.add(x0 + rand() * 20, 0, z0 + rand() * 20, 0.6, 0.9, 0.6, rand() * 3, 0x9db36a);
      if (rand() < 0.5) pine(k, x0 + 4 + rand() * 12, z0 + 4 + rand() * 12, 9 + rand() * 4);
    }
    return;
  }
  if (p.urban) {
    tile(k, x0, z0, 0xe3dbc8);
    const walls = [0xf7f5f0, 0xf2e8d5, 0xe9f1f4, 0xf6e3d6, 0xe2efe6];
    const roofs = [0xc4673e, 0xb5543a, 0x4f6b8a, 0x8f4f3a];
    for (const f of frontage(x0, z0, p.sides.slice(0, 2), 9, 1)) {
      const len = f.b - f.a;
      const c = (f.a + f.b) / 2;
      const x = f.alongX ? x0 + c : f.mid, z = f.alongX ? f.mid : z0 + c;
      const hotel = rand() < 0.25 && len > 14;
      const w = f.alongX ? len - 3 : 9, d = f.alongX ? 9 : len - 3;
      if (w < 5 || d < 5) continue;
      if (hotel) {
        building(k, { x, z, w, d, h: 16, wall: 0xf7f7f4, face: [f.side], win: 0x4f8fb0, floorH: 3.1 });
      } else {
        building(k, { x, z, w, d, h: rand() < 0.5 ? 6.6 : 3.6, wall: pick(rand, walls), roof: pick(rand, roofs), roofH: 2.8, hip: rand() < 0.5, ridgeX: f.alongX, face: [f.side], win: 0x3f5f78, frame: 0xffffff, door: 0x6a4026 });
      }
    }
    if (rand() < 0.7) palm(k, x0 + 10 + (rand() - 0.5) * 6, z0 + 10 + (rand() - 0.5) * 6, 6 + rand() * 2.5, rand);
    return;
  }
  tile(k, x0, z0, pick(rand, [0x9cbf74, 0x93b86c, 0xa4c47c]));
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) pine(k, x0 + 2 + rand() * 16, z0 + 2 + rand() * 16, 9 + rand() * 5);
}

const CELL_DECOR: Record<Theme, (p: CellCtx) => void> = {
  desert: desertCell,
  euro: euroCell,
  taiga: taigaCell,
  village: villageCell,
  mountain: mountainCell,
  coast: coastCell,
};

// ------------------------------------------------------------------ приметні споруди

function landmark(kind: Landmark, p: CellCtx, face: Dir | undefined) {
  const { k, x0, z0 } = p;
  const cx = x0 + TILE / 2, cz = z0 + TILE / 2;
  const front: Dir = face ?? p.sides[0] ?? 'S';
  switch (kind) {
    case 'square':
      tile(k, x0, z0, 0xc9bfae);
      for (let i = 0; i < 4; i++) k.flat.add(cx, 0.05, z0 + 2.5 + i * 5, TILE, 0.03, 0.15, 0, 0xb3a894);
      for (const [qx, qz] of [[3, 3], [17, 3], [3, 17], [17, 17]]) tree(k, x0 + qx, z0 + qz, 0.9, 0x6a9c57);
      break;
    case 'townhall': {
      tile(k, x0, z0, 0xc9bfae);
      building(k, { x: cx, z: cz, w: 14, d: 11, h: 11, wall: 0xf1e2c0, roof: 0x7a3a2a, roofH: 5, ridgeX: true, face: ['N', 'S', 'E', 'W'], win: 0x3e4c5a, frame: 0xffffff });
      k.solid.add(cx, 14, cz, 4.2, 28, 4.2, 0, 0xe9d6ae);
      k.flat.add(cx, 24, cz - 2.15, 2.2, 2.2, 0.1, 0, 0xffffff);
      k.flat.add(cx, 24, cz + 2.15, 2.2, 2.2, 0.1, 0, 0xffffff);
      k.pyr.add(cx, 28, cz, 6.4, 9, 6.4, 0, 0x3f6f5a);
      break;
    }
    case 'church': {
      tile(k, x0, z0, p.urban ? 0xc9bfae : 0x8fbf6a);
      const alongX = front === 'E' || front === 'W';
      const t = 0x7a7f86;
      building(k, { x: cx, z: cz, w: alongX ? 15 : 8, d: alongX ? 8 : 15, h: 9, wall: p.snow ? 0xe8e2d6 : 0xe7dcc6, roof: 0x8f3b2b, roofH: 6, ridgeX: alongX, face: [], win: 0x3e4c5a });
      const [tx, tz] = front === 'N' ? [cx, cz - 6] : front === 'S' ? [cx, cz + 6] : front === 'W' ? [cx - 6, cz] : [cx + 6, cz];
      k.solid.add(tx, 9, tz, 4.4, 18, 4.4, 0, p.snow ? 0xece6da : 0xeee3cc);
      k.pyr.add(tx, 18, tz, 6.4, 10, 6.4, 0, p.snow ? 0x4a5560 : t);
      k.flat.add(tx, 28.6, tz, 0.15, 1.6, 0.15, 0, 0xd8b84a);
      k.flat.add(tx, 28.9, tz, 0.9, 0.15, 0.15, 0, 0xd8b84a);
      break;
    }
    case 'fountain':
      tile(k, x0, z0, 0xc9bfae);
      k.cyl.add(cx, 0, cz, 4, 0.7, 4, 0, 0xb8b0a2);
      k.cyl.add(cx, 0.05, cz, 3.6, 0.7, 3.6, 0, 0x5fa8d3);
      k.cyl.add(cx, 0, cz, 0.6, 2.6, 0.6, 0, 0xb8b0a2);
      k.cyl.add(cx, 2.4, cz, 1.4, 0.3, 1.4, 0, 0xb8b0a2);
      k.cone.add(cx, 2.7, cz, 0.6, 1.3, 0.6, 0, 0xbfe4f5);
      for (const [qx, qz] of [[3, 3], [17, 3], [3, 17], [17, 17]]) tree(k, x0 + qx, z0 + qz, 0.9, 0x6a9c57);
      break;
    case 'park':
      parkCell(p, 0x86b86a);
      break;
    case 'school': {
      tile(k, x0, z0, 0x8fbf6a);
      const alongX = front === 'N' || front === 'S';
      const off = 4.5;
      const [sx, sz] = front === 'N' ? [cx, z0 + off + 1] : front === 'S' ? [cx, z0 + TILE - off - 1] : front === 'W' ? [x0 + off + 1, cz] : [x0 + TILE - off - 1, cz];
      building(k, { x: sx, z: sz, w: alongX ? 17 : 9, d: alongX ? 9 : 17, h: 7, wall: 0xf2d27a, roof: 0x8f4030, roofH: 2.5, ridgeX: alongX, face: [front], win: 0x3e5a72, frame: 0xffffff, door: 0x4a6a8a });
      // майданчик і баскетбольний щит
      const [yx, yz] = front === 'N' ? [cx, z0 + 15] : front === 'S' ? [cx, z0 + 5] : front === 'W' ? [x0 + 15, cz] : [x0 + 5, cz];
      k.flat.add(yx, 0.05, yz, 8, 0.04, 8, 0, 0xc0745a);
      k.solid.add(yx, 1.6, yz + 3.6, 0.15, 3.2, 0.15, 0, 0x444444);
      k.flat.add(yx, 3.2, yz + 3.5, 1.6, 1.0, 0.08, 0, 0xffffff);
      break;
    }
    case 'fuel': {
      tile(k, x0, z0, 0xb9b3a8);
      const alongX = front === 'N' || front === 'S';
      k.solid.add(cx, 5.2, cz, 12, 0.6, 9, alongX ? 0 : Math.PI / 2, 0xf4f4f4);
      k.flat.add(cx, 5.2, cz, 12.1, 0.3, 9.1, alongX ? 0 : Math.PI / 2, 0xd8262c);
      for (const [px, pz] of [[-4.5, -3], [4.5, -3], [-4.5, 3], [4.5, 3]]) {
        const [wx, wz] = alongX ? [px, pz] : [pz, px];
        k.solid.add(cx + wx, 2.5, cz + wz, 0.35, 5, 0.35, 0, 0xdadada);
      }
      for (const o of [-2.5, 2.5]) k.solid.add(cx + (alongX ? o : 0), 0.8, cz + (alongX ? 0 : o), 0.8, 1.6, 0.6, 0, 0x2f6fd6);
      const [bx, bz] = front === 'N' ? [cx, z0 + 17] : front === 'S' ? [cx, z0 + 3] : front === 'W' ? [x0 + 17, cz] : [x0 + 3, cz];
      building(k, { x: bx, z: bz, w: alongX ? 10 : 5, d: alongX ? 5 : 10, h: 3.4, wall: 0xf4f4f4, face: [front], win: 0x5a8fb0 });
      k.solid.add(x0 + 2, 4, z0 + 2, 0.3, 8, 0.3, 0, 0x777777);
      k.flat.add(x0 + 2, 8, z0 + 2, 2.4, 2.4, 0.3, 0, 0xd8262c);
      break;
    }
    case 'lighthouse':
      tile(k, x0, z0, 0xc9c2b2);
      rock(k, cx - 5, cz + 5, 3, 0x8a8a84);
      rock(k, cx + 6, cz - 4, 2.4, 0x9a968c);
      for (let i = 0; i < 6; i++) k.cyl.add(cx, i * 3.4, cz, 2.4 - i * 0.18, 3.4, 2.4 - i * 0.18, 0, i % 2 ? 0xffffff : 0xd8262c);
      k.cyl.add(cx, 20.4, cz, 1.6, 2.2, 1.6, 0, 0xfff1b8);
      k.cone.add(cx, 22.6, cz, 1.9, 1.8, 1.9, 0, 0x2a2a2a);
      k.solid.add(cx + 4, 1.6, cz, 4, 3.2, 5, 0, 0xf4f1ea);
      k.gable.add(cx + 4, 3.2, cz, 4.6, 1.6, 5.6, 0, 0xb5543a);
      break;
    case 'pier': {
      // помост із дощок у бік моря (face) завдовжки 3 клітинки
      tile(k, x0, z0, 0xf0e2bc);
      const [dx, dz] = front === 'N' ? [0, -1] : front === 'S' ? [0, 1] : front === 'W' ? [-1, 0] : [1, 0];
      const len = TILE * 3.2;
      const mx = cx + dx * (len / 2), mz = cz + dz * (len / 2);
      const alongX = dx !== 0;
      k.solid.add(mx, 0.9, mz, alongX ? len : 4, 0.25, alongX ? 4 : len, 0, 0x9a7a55);
      for (let t = 4; t < len; t += 4) {
        for (const s of [-1.8, 1.8]) {
          k.cyl.add(cx + dx * t + (alongX ? 0 : s), -1, cz + dz * t + (alongX ? s : 0), 0.18, 2, 0.18, 0, 0x6e5238);
          k.flat.add(cx + dx * t + (alongX ? 0 : s), 1.4, cz + dz * t + (alongX ? s : 0), 0.1, 0.9, 0.1, 0, 0x6e5238);
        }
      }
      break;
    }
    case 'windmill': {
      tile(k, x0, z0, 0x8fbf6a);
      k.cyl.add(cx, 0, cz, 2.6, 9, 2.6, 0, 0xe8e0cc);
      k.cone.add(cx, 9, cz, 2.9, 3, 2.9, 0, 0x6b4a3a);
      const fz = cz - 3;
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        k.flat.add(cx + Math.cos(a) * 3.2, 9.5 + Math.sin(a) * 3.2, fz, 1.0, 6.4, 0.15, 0, 0xf4efe2, 0, a - Math.PI / 2);
      }
      k.solid.add(cx, 9.5, fz + 0.3, 0.6, 0.6, 0.6, 0, 0x5a4636);
      break;
    }
  }
}

// ------------------------------------------------------------------ фон за межами карти

function backdrop(theme: Theme, level: Level, k: Kit, rand: () => number, inWater: (c: number, r: number) => boolean) {
  const W = level.cols * TILE, H = level.rows * TILE;
  /** n точок по периметру карти, розширеному на minD…minD+spread метрів (не на воді) */
  const ring = (n: number, minD: number, spread: number, put: (x: number, z: number) => void) => {
    for (let i = 0; i < n; i++) {
      const d = minD + rand() * spread;
      const w = W + 2 * d, h = H + 2 * d;
      let s = ((i + rand() * 0.6) / n) * 2 * (w + h);
      let x: number, z: number;
      if (s < w) [x, z] = [-d + s, -d];
      else if ((s -= w) < h) [x, z] = [W + d, -d + s];
      else if ((s -= h) < w) [x, z] = [W + d - s, H + d];
      else [x, z] = [-d, H + d - (s - w)];
      if (!inWater(Math.floor(x / TILE), Math.floor(z / TILE))) put(x, z);
    }
  };
  if (theme === 'mountain') {
    ring(34, 120, 110, (x, z) => {
      const R = 60 + rand() * 60, Hh = 100 + rand() * 110, rot = rand() * 3;
      k.cone.add(x, -4, z, R, Hh, R, rot, pick(rand, [0x7d8590, 0x6f7883, 0x8a929c]));
      k.cone.add(x, -4 + Hh * 0.52, z, R * 0.49, Hh * 0.49, R * 0.49, rot, 0xf6f9fc);
    });
  } else if (theme === 'desert') {
    ring(18, 130, 140, (x, z) => {
      const R = 30 + rand() * 50, Hh = 18 + rand() * 30;
      k.cyl.add(x, -1, z, R, Hh, R * (0.6 + rand() * 0.4), rand() * 3, pick(rand, [0xc98a5a, 0xb97a4e, 0xd39a68]));
      k.cyl.add(x, Hh - 1, z, R * 0.97, 1.2, R * 0.6, 0, 0xdcae7a);
    });
  } else if (theme === 'taiga' || theme === 'village' || theme === 'coast') {
    const col = theme === 'taiga' ? [0x2f553a, 0x3a5f40, 0x2a4a35] : [0x7aa35a, 0x6f9a52, 0x86ad62];
    ring(30, 130, 110, (x, z) => {
      const R = 60 + rand() * 70;
      k.ball.add(x, -R * 0.35, z, R, R * (theme === 'taiga' ? 0.7 : 0.45), R, rand() * 3, pick(rand, col));
    });
  }
}

// ------------------------------------------------------------------ панорама на горизонті

const FAR = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false });

function mix(a: number, b: number, t: number) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

/**
 * Далекі вершини, столові гори чи пагорби на горизонті: кільце навколо камери, яке рухається разом із нею
 * (як небо) і не тоне в тумані — тож їх видно з будь-якого місця карти.
 */
function skyline(theme: Theme, rand: () => number): THREE.InstancedMesh[] {
  const sky = THEME_LOOK[theme].sky;
  const cones = new Batch(CONE, FAR, false, false);
  const cyls = new Batch(CYL, FAR, false, false);
  const balls = new Batch(BALL, FAR, false, false);
  const n = theme === 'mountain' ? 40 : 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.12;
    // на узбережжі — лише з боку суші (море на півдні)
    if (theme === 'coast' && Math.sin(a) > -0.15) continue;
    const rad = 560 + rand() * 70;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const rot = rand() * 3;
    if (theme === 'mountain') {
      const R = 70 + rand() * 70, H = 120 + rand() * 150;
      cones.add(x, -10, z, R, H, R, rot, mix(pick(rand, [0x6f7883, 0x7d8590, 0x5f6a78]), sky, 0.5));
      cones.add(x, -10 + H * 0.55, z, R * 0.46, H * 0.46, R * 0.46, rot, mix(0xffffff, sky, 0.15));
    } else if (theme === 'desert') {
      const R = 40 + rand() * 60, H = 30 + rand() * 45;
      cyls.add(x, -2, z, R, H, R * 0.7, rot, mix(pick(rand, [0xc98a5a, 0xb97a4e, 0xd39a68]), sky, 0.4));
    } else if (theme === 'taiga' || theme === 'village' || theme === 'coast') {
      const R = 70 + rand() * 80;
      const col = theme === 'taiga' ? [0x2f553a, 0x3a5f40] : [0x7aa35a, 0x6f9a52];
      balls.add(x, -R * 0.3, z, R, R * (theme === 'taiga' ? 0.55 : 0.35), R, rot, mix(pick(rand, col), sky, 0.6));
    }
  }
  const meshes = [cones, cyls, balls].flatMap((b) => b.build());
  for (const m of meshes) {
    m.frustumCulled = false;
    // перед кожним кадром — у центр під камерою; якщо кільце далі за межу промальовування камери,
    // стискаємо його до камери: видимий розмір і положення на горизонті не змінюються
    m.onBeforeRender = (_r, _s, cam) => {
      const far = (cam as THREE.PerspectiveCamera).far ?? 700;
      const k = Math.min(1, (far - 10) / 780);
      m.matrixWorld.makeScale(k, k, k).setPosition(cam.position.x, cam.position.y * (1 - k), cam.position.z);
    };
  }
  return meshes;
}

// ------------------------------------------------------------------ збирання

/**
 * Оформлення місцевості рівня з темою: земля, забудова, рослинність, вода, мости, приметні споруди й фон.
 * skip — клітинки, де нічого не будуємо (колії).
 */
export function buildTheme(level: Level, grid: RoadGrid, rand: () => number, skip: Set<string>) {
  const theme = level.theme!;
  const k = new Kit();
  const snow = level.weather === 'snow';
  const waters = level.water ?? [];
  const inWater = (c: number, r: number) => waters.some((w) => c >= w.from[0] && c <= w.to[0] && r >= w.from[1] && r <= w.to[1]);
  const waterDist = (c: number, r: number) => {
    for (let n = 1; n <= 2; n++) {
      for (let dr = -n; dr <= n; dr++) for (let dc = -n; dc <= n; dc++) if (inWater(c + dc, r + dr)) return n;
    }
    return 9;
  };
  const marks = new Map((level.landmarks ?? []).map((m) => [m.cell.join(','), m]));
  const M = 4;
  for (let r = -M; r < level.rows + M; r++) {
    for (let c = -M; c < level.cols + M; c++) {
      const x0 = c * TILE, z0 = r * TILE;
      if (grid.isRoad(c, r)) {
        // міст: поруччя на краях тротуарів над водою
        for (const [d, wc, wr] of [['N', c, r - 1], ['S', c, r + 1], ['W', c - 1, r], ['E', c + 1, r]] as [Dir, number, number][]) {
          if (grid.isRoad(wc, wr) || !inWater(wc, wr)) continue;
          const alongX = d === 'N' || d === 'S';
          const off = d === 'N' ? z0 + 0.3 : d === 'S' ? z0 + TILE - 0.3 : d === 'W' ? x0 + 0.3 : x0 + TILE - 0.3;
          if (alongX) k.solid.add(x0 + TILE / 2, 0.95, off, TILE, 1.2, 0.45, 0, 0xb9b2a6);
          else k.solid.add(off, 0.95, z0 + TILE / 2, 0.45, 1.2, TILE, 0, 0xb9b2a6);
        }
        continue;
      }
      if (skip.has(`${c},${r}`) || inWater(c, r)) continue;
      const inMap = grid.inBounds(c, r);
      const p: CellCtx = {
        k, rand, c, r, x0, z0, inMap, snow,
        sides: roadSides(grid, c, r),
        urban: urbanAt(level, c, r),
        water: waterDist(c, r),
      };
      const m = marks.get(`${c},${r}`);
      if (m) landmark(m.kind, p, m.face);
      else CELL_DECOR[theme](p);
    }
  }

  // вода: одна площина на кожен прямокутник (під асфальтом мостів)
  for (const w of waters) {
    const x1 = w.from[0] * TILE, z1 = w.from[1] * TILE;
    const x2 = (w.to[0] + 1) * TILE, z2 = (w.to[1] + 1) * TILE;
    const color = w.frozen ? 0xcfe3ee : theme === 'coast' ? 0x3d8fc4 : 0x4a8db3;
    k.flat.add((x1 + x2) / 2, -0.06, (z1 + z2) / 2, x2 - x1, 0.08, z2 - z1, 0, color);
    // брижі (або тріщини на льоду)
    const n = Math.min(160, Math.floor(((x2 - x1) * (z2 - z1)) / 900));
    for (let i = 0; i < n; i++) {
      k.flat.add(x1 + rand() * (x2 - x1), -0.01, z1 + rand() * (z2 - z1), 3 + rand() * 5, 0.02, 0.25, rand() * 0.4, w.frozen ? 0xe8f2f7 : shade(color, 1.25));
    }
    if (theme === 'coast' && !w.frozen) {
      for (let i = 0; i < 6; i++) {
        const x = x1 + rand() * (x2 - x1), z = z1 + 60 + rand() * Math.max(10, z2 - z1 - 60);
        const ry = rand() * Math.PI;
        k.solid.add(x, 0.3, z, 2.2, 0.8, 6, ry, pick(rand, [0xffffff, 0x2f6fd6, 0xd8262c]));
        k.solid.add(x, 1.1, z, 1.6, 0.9, 2, ry, 0xf4f4f4);
        k.cyl.add(x, 0.7, z, 0.08, 6, 0.08, 0, 0xdddddd);
      }
    }
  }

  backdrop(theme, level, k, rand, inWater);

  return [...k.all().flatMap((b) => b.build()), ...skyline(theme, rand)];
}

/** Тротуар під клітинкою дороги: у населеному пункті — бруківка, поза ним — трав'яне чи піщане узбіччя. */
export function sidewalkColor(level: Level, c: number, r: number) {
  const look = THEME_LOOK[level.theme!];
  return urbanAt(level, c, r) ? look.sidewalk : look.shoulder;
}
