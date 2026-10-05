import * as THREE from 'three';
import type { Actor, ActorVariant, Cell, Dir, Level, SignAlt } from '../types';
import {
  BOX, Batch, makeBlindPedestrian, makeBus, makeBusShelter, makeCar, makeCone, makeCyclist, makeFinishLine, makeHydrant,
  makeIsland, makeLamp, makePerson, makeRailBarrier, makeRoadBarrier, makeSchoolBus, makeScooter, makeTrain,
  makeTriangle, makeTruck, makeWheelchair, makeWorker, mat,
} from './models';
import { makeSign } from './signs';
import { THEME_LOOK, buildTheme, urbanAt } from './themes';

export const TILE = 20;
/** ширина тротуару від краю клітинки */
export const SIDEWALK = 3.2;
/** зміщення центру смуги від осі дороги */
export const LANE = 3.3;
/** радіус центрального острівця рондо та радіус траєкторії по колу */
export const ISLAND_R = 4.2;
export const RING_R = 7.2;
/** паркувальне місце: зміщення від осі дороги, довжина, ширина */
export const BAY_LAT = TILE / 2 - SIDEWALK - 1.35;
export const BAY_LEN = 8;
export const BAY_W = 2.6;

export const DIR_VEC: Record<Dir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
/** кут повороту об'єкта (rotation.y), щоб «перед» (-Z) дивився в напрямку */
export const DIR_ANGLE: Record<Dir, number> = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 };
/** напрямок «праворуч» для напрямку руху (правосторонній рух) */
export const RIGHT_OF: Record<Dir, Dir> = { N: 'E', E: 'S', S: 'W', W: 'N' };
export const OPP: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const DIRS: Dir[] = ['N', 'E', 'S', 'W'];

export function cellCenter([c, r]: Cell, y = 0) {
  return new THREE.Vector3((c + 0.5) * TILE, y, (r + 0.5) * TILE);
}

export function dirBetween(a: Cell, b: Cell): Dir {
  if (b[0] > a[0]) return 'E';
  if (b[0] < a[0]) return 'W';
  if (b[1] > a[1]) return 'S';
  return 'N';
}

/** Найближчий напрямок світу для кута heading. */
export function headingDir(h: number): Dir {
  const a = ((Math.round(h / (Math.PI / 2)) % 4) + 4) % 4;
  return (['N', 'W', 'S', 'E'] as Dir[])[a];
}

export const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

/** Детермінований генератор випадкових чисел (місто однакове щоразу). */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RoadGrid {
  private rondo: Set<string>;

  constructor(public level: Level) {
    this.rondo = new Set((level.roundabouts ?? []).map((c) => c.join(',')));
  }

  isRoad(c: number, r: number) {
    if (r < 0 || r >= this.level.rows || c < 0 || c >= this.level.cols) {
      // дорога «продовжується» за межі карти, якщо крайня клітинка — дорога
      const cc = Math.min(Math.max(c, 0), this.level.cols - 1);
      const rr = Math.min(Math.max(r, 0), this.level.rows - 1);
      return (cc !== c) !== (rr !== r) && this.level.map[rr][cc] === '#';
    }
    return this.level.map[r][c] === '#';
  }

  inBounds(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.level.cols && r < this.level.rows;
  }

  isRoundabout(c: number, r: number) {
    return this.rondo.has(`${c},${r}`);
  }

  neighbors(c: number, r: number) {
    return {
      N: this.isRoad(c, r - 1),
      S: this.isRoad(c, r + 1),
      E: this.isRoad(c + 1, r),
      W: this.isRoad(c - 1, r),
    };
  }

  /** Виїзди з клітинки, що ведуть у межах карти. */
  exits(c: number, r: number): Dir[] {
    return DIRS.filter((d) => {
      const [dx, dz] = DIR_VEC[d];
      return this.isRoad(c + dx, r + dz) && this.inBounds(c + dx, r + dz);
    });
  }

  /** Перехрестя або рондо — місце, де машини можуть перетнутися. */
  isJunction(c: number, r: number) {
    const n = this.neighbors(c, r);
    return [n.N, n.S, n.E, n.W].filter(Boolean).length >= 3;
  }

  cellAt(x: number, z: number): Cell {
    return [Math.floor(x / TILE), Math.floor(z / TILE)];
  }

  /** Кути клітинки: чи відкриті дві сторони біля кута і чи діагональна клітинка — дорога. */
  corners(c: number, r: number) {
    const n = this.neighbors(c, r);
    return [
      { x: c * TILE, z: r * TILE, a: n.N, b: n.W, diag: this.isRoad(c - 1, r - 1) },
      { x: (c + 1) * TILE, z: r * TILE, a: n.N, b: n.E, diag: this.isRoad(c + 1, r - 1) },
      { x: c * TILE, z: (r + 1) * TILE, a: n.S, b: n.W, diag: this.isRoad(c - 1, r + 1) },
      { x: (c + 1) * TILE, z: (r + 1) * TILE, a: n.S, b: n.E, diag: this.isRoad(c + 1, r + 1) },
    ];
  }

  /** Для клітинки-повороту (рівно 2 перпендикулярні виїзди) — центр дуги повороту. */
  pivot(c: number, r: number) {
    const n = this.neighbors(c, r);
    const open = [n.N, n.S, n.E, n.W].filter(Boolean).length;
    if (open !== 2 || (n.N && n.S) || (n.E && n.W)) return null;
    return this.corners(c, r).find((k) => k.a && k.b) ?? null;
  }

  /** Кути, де тротуар заокруглений (внутрішній кут повороту або перехрестя). */
  islands(c: number, r: number) {
    return this.corners(c, r).filter((k) => k.a && k.b && !k.diag);
  }

  /**
   * Не дає авто заїхати на тротуар/будинки.
   * 'pushed' — авто відштовхнуто від бордюру, 'blocked' — позиція недопустима.
   */
  constrain(p: THREE.Vector3, radius: number): 'ok' | 'pushed' | 'blocked' {
    const [c, r] = this.cellAt(p.x, p.z);
    if (!this.isRoad(c, r) || !this.inBounds(c, r)) return 'blocked';
    const n = this.neighbors(c, r);
    const m = SIDEWALK + radius;
    const x0 = c * TILE, z0 = r * TILE;
    let hit = false;

    const pushOut = (kx: number, kz: number, min: number) => {
      const dx = p.x - kx, dz = p.z - kz;
      const d = Math.hypot(dx, dz);
      if (d < min) {
        const s = min / Math.max(d, 1e-3);
        p.x = kx + dx * s;
        p.z = kz + dz * s;
        hit = true;
      }
    };

    const pivot = this.pivot(c, r);
    if (pivot) {
      // зовнішній бордюр повороту — дуга навколо pivot
      const dx = p.x - pivot.x, dz = p.z - pivot.z;
      const d = Math.hypot(dx, dz);
      const max = TILE - m;
      if (d > max) {
        p.x = pivot.x + (dx / d) * max;
        p.z = pivot.z + (dz / d) * max;
        hit = true;
      }
    } else {
      const lx = p.x - x0, lz = p.z - z0;
      if (!n.W && lx < m) { p.x = x0 + m; hit = true; }
      if (!n.E && lx > TILE - m) { p.x = x0 + TILE - m; hit = true; }
      if (!n.N && lz < m) { p.z = z0 + m; hit = true; }
      if (!n.S && lz > TILE - m) { p.z = z0 + TILE - m; hit = true; }
    }

    for (const k of this.islands(c, r)) pushOut(k.x, k.z, m);
    if (this.isRoundabout(c, r)) pushOut(x0 + TILE / 2, z0 + TILE / 2, ISLAND_R + radius);
    return hit ? 'pushed' : 'ok';
  }
}

/** Кут повороту (rotation.y) канонічної форми, щоб її чверть лягла всередину клітинки. */
function quadrantAngle(kx: number, kz: number, x0: number, z0: number) {
  const qx = kx === x0 ? 1 : -1;
  const qz = kz === z0 ? 1 : -1;
  if (qx === 1 && qz === -1) return 0;
  if (qx === -1 && qz === -1) return Math.PI / 2;
  if (qx === -1 && qz === 1) return Math.PI;
  return -Math.PI / 2;
}

/** Обертає точку (x, z) навколо осі Y — так само, як це робить Three.js. */
function rotY(x: number, z: number, a: number): [number, number] {
  return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
}

/** Піднятий тротуар заданої форми; бокові грані — колір бордюру. */
function sidewalkGeometry(shape: THREE.Shape) {
  return new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false, curveSegments: 20 })
    .rotateX(-Math.PI / 2);
}

const C = {
  ground: 0xd9c3a3,
  asphalt: 0x6b5e57,
  sidewalk: 0xecd9c2,
  curb: 0xc9b29a,
  marking: 0xf6efe1,
  plaza: 0xe3cdb0,
  bay: 0x3b82f6,
  buildings: [0xd9b38c, 0xc99b73, 0xe2c29b, 0xb88a64, 0xd6a77a, 0xe8cfa8, 0xc7a27c],
  roofs: [0x9c6b4e, 0x8a5a42, 0xa8826a, 0x7d5a48],
  trunk: 0x7a5236,
  leaves: [0x7fb069, 0x6a9c57, 0x93c27a],
};

export interface Actor3D {
  kind: Actor['kind'];
  obj: THREE.Object3D;
  dir: THREE.Vector3;
  go?: string;
  travel: number;
  moved: number;
  speed: number;
  maxSpeed: number;
  moving: boolean;
  /** пішохід: пауза на тротуарі перед зворотним переходом */
  pause: number;
  /** пішохід іде вздовж проїжджої частини (не переходить її) */
  walker?: boolean;
  halfW: number;
  halfL: number;
  home: THREE.Vector3;
  homeDir: THREE.Vector3;
  homeYaw: number;
  blink?: 'left' | 'right' | 'hazard';
  blinkers: THREE.Object3D[];
  variant?: ActorVariant;
  /** змінити різновид (модель) учасника, щоб сцена відповідала питанню */
  setVariant(v: ActorVariant | undefined): void;
}

/** Модель учасника за різновидом і її розміри/швидкість. Перед — у напрямку -Z. */
function actorModel(a: Actor, variant: ActorVariant | undefined, color: number) {
  if (a.kind === 'pedestrian') {
    if (variant === 'wheelchair') return { model: makeWheelchair(color), halfW: 0.5, halfL: 0.6, maxSpeed: 1.1 };
    if (variant === 'cane') return { model: makeBlindPedestrian(color), halfW: 0.45, halfL: 0.6, maxSpeed: 0.9 };
    if (variant === 'worker') return { model: makeWorker(), halfW: 0.45, halfL: 0.45, maxSpeed: 0 };
    return { model: makePerson(color), halfW: 0.45, halfL: 0.45, maxSpeed: 1.4 };
  }
  if (a.kind === 'cyclist') {
    if (variant === 'scooter') return { model: makeScooter(color), halfW: 0.4, halfL: 0.7, maxSpeed: 5 };
    return { model: makeCyclist(color), halfW: 0.45, halfL: 1.0, maxSpeed: 4.2 };
  }
  if (a.kind === 'train') return { model: makeTrain(), halfW: 1.6, halfL: 30, maxSpeed: 19 };
  if (a.kind === 'bus') {
    return { model: variant === 'school' ? makeSchoolBus() : makeBus(a.color), halfW: 1.25, halfL: 5.5, maxSpeed: 9 };
  }
  if (variant === 'truck') return { model: makeTruck(), halfW: 1.25, halfL: 4.5, maxSpeed: 8 };
  return { model: makeCar(a.color ?? 0x4f8fe6, { police: a.kind === 'police' }), halfW: 1.0, halfL: 2.15, maxSpeed: 9 };
}

/** Знак у сцені, який можна замінити іншим варіантом (див. SignDef.alts). */
export interface Sign3D {
  setAlt(alt: SignAlt | null): void;
}

/** Залізничний переїзд у 3D: стріли шлагбаумів і червоні вогні — анімуються з гри. */
export interface Rail3D {
  cell: Cell;
  axis: 'v' | 'h';
  go?: string;
  arms: THREE.Object3D[];
  lamps: THREE.Mesh[];
}

/** Трикутник лінії P-13: основа на лінії, вершина — назустріч водієві. */
const TOOTH = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.45, 0);
  sh.lineTo(0.45, 0);
  sh.lineTo(0, 1.2);
  sh.closePath();
  return new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
})();

/** Половина ширини проїжджої частини (від осі до бордюру). */
export const ROAD_HALF = TILE / 2 - SIDEWALK;

/** Будує місто рівня всередині parent. Повертає сітку доріг, сценарні машини і функцію очищення. */
export function buildCity(parent: THREE.Object3D, level: Level) {
  const grid = new RoadGrid(level);
  const rand = rng(level.seed ?? 1337);
  const scenery = level.scenery ?? 'city';
  const snow = level.weather === 'snow';
  const rural = scenery !== 'city';
  // траса з двома проїжджими частинами (відбійник по осі) — у зонах autostrady / drogi ekspresowej;
  // за їхніми межами — звичайна двостороння дорога
  const dual = (c: number, r: number) =>
    !level.zones?.length ||
    level.zones.some((z) => (z.sign === 'D-7' || z.sign === 'D-9') && c >= z.from[0] && c <= z.to[0] && r >= z.from[1] && r <= z.to[1]);
  // кольори під пейзаж і погоду
  const K = {
    ground: snow ? 0xeef2f5 : rural ? 0x8fb36a : C.ground,
    plaza: snow ? 0xf2f5f7 : rural ? 0x9cc27a : C.plaza,
    sidewalk: snow ? 0xe6ecf0 : rural ? 0x8aa865 : C.sidewalk,
    curb: snow ? 0xd6dde2 : rural ? 0xd9d4c4 : C.curb,
    asphalt: snow ? 0x77706b : C.asphalt,
    roofs: snow ? [0xf4f7f9, 0xe9eef2] : C.roofs,
    leaves: snow ? [0xdfe8ec, 0xc9d8cf, 0xe8eef0] : C.leaves,
    fields: snow ? [0xf2f5f7, 0xe9eef2] : [0x9cc27a, 0xc9c86e, 0x86b05e, 0xb7c97a],
  };
  // рівні з темою (пустеля, тайга, гори…): свої кольори, а забудову й рослинність будує themes.ts
  const look = level.theme ? THEME_LOOK[level.theme] : null;
  if (look) Object.assign(K, { ground: look.ground, sidewalk: look.sidewalk, curb: look.curb, asphalt: look.asphalt });
  /** поза населеним пунктом замість тротуару — узбіччя (лише на рівнях з темою) */
  const shoulderAt = (c: number, r: number) => !!look && !urbanAt(level, c, r);
  // клітинки, через які йдуть колії (там не будуємо будинків)
  const railLine = new Set<string>();
  for (const rl of level.rails ?? []) {
    for (let k = -6; k < Math.max(level.cols, level.rows) + 6; k++) {
      railLine.add(rl.axis === 'v' ? `${k},${rl.cell[1]}` : `${rl.cell[0]},${k}`);
    }
  }
  const W = level.cols * TILE;
  const H = level.rows * TILE;
  const owned: { dispose(): void }[] = [];
  const add = (o: THREE.Object3D) => parent.add(o);

  // Земля
  const groundGeo = new THREE.PlaneGeometry(W + 400, H + 400);
  owned.push(groundGeo);
  const ground = new THREE.Mesh(groundGeo, mat(K.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, -0.15, H / 2);
  ground.receiveShadow = true;
  add(ground);

  const buildingMat = new THREE.MeshLambertMaterial();
  const roofMat = new THREE.MeshLambertMaterial();
  const leafMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6);
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  owned.push(buildingMat, roofMat, leafMat, trunkGeo, leafGeo);

  const asphalt = new Batch(BOX, mat(K.asphalt));
  const sidewalk = new Batch(BOX, mat(K.sidewalk));
  const curb = new Batch(BOX, mat(K.curb));
  const marking = new Batch(BOX, mat(C.marking));
  const plazaMat = new THREE.MeshLambertMaterial();
  owned.push(plazaMat);
  const plaza = new Batch(BOX, plazaMat);
  const rails = new Batch(BOX, mat(0x9aa0a8));
  const gravel = new Batch(BOX, mat(snow ? 0xc9ccd0 : 0x6d665f));
  const sleepers = new Batch(BOX, mat(0x5a4636));
  const guard = new Batch(BOX, mat(0xb8bec6), true);
  const buildings = new Batch(BOX, buildingMat, true, true);
  const roofs = new Batch(BOX, roofMat, true, true);
  const windows = new Batch(BOX, mat(0x6f7f8f));
  const trunks = new Batch(trunkGeo, mat(C.trunk), true);
  const leaves = new Batch(leafGeo, leafMat, true);

  const curbMats = [mat(K.sidewalk), mat(K.curb)];
  const shoulder = new Batch(BOX, mat(look?.shoulder ?? K.sidewalk));
  const shoulderMats = [mat(look?.shoulder ?? K.sidewalk), mat(K.curb)];
  const R_OUT = TILE - SIDEWALK;
  const innerShape = new THREE.Shape();
  innerShape.moveTo(0, 0);
  innerShape.lineTo(SIDEWALK, 0);
  innerShape.absarc(0, 0, SIDEWALK, 0, Math.PI / 2, false);
  innerShape.lineTo(0, 0);
  const innerGeo = sidewalkGeometry(innerShape);
  const outerShape = new THREE.Shape();
  outerShape.moveTo(R_OUT, 0);
  outerShape.lineTo(TILE, 0);
  outerShape.lineTo(TILE, TILE);
  outerShape.lineTo(0, TILE);
  outerShape.lineTo(0, R_OUT);
  outerShape.absarc(0, 0, R_OUT, Math.PI / 2, 0, true);
  const outerGeo = sidewalkGeometry(outerShape);
  owned.push(innerGeo, outerGeo);

  const crossSet = new Set(level.crosswalks.map((cw) => cw.cell.join(',')));

  // Дороги можуть виходити за край карти — додаємо «хвости»
  const allRoad: Cell[] = [];
  for (let c = -4; c < level.cols + 4; c++) {
    for (let r = -4; r < level.rows + 4; r++) if (grid.isRoad(c, r)) allRoad.push([c, r]);
  }

  for (const [c, r] of allRoad) {
    const x0 = c * TILE, z0 = r * TILE;
    const cx = x0 + TILE / 2, cz = z0 + TILE / 2;
    asphalt.add(cx, -0.05, cz, TILE, 0.1, TILE);
    const n = grid.neighbors(c, r);
    const sw = SIDEWALK;
    const h = 0.35;
    const pivot = grid.pivot(c, r);
    const side = shoulderAt(c, r) ? shoulder : sidewalk;
    const sideMats = shoulderAt(c, r) ? shoulderMats : curbMats;
    if (pivot) {
      // поворот: зовнішній тротуар — дуга
      const m = new THREE.Mesh(outerGeo, sideMats);
      m.position.set(pivot.x, 0, pivot.z);
      m.rotation.y = quadrantAngle(pivot.x, pivot.z, x0, z0);
      m.receiveShadow = true;
      add(m);
      // переривчаста осьова лінія по дузі
      const a0 = m.rotation.y;
      for (const deg of [15, 45, 75]) {
        const a = (deg * Math.PI) / 180;
        const [ox, oz] = rotY((TILE / 2) * Math.cos(a), -(TILE / 2) * Math.sin(a), a0);
        marking.add(pivot.x + ox, 0.02, pivot.z + oz, 0.3, 0.04, 3.2, a0 + a + Math.PI);
      }
    } else {
      // тротуари по сторонах без дороги
      if (!n.N) { side.add(cx, h / 2, z0 + sw / 2, TILE, h, sw); curb.add(cx, h / 2, z0 + sw, TILE, h + 0.02, 0.3); }
      if (!n.S) { side.add(cx, h / 2, z0 + TILE - sw / 2, TILE, h, sw); curb.add(cx, h / 2, z0 + TILE - sw, TILE, h + 0.02, 0.3); }
      if (!n.W) { side.add(x0 + sw / 2, h / 2, cz, sw, h, TILE); curb.add(x0 + sw, h / 2, cz, 0.3, h + 0.02, TILE); }
      if (!n.E) { side.add(x0 + TILE - sw / 2, h / 2, cz, sw, h, TILE); curb.add(x0 + TILE - sw, h / 2, cz, 0.3, h + 0.02, TILE); }
    }
    // заокруглені кути тротуару (внутрішній бік повороту, кути перехресть)
    for (const k of grid.islands(c, r)) {
      const m = new THREE.Mesh(innerGeo, sideMats);
      m.position.set(k.x, 0, k.z);
      m.rotation.y = quadrantAngle(k.x, k.z, x0, z0);
      m.receiveShadow = true;
      add(m);
    }
    if (grid.isRoundabout(c, r)) {
      const island = makeIsland(ISLAND_R);
      island.position.set(cx, 0, cz);
      add(island);
    }

    const vertical = n.N && n.S && !n.E && !n.W;
    const horizontal = n.E && n.W && !n.N && !n.S;
    if ((vertical || horizontal) && scenery === 'highway' && dual(c, r)) {
      // траса: розділювальний відбійник по осі замість переривчастої лінії
      if (vertical) guard.add(cx, 0.75, cz, 0.25, 0.5, TILE);
      else guard.add(cx, 0.75, cz, TILE, 0.5, 0.25);
    } else if ((vertical || horizontal) && !crossSet.has(`${c},${r}`)) {
      // переривчаста осьова лінія
      for (let i = 0; i < 3; i++) {
        const t = -TILE / 2 + TILE / 6 + (i * TILE) / 3;
        if (vertical) marking.add(cx, 0.02, cz + t, 0.3, 0.04, 3.2);
        else marking.add(cx + t, 0.02, cz, 3.2, 0.04, 0.3);
      }
    }
  }

  // Пішохідні переходи («зебра»)
  for (const cw of level.crosswalks) {
    const p = cellCenter(cw.cell);
    const width = TILE - SIDEWALK * 2;
    const n = 7;
    const step = width / n;
    for (let i = 0; i < n; i++) {
      const o = -width / 2 + step * (i + 0.5);
      if (cw.axis === 'v') marking.add(p.x + o, 0.02, p.z, step * 0.55, 0.04, 4.5);
      else marking.add(p.x, 0.02, p.z + o, 4.5, 0.04, step * 0.55);
    }
  }

  // Розмічені місця вздовж бордюру (для людей з інвалідністю — сині, з символом візка)
  for (const b of level.bays ?? []) {
    const { cx, cz, ax, az } = bayFrame({ cell: b.cell, travel: b.travel });
    const al = b.along ?? 0;
    const x = cx + ax * al, z = cz + az * al;
    const longX = Math.abs(ax) > 0;
    const fill = new THREE.Mesh(BOX, mat(b.disabled ? 0x2f6fd6 : C.asphalt));
    fill.scale.set(longX ? BAY_LEN : BAY_W, 0.03, longX ? BAY_W : BAY_LEN);
    fill.position.set(x, 0.02, z);
    add(fill);
    for (const sgn of [-1, 1]) {
      const [ex, ez] = [x + (ax * sgn * BAY_LEN) / 2, z + (az * sgn * BAY_LEN) / 2];
      if (longX) marking.add(ex, 0.03, ez, 0.25, 0.04, BAY_W);
      else marking.add(ex, 0.03, ez, BAY_W, 0.04, 0.25);
    }
    if (b.disabled) {
      const icon = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), wheelchairDecal());
      icon.rotation.x = -Math.PI / 2;
      icon.rotation.z = Math.atan2(ax, -az);
      icon.position.set(x, 0.05, z);
      add(icon);
    }
  }

  // Паркувальне місце (рамка + синя заливка)
  if (level.park) {
    const { cx, cz, ax, az } = bayFrame(level.park);
    const along = (d: number, lat: number): [number, number] => [cx + ax * d - az * lat, cz + az * d + ax * lat];
    const longX = Math.abs(ax) > 0;
    for (const s of [-1, 1]) {
      // поперечні лінії на кінцях місця
      const [x, z] = along((s * BAY_LEN) / 2, 0);
      if (longX) marking.add(x, 0.03, z, 0.25, 0.04, BAY_W);
      else marking.add(x, 0.03, z, BAY_W, 0.04, 0.25);
    }
    // лінія з боку дороги
    const [lx, lz] = [cx - (RIGHT_DIRVEC(level.park.travel)[0] * BAY_W) / 2, cz - (RIGHT_DIRVEC(level.park.travel)[1] * BAY_W) / 2];
    if (longX) marking.add(lx, 0.03, lz, BAY_LEN, 0.04, 0.25);
    else marking.add(lx, 0.03, lz, 0.25, 0.04, BAY_LEN);
    const fill = new THREE.Mesh(BOX, mat(C.bay, { transparent: true, opacity: 0.35 }));
    fill.scale.set(longX ? BAY_LEN : BAY_W, 0.03, longX ? BAY_W : BAY_LEN);
    fill.position.set(cx, 0.02, cz);
    add(fill);
  }

  // Забудова: на рівнях з темою — окремий модуль (будинки, рослини, вода, приметні споруди, фон)
  if (look) {
    for (const mesh of buildTheme(level, grid, rand, railLine)) {
      owned.push(mesh);
      add(mesh);
    }
  } else for (let r = -4; r < level.rows + 4; r++) {
    for (let c = -4; c < level.cols + 4; c++) {
      if (grid.isRoad(c, r)) continue;
      const x0 = c * TILE, z0 = r * TILE;
      if (railLine.has(`${c},${r}`)) {
        plaza.add(x0 + TILE / 2, 0.02, z0 + TILE / 2, TILE, 0.04, TILE, 0, K.plaza);
        continue;
      }
      if (rural) {
        // поля, рідкі дерева й хати
        plaza.add(x0 + TILE / 2, 0.02, z0 + TILE / 2, TILE, 0.04, TILE, 0, K.fields[Math.floor(rand() * K.fields.length)]);
        const roll = rand();
        if (scenery === 'country' && roll < 0.14) {
          const w = 8 + rand() * 3, d = 7 + rand() * 3, hgt = 4.5;
          const bx = x0 + TILE / 2 + (rand() - 0.5) * 4, bz = z0 + TILE / 2 + (rand() - 0.5) * 4;
          buildings.add(bx, hgt / 2, bz, w, hgt, d, 0, C.buildings[Math.floor(rand() * C.buildings.length)]);
          roofs.add(bx, hgt + 0.9, bz, w + 0.8, 1.8, d + 0.8, 0, K.roofs[Math.floor(rand() * K.roofs.length)]);
        } else if (roll < 0.5) {
          const nTrees = 1 + Math.floor(rand() * 3);
          for (let t = 0; t < nTrees; t++) {
            const tx = x0 + 3 + rand() * (TILE - 6), tz = z0 + 3 + rand() * (TILE - 6);
            const sz = 1.8 + rand() * 1.4;
            trunks.add(tx, 0.8, tz, 1, 1, 1);
            leaves.add(tx, 2.2 + sz * 0.6, tz, sz, sz * 1.2, sz, rand() * 6, K.leaves[Math.floor(rand() * K.leaves.length)]);
          }
        }
        continue;
      }
      plaza.add(x0 + TILE / 2, 0.02, z0 + TILE / 2, TILE, 0.04, TILE, 0, K.plaza);
      const lots = rand() < 0.35 ? 1 : 2;
      for (let i = 0; i < lots; i++) {
        if (rand() < 0.18) {
          // дерево замість будинку
          const tx = x0 + 4 + rand() * (TILE - 8);
          const tz = z0 + 4 + rand() * (TILE - 8);
          const s = 1.6 + rand() * 1.2;
          trunks.add(tx, 0.8, tz, 1, 1, 1);
          leaves.add(tx, 2.2 + s * 0.6, tz, s, s * 1.15, s, rand() * 6, K.leaves[Math.floor(rand() * K.leaves.length)]);
          continue;
        }
        const w = lots === 1 ? 12 + rand() * 4 : 7 + rand() * 2.5;
        const d = 10 + rand() * 6;
        const hgt = 5 + Math.floor(rand() * 4) * 3;
        const bx = lots === 1 ? x0 + TILE / 2 : x0 + 2 + w / 2 + i * (TILE - 4 - w);
        const bz = z0 + TILE / 2 + (rand() - 0.5) * 2;
        const col = C.buildings[Math.floor(rand() * C.buildings.length)];
        buildings.add(bx, hgt / 2, bz, w, hgt, d, 0, col);
        roofs.add(bx, hgt + 0.2, bz, w + 0.6, 0.4, d + 0.6, 0, K.roofs[Math.floor(rand() * K.roofs.length)]);
        // вікна на всіх 4 фасадах
        const floors = Math.floor((hgt - 1.5) / 3);
        for (let f = 0; f < floors; f++) {
          const y = 2.2 + f * 3;
          const nx = Math.floor(w / 2.6);
          for (let k = 0; k < nx; k++) {
            const ox = -w / 2 + (w / nx) * (k + 0.5);
            windows.add(bx + ox, y, bz - d / 2 - 0.05, 1.0, 1.3, 0.12);
            windows.add(bx + ox, y, bz + d / 2 + 0.05, 1.0, 1.3, 0.12);
          }
          const nz = Math.floor(d / 2.6);
          for (let k = 0; k < nz; k++) {
            const oz = -d / 2 + (d / nz) * (k + 0.5);
            windows.add(bx - w / 2 - 0.05, y, bz + oz, 0.12, 1.3, 1.0);
            windows.add(bx + w / 2 + 0.05, y, bz + oz, 0.12, 1.3, 1.0);
          }
        }
      }
    }
  }

  // Залізничні колії: впоперек дороги в клітинці переїзду, далі — крізь сусідні клітинки
  const rails3d: Rail3D[] = [];
  // кілька переїздів на одній лінії (один потяг перетинає кілька доріг) — колії малюємо один раз
  const railDrawn = new Set<string>();
  for (const rl of level.rails ?? []) {
    const p = cellCenter(rl.cell);
    const tracks = rl.tracks ?? 1;
    const span = (Math.max(level.cols, level.rows) + 12) * TILE;
    // дорога N–S ('v') → колії вздовж X, інакше вздовж Z
    const alongX = rl.axis === 'v';
    const lineKey = alongX ? `row${rl.cell[1]}` : `col${rl.cell[0]}`;
    const fresh = !railDrawn.has(lineKey);
    railDrawn.add(lineKey);
    for (let t = 0; fresh && t < tracks; t++) {
      const off = (t - (tracks - 1) / 2) * 4.4;
      const cx = alongX ? span / 2 - 6 * TILE : p.x + off;
      const cz = alongX ? p.z + off : span / 2 - 6 * TILE;
      if (alongX) gravel.add(cx, 0.06, cz, span, 0.12, 3.4);
      else gravel.add(cx, 0.06, cz, 3.4, 0.12, span);
      for (const g of [-0.75, 0.75]) {
        if (alongX) rails.add(cx, 0.2, cz + g, span, 0.16, 0.12);
        else rails.add(cx + g, 0.2, cz, 0.12, 0.16, span);
      }
      for (let k = -span / 2; k < span / 2; k += 1.2) {
        if (alongX) sleepers.add(cx + k, 0.13, cz, 0.35, 0.08, 2.6);
        else sleepers.add(cx, 0.13, cz + k, 2.6, 0.08, 0.35);
      }
    }
    const r3: Rail3D = { cell: rl.cell, axis: rl.axis, go: rl.go, arms: [], lamps: [] };
    if (rl.barrier) {
      // напівшлагбаум і світлофор праворуч на кожному в'їзді
      const dirs: Dir[] = rl.axis === 'v' ? ['N', 'S'] : ['E', 'W'];
      for (const d of dirs) {
        const [dx, dz] = DIR_VEC[d];
        const [rx, rz] = DIR_VEC[RIGHT_OF[d]];
        const b = makeRailBarrier(ROAD_HALF - 0.4);
        const back = tracks * 2.2 + 3.2;
        b.obj.position.set(p.x + rx * (ROAD_HALF + 0.8) - dx * back, 0.35, p.z + rz * (ROAD_HALF + 0.8) - dz * back);
        b.obj.rotation.y = DIR_ANGLE[d];
        add(b.obj);
        b.arm.rotation.z = -Math.PI / 2 + 0.05; // піднята
        r3.arms.push(b.arm);
        r3.lamps.push(...b.lamps);
      }
    }
    rails3d.push(r3);
  }

  // Траса: відбійники вздовж узбіч
  if (scenery === 'highway') {
    for (const [c, r] of allRoad) {
      const n = grid.neighbors(c, r);
      const x0 = c * TILE, z0 = r * TILE;
      if (!n.N) guard.add(x0 + TILE / 2, 0.75, z0 + SIDEWALK - 0.5, TILE, 0.35, 0.12);
      if (!n.S) guard.add(x0 + TILE / 2, 0.75, z0 + TILE - SIDEWALK + 0.5, TILE, 0.35, 0.12);
      if (!n.W) guard.add(x0 + SIDEWALK - 0.5, 0.75, z0 + TILE / 2, 0.12, 0.35, TILE);
      if (!n.E) guard.add(x0 + TILE - SIDEWALK + 0.5, 0.75, z0 + TILE / 2, 0.12, 0.35, TILE);
    }
  }

  for (const b of [asphalt, sidewalk, shoulder, curb, marking, plaza, buildings, roofs, windows, trunks, leaves, rails, gravel, sleepers, guard]) {
    for (const mesh of b.build()) {
      owned.push(mesh);
      add(mesh);
    }
  }

  // Дрібні об'єкти на тротуарах: ліхтарі, гідранти, конуси
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!grid.isRoad(c, r) || grid.pivot(c, r)) continue;
      const n = grid.neighbors(c, r);
      const p = cellCenter([c, r]);
      const sides: [Dir, boolean][] = [['N', n.N], ['S', n.S], ['E', n.E], ['W', n.W]];
      for (const [side, open] of sides) {
        if (open || rand() > 0.45) continue;
        const [dx, dz] = DIR_VEC[side];
        const along = (rand() - 0.5) * (TILE - 8);
        const pos = new THREE.Vector3(
          p.x + dx * (TILE / 2 - SIDEWALK / 2) + (dz !== 0 ? along : 0),
          0.35,
          p.z + dz * (TILE / 2 - SIDEWALK / 2) + (dx !== 0 ? along : 0),
        );
        const roll = rand();
        if (look ? shoulderAt(c, r) : rural) {
          if (scenery === 'highway' || roll > 0.6) continue;
          // słupek prowadzący — білий стовпчик з чорною смугою
          const post = new THREE.Mesh(BOX, mat(0xf4f4f4));
          post.scale.set(0.15, 1.1, 0.15);
          post.position.set(pos.x, 0.9, pos.z);
          const band = new THREE.Mesh(BOX, mat(0x1b1b1b));
          band.scale.set(0.16, 0.2, 0.16);
          band.position.set(pos.x, 1.25, pos.z);
          add(post);
          add(band);
          continue;
        }
        const obj = roll < 0.5 ? makeLamp() : roll < 0.75 ? makeHydrant() : makeCone();
        obj.position.copy(pos);
        obj.rotation.y = DIR_ANGLE[side] - Math.PI / 2;
        add(obj);
      }
    }
  }

  // Знаки на правому узбіччі
  const signs3d: Sign3D[] = [];
  for (const s of level.signs) {
    const p = cellCenter(s.cell);
    const [rx, rz] = DIR_VEC[RIGHT_OF[s.travel]];
    const [dx, dz] = DIR_VEC[s.travel];
    const off = TILE / 2 - SIDEWALK / 2 + 0.3;
    const al = s.along ?? 0;
    // контейнер, усередині якого сам знак — його можна замінити варіантом під питання
    const sign = new THREE.Group();
    sign.add(makeSign(s.type, s.below, s.plate));
    sign.position.set(p.x + rx * off + dx * al, 0.35, p.z + rz * off + dz * al);
    // лицем до водія, який їде в напрямку travel
    sign.rotation.y = DIR_ANGLE[s.travel];
    add(sign);
    signs3d.push({
      setAlt(alt) {
        sign.clear();
        sign.add(alt ? makeSign(alt.type, alt.below, alt.plate) : makeSign(s.type, s.below, s.plate));
      },
    });
    if (s.type === 'B-20') {
      // лінія «стоп» (P-12) наприкінці клітинки, на нашій смузі
      const lx = p.x + dx * (TILE / 2 - 1) + rx * LANE;
      const lz = p.z + dz * (TILE / 2 - 1) + rz * LANE;
      const line = new THREE.Mesh(BOX, mat(C.marking));
      if (dx !== 0) line.scale.set(0.6, 0.04, TILE / 2 - SIDEWALK);
      else line.scale.set(TILE / 2 - SIDEWALK, 0.04, 0.6);
      line.position.set(lx, 0.02, lz);
      add(line);
    }
    if (s.type === 'A-7' || s.below === 'A-7') {
      // лінія P-13 «зуби» наприкінці клітинки, на нашій смузі
      const n = 6;
      const w = (TILE / 2 - SIDEWALK) / n;
      for (let i = 0; i < n; i++) {
        const lat = (i + 0.5) * w;
        const tooth = new THREE.Mesh(TOOTH, mat(C.marking));
        tooth.position.set(p.x + dx * (TILE / 2 - 1.6) + rx * lat, 0.025, p.z + dz * (TILE / 2 - 1.6) + rz * lat);
        tooth.rotation.y = DIR_ANGLE[s.travel];
        add(tooth);
      }
    }
    if (s.type === 'D-15') {
      const shelter = makeBusShelter();
      const sp = sign.position.clone();
      shelter.position.set(sp.x + dx * 4, 0.35, sp.z + dz * 4);
      shelter.rotation.y = DIR_ANGLE[s.travel];
      add(shelter);
    }
  }

  // Фініш
  const route = level.route;
  if (route && route.length > 1 && level.task === 'route') {
    const last = route[route.length - 1];
    const finish = makeFinishLine(TILE - SIDEWALK * 2);
    finish.position.copy(cellCenter(last));
    finish.rotation.y = DIR_ANGLE[dirBetween(route[route.length - 2], last)];
    add(finish);
  }

  // Сценарні та припарковані машини, пішоходи
  const shirts = [0x22c55e, 0xe84f9b, 0x3b82f6, 0xf5a623];
  const actors: Actor3D[] = level.actors.map((a, i) => {
    const p = cellCenter(a.cell);
    const [dx, dz] = DIR_VEC[a.face];
    const [rx, rz] = DIR_VEC[RIGHT_OF[a.face]];
    const color = a.color ?? shirts[i % shirts.length];
    const obj = new THREE.Group();
    let travel = a.travel ?? 0;
    if (a.kind === 'train') {
      obj.position.set(p.x + rx * (a.lateral ?? 0) + dx * (a.along ?? 0), 0.1, p.z + rz * (a.lateral ?? 0) + dz * (a.along ?? 0));
    } else if (a.kind === 'cyclist') {
      const lat = a.lateral ?? ROAD_HALF - 1.2;
      obj.position.set(p.x + rx * lat + dx * (a.along ?? 0), 0, p.z + rz * lat + dz * (a.along ?? 0));
    } else if (a.kind === 'pedestrian' && a.variant === 'worker') {
      // робітник стоїть на узбіччі біля місця робіт
      const lat = a.lateral ?? ROAD_HALF - 0.8;
      obj.position.set(p.x + rx * lat + dx * (a.along ?? 0), 0, p.z + rz * lat + dz * (a.along ?? 0));
      travel = 0;
    } else if (a.kind === 'pedestrian' && a.walk) {
      // іде проїжджою частиною вздовж краю, туди й назад
      const lat = a.lateral ?? ROAD_HALF - 0.5;
      obj.position.set(p.x + rx * lat + dx * (a.along ?? 0), 0, p.z + rz * lat + dz * (a.along ?? 0));
      travel = a.walk;
    } else if (a.kind === 'pedestrian') {
      // стоїть на бордюрі біля «зебри» й переходить на інший бік
      const start = ROAD_HALF + 0.6;
      obj.position.set(p.x - dx * start + rx * (a.along ?? 0), 0.35, p.z - dz * start + rz * (a.along ?? 0));
      travel = start * 2;
    } else {
      const lat = a.lateral ?? (a.kind === 'bus' ? LANE + 1.2 : LANE);
      obj.position.set(p.x + rx * lat + dx * (a.along ?? 0), 0, p.z + rz * lat + dz * (a.along ?? 0));
    }
    obj.rotation.y = DIR_ANGLE[a.face] + ((a.yaw ?? 0) * Math.PI) / 180;
    add(obj);
    const blinkNames = a.blink === 'hazard' ? ['blinkL', 'blinkR'] : [a.blink === 'left' ? 'blinkL' : 'blinkR'];

    const actor: Actor3D = {
      kind: a.kind,
      obj,
      dir: new THREE.Vector3(dx, 0, dz),
      go: a.go,
      travel,
      moved: 0,
      speed: 0,
      maxSpeed: 0,
      moving: false,
      pause: 0,
      halfW: 1,
      halfL: 1,
      home: obj.position.clone(),
      homeDir: new THREE.Vector3(dx, 0, dz),
      homeYaw: obj.rotation.y,
      blink: a.blink,
      walker: a.kind === 'pedestrian' && !!a.walk,
      blinkers: [],
      variant: undefined,
      setVariant(v) {
        const m = actorModel(a, v, color);
        obj.clear();
        obj.add(m.model);
        actor.variant = v;
        actor.halfW = m.halfW;
        actor.halfL = m.halfL;
        actor.maxSpeed = m.maxSpeed;
        actor.blinkers = [];
        if (a.blink) obj.traverse((o) => blinkNames.includes(o.name) && actor.blinkers.push(o));
      },
    };
    actor.setVariant(a.variant);
    return actor;
  });

  // Реквізит: трикутники аварійної зупинки, конуси, бар'єри
  for (const pr of level.props ?? []) {
    const p = cellCenter(pr.cell);
    const [dx, dz] = DIR_VEC[pr.face];
    const [rx, rz] = DIR_VEC[RIGHT_OF[pr.face]];
    const obj = pr.kind === 'triangle' ? makeTriangle() : pr.kind === 'cone' ? makeCone() : makeRoadBarrier();
    const lat = pr.lateral ?? LANE;
    const al = pr.along ?? 0;
    obj.position.set(p.x + rx * lat + dx * al, 0, p.z + rz * lat + dz * al);
    // трикутник дивиться назустріч водієві, що під'їжджає
    obj.rotation.y = DIR_ANGLE[pr.face] + (pr.kind === 'triangle' ? Math.PI : 0);
    add(obj);
  }

  const dispose = () => {
    for (const o of owned) o.dispose();
  };

  return { grid, actors, signs: signs3d, rails: rails3d, dispose };
}

function RIGHT_DIRVEC(d: Dir) {
  return DIR_VEC[RIGHT_OF[d]];
}

let wheelchairMat: THREE.MeshBasicMaterial | null = null;
/** Білий символ візка (P-24) на синьому місці для людей з інвалідністю. */
function wheelchairDecal() {
  if (wheelchairMat) return wheelchairMat;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.strokeStyle = g.fillStyle = '#fff';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(64, 22, 10, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(58, 38);
  g.lineTo(58, 72);
  g.lineTo(88, 72);
  g.lineTo(98, 100);
  g.moveTo(58, 52);
  g.lineTo(82, 52);
  g.stroke();
  g.lineWidth = 7;
  g.beginPath();
  g.arc(56, 88, 24, 0.2, Math.PI * 1.7);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  wheelchairMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
  return wheelchairMat;
}

/** Центр паркувального місця та вісь уздовж руху. */
export function bayFrame(park: { cell: Cell; travel: Dir }) {
  const p = cellCenter(park.cell);
  const [rx, rz] = RIGHT_DIRVEC(park.travel);
  const [ax, az] = DIR_VEC[park.travel];
  return { cx: p.x + rx * BAY_LAT, cz: p.z + rz * BAY_LAT, ax, az };
}
