import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Cell, Dir } from '../types';
import { DIR_VEC, OPP, TILE, cellCenter, type RoadGrid } from '../world/build';
import { makeCar, mat } from '../world/models';
import { lanePath, pathLength, pointAt } from '../world/paths';

const COLORS = [0x4f8fe6, 0xe66a4f, 0x9b6be6, 0xf2f2f2, 0x3ccf7a, 0xf5a623, 0x5a6270, 0xe84f9b];

/** Машини тримаються навколо гравця: ті, що відстали далі за FAR (м), з'являються знову ближче — поза кадром. */
const FAR = 190;
const NEAR = 70;

/**
 * Модель машини трафіку, злита в три геометрії: деталі кольору кузова (колір — на кожну машину),
 * решта деталей (кольори вершин) і передні фари (спільний матеріал, що світиться вночі).
 * Усі машини трафіку малюються трьома InstancedMesh замість ~20 мешів на кожну.
 */
let template: { body: THREE.BufferGeometry; rest: THREE.BufferGeometry; lamps: THREE.BufferGeometry } | null = null;
function carTemplate() {
  if (template) return template;
  const BODY = 0xff00ff; // мітка деталей кольору кузова
  const g = makeCar(BODY);
  g.updateMatrixWorld(true);
  const body: THREE.BufferGeometry[] = [], rest: THREE.BufferGeometry[] = [], lamps: THREE.BufferGeometry[] = [];
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible) return;
    const color = (o.material as THREE.MeshLambertMaterial).color;
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    if (color.getHex() === BODY) body.push(geo);
    else if (color.getHex() === 0xfff6c8) lamps.push(geo);
    else {
      const n = geo.attributes.position.count;
      const cols = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) cols.set([color.r, color.g, color.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      rest.push(geo);
    }
  });
  template = { body: mergeGeometries(body)!, rest: mergeGeometries(rest)!, lamps: mergeGeometries(lamps)! };
  return template;
}
const BODY_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff });
const REST_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

export interface TrafficCar {
  /** положення й поворот машини (сама модель малюється спільними InstancedMesh) */
  obj: THREE.Group;
  cell: Cell;
  inDir: Dir;
  outDir: Dir;
  path: THREE.Vector3[];
  len: number;
  s: number;
  speed: number;
  /** швидкість (м/с) за ліміту 50 км/год; деінде — пропорційно до ліміту */
  max: number;
  heading: number;
  halfW: number;
  halfL: number;
  /** скільки секунд стоїть посеред перехрестя (щоб розв'язати взаємне очікування) */
  stuck: number;
  /** простояла надто довго — проїжджає перехрестя, не чекаючи інших, аж до виїзду з нього */
  force: boolean;
}

/** Прості машини міста: їдуть своєю смугою, на перехрестях обирають випадковий напрям. */
export class Traffic {
  cars: TrafficCar[] = [];
  private occupied = new Map<string, number>();
  private meshes: THREE.InstancedMesh[] = [];
  /** прямі клітинки, де машина може з'явитися, з напрямками руху */
  private spots: { cell: Cell; dirs: Dir[]; center: THREE.Vector3 }[] = [];
  private recycleIn = 0;
  /** місця сценарних машин: трафік не з'являється на них і поруч */
  private keepClear: THREE.Vector3[] = [];
  /** клітинки, де в смузі стоїть сценарна машина й чекає свого питання: трафік чекає перед ними (оновлює гра) */
  blocked = new Set<string>();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private one = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private parent: THREE.Object3D, private grid: RoadGrid) {
    const { level } = grid;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (!grid.isRoad(c, r) || grid.isRoundabout(c, r)) continue;
        const ex = grid.exits(c, r);
        // лише прямі клітинки з двома протилежними виїздами
        if (ex.length === 2 && ex[0] === OPP[ex[1]]) this.spots.push({ cell: [c, r], dirs: ex, center: cellCenter([c, r]) });
      }
    }
  }

  /** Машини їдуть пропорційно до ліміту там, де вони зараз: за містом швидше, у населеному пункті й Tempo 30 — повільніше. */
  private speedScale([c, r]: Cell) {
    const { level } = this.grid;
    const zone = level.zones?.find((z) => c >= z.from[0] && c <= z.to[0] && r >= z.from[1] && r <= z.to[1]);
    return Math.min(2.4, Math.max(0.75, (zone?.limit ?? level.limit ?? 50) / 50));
  }

  clear() {
    for (const m of this.meshes) {
      this.parent.remove(m);
      m.dispose();
    }
    this.meshes = [];
    this.cars = [];
  }

  /** Чи вільна клітинка від сценарних машин (у межах ~однієї клітинки). */
  private clearOfScene(center: THREE.Vector3) {
    return !this.keepClear.some((p) => p.distanceToSquared(center) < 16 * 16);
  }

  /**
   * Розставляє count машин на прямих ділянках: спершу ближче до гравця (але не впритул), далі — решта карти.
   * keepClear — де стоять сценарні машини (на них трафік не ставимо).
   */
  spawn(count: number, avoid: Cell, keepClear: THREE.Vector3[] = []) {
    this.clear();
    this.keepClear = keepClear;
    if (!count) return;
    const at = cellCenter(avoid);
    const free = this.spots.filter(
      (sp) => Math.abs(sp.cell[0] - avoid[0]) + Math.abs(sp.cell[1] - avoid[1]) >= 4 && this.clearOfScene(sp.center),
    );
    free.sort(() => Math.random() - 0.5);
    // спершу клітинки в межах видимого радіуса — щоб на великій карті машини не розсипалися по околицях
    free.sort((a, b) => +(a.center.distanceTo(at) > FAR) - +(b.center.distanceTo(at) > FAR));
    for (const sp of free.slice(0, count)) {
      const dir = sp.dirs[Math.random() < 0.5 ? 0 : 1];
      const path = lanePath(sp.cell, dir, dir, false);
      const car: TrafficCar = {
        obj: new THREE.Group(), cell: sp.cell, inDir: dir, outDir: dir, path, len: pathLength(path),
        s: Math.random() * 10, speed: 0, max: 7 + Math.random() * 3,
        heading: 0, halfW: 1.0, halfL: 2.15, stuck: 0, force: false,
      };
      this.place(car, true);
      this.cars.push(car);
    }
    const t = carTemplate();
    const n = this.cars.length;
    this.meshes = [
      new THREE.InstancedMesh(t.body, BODY_MAT, n),
      new THREE.InstancedMesh(t.rest, REST_MAT, n),
      new THREE.InstancedMesh(t.lamps, mat(0xfff6c8), n),
    ];
    const color = new THREE.Color();
    this.cars.forEach((_, i) => this.meshes[0].setColorAt(i, color.setHex(COLORS[Math.floor(Math.random() * COLORS.length)])));
    for (const m of this.meshes) {
      m.castShadow = true;
      m.receiveShadow = true;
      // машини розкидані по карті — відсікати весь набір за однією сферою не можна
      m.frustumCulled = false;
      this.parent.add(m);
    }
    this.sync();
  }

  /** Матриці екземплярів з положень машин. */
  private sync() {
    this.cars.forEach((car, i) => {
      this.tmpQ.setFromAxisAngle(this.up, car.heading);
      this.tmpM.compose(car.obj.position, this.tmpQ, this.one);
      for (const m of this.meshes) m.setMatrixAt(i, this.tmpM);
    });
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  /**
   * Машина, що відстала від гравця далі за FAR, з'являється на вільній прямій ділянці на відстані NEAR…FAR−30 —
   * поза кадром, щоб ніхто не бачив, як вона виникає. Так на великій карті навколо гравця завжди людно.
   */
  private recycle(center: THREE.Vector3, frustum?: THREE.Frustum) {
    const sphere = new THREE.Sphere(new THREE.Vector3(), TILE * 0.75);
    for (const car of this.cars) {
      if (car.obj.position.distanceTo(center) <= FAR) continue;
      const options = this.spots.filter((sp) => {
        const d = sp.center.distanceTo(center);
        if (d < NEAR || d > FAR - 30) return false;
        if (frustum && frustum.intersectsSphere(sphere.set(sp.center, TILE * 0.75))) return false;
        if (!this.clearOfScene(sp.center)) return false;
        return !this.cars.some((o) => o !== car && o.obj.position.distanceToSquared(sp.center) < 18 * 18);
      });
      if (!options.length) return;
      const sp = options[Math.floor(Math.random() * options.length)];
      const dir = sp.dirs[Math.random() < 0.5 ? 0 : 1];
      car.cell = sp.cell;
      car.inDir = car.outDir = dir;
      car.path = lanePath(sp.cell, dir, dir, false);
      car.len = pathLength(car.path);
      car.s = Math.random() * car.len * 0.5;
      car.speed = car.max * this.speedScale(sp.cell) * 0.8;
      car.stuck = 0;
      car.force = false;
      this.place(car, true);
    }
  }

  private chooseNext(cell: Cell, inDir: Dir): Dir {
    const exits = this.grid.exits(cell[0], cell[1]);
    const all = exits.filter((d) => d !== OPP[inDir]);
    if (!all.length) return OPP[inDir];
    // на перехресті — не туди, де стоїть сценарна машина (якщо є інший шлях; інакше чекаємо перед нею)
    const free = all.filter((d) => !this.blocked.has(`${cell[0] + DIR_VEC[d][0]},${cell[1] + DIR_VEC[d][1]}`));
    const options = free.length ? free : all;
    // прямо — трохи частіше
    const weighted = options.flatMap((d) => (d === inDir ? [d, d] : [d]));
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  private place(car: TrafficCar, snap = false) {
    const { pos, dir } = pointAt(car.path, car.s);
    car.obj.position.copy(pos);
    const target = Math.atan2(-dir.x, -dir.z);
    if (snap) car.heading = target;
    else {
      let diff = target - car.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      car.heading += diff * 0.25;
    }
    car.obj.rotation.y = car.heading;
  }

  /**
   * railStop — клітинки переїздів, до яких зараз наближається потяг: перед ними машини чекають.
   * view — довкола чого тримати трафік і що зараз у кадрі (щоб машини не виникали на очах).
   */
  update(
    dt: number, player: { pos: THREE.Vector3; cell: Cell; heading?: number; speed?: number }, pedestrians: THREE.Vector3[] = [], railStop: Cell[] = [],
    view?: { center: THREE.Vector3; frustum?: THREE.Frustum },
  ) {
    if (view && (this.recycleIn -= dt) <= 0) {
      this.recycleIn = 0.5;
      this.recycle(view.center, view.frustum);
    }
    // хто зараз стоїть на перехрестях
    this.occupied.clear();
    const occ = (c: Cell, id: number) => {
      const k = c.join(',');
      if (!this.occupied.has(k)) this.occupied.set(k, id);
    };
    occ(player.cell, -1);
    this.cars.forEach((car, i) => occ(this.grid.cellAt(car.obj.position.x, car.obj.position.z), i));

    this.cars.forEach((car, i) => {
      const cruise = car.max * this.speedScale(car.cell);
      let target = cruise;
      // у поворотах і на рондо — не швидше ≈ 22 км/год
      if (car.inDir !== car.outDir || this.grid.isRoundabout(car.cell[0], car.cell[1])) target = Math.min(target, 6);
      const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
      const me = car.obj.position;

      // перешкода попереду (гравець або інша машина); що швидше їде машина, то далі «дивиться»
      const range = 11 + car.speed * 1.2;
      const check = (p: THREE.Vector3, heading?: number) => {
        const dx = p.x - me.x, dz = p.z - me.z;
        if (dx * dx + dz * dz > range * range) return;
        const along = dx * fx + dz * fz;
        const lateral = Math.abs(dx * fz - dz * fx);
        // зблизька ширший сектор — лише для машини, що їде приблизно туди ж (попереду в повороті);
        // поперечні машини на перехресті чи на іншому боці рондо так не блокують одна одну
        const same = heading !== undefined && Math.abs(Math.atan2(Math.sin(heading - car.heading), Math.cos(heading - car.heading))) < 1;
        if (along > 0 && along < range && lateral < (along < 12 && same ? 4 : 2.8)) {
          target = Math.min(target, along < 6 ? 0 : (cruise * (along - 6)) / (range - 6));
        }
      };
      pedestrians.forEach((p) => check(p));
      // на колі рондо пріоритет у тих, хто вже їде по ньому: на машини, що стоять на в'їзді, не зважаємо
      const onRing = this.grid.isRoundabout(car.cell[0], car.cell[1]);
      // застрягли посеред перехрестя (машини чекають одна одну) — після 4 с проїжджаємо
      const inJunction = this.grid.isJunction(car.cell[0], car.cell[1]);
      car.stuck = inJunction && car.speed < 0.3 ? car.stuck + dt : 0;
      if (car.stuck > 4) car.force = true;
      // гравець і машина посеред перехрестя чекають одне одного (обоє повертають) — машина проїжджає першою
      if (!(car.force && Math.abs(player.speed ?? 0) < 0.5)) check(player.pos, player.heading);
      this.cars.forEach((o, j) => {
        if (j === i || car.force) return;
        if (onRing && o.speed < 0.5 && !this.grid.isRoundabout(o.cell[0], o.cell[1])) return;
        check(o.obj.position, o.heading);
      });

      // перед перехрестям чекаємо, поки воно звільниться
      const [dx, dz] = DIR_VEC[car.outDir];
      const next: Cell = [car.cell[0] + dx, car.cell[1] + dz];
      // перед рондо чекаємо раніше, щоб не залазити на коло
      const wait = this.grid.isRoundabout(next[0], next[1]) ? 6 : 3.5;
      if (car.len - car.s < wait && this.grid.isJunction(next[0], next[1])) {
        const who = this.occupied.get(next.join(','));
        if (who !== undefined && who !== i) target = 0;
      }
      if (car.len - car.s < 3.5 && railStop.some((c) => c[0] === next[0] && c[1] === next[1])) target = 0;
      // у наступній клітинці стоїть сценарна машина (чекає свого питання) — чекаємо перед нею у своїй смузі,
      // а не розвертаємося посеред дороги (так можна заблокувати гравця)
      if (car.len - car.s < 3.5 && this.blocked.has(next.join(','))) target = 0;

      const rate = target > car.speed ? 3 : 9;
      car.speed += THREE.MathUtils.clamp(target - car.speed, -rate * dt, rate * dt);
      car.s += car.speed * dt;

      // перехід у наступну клітинку
      while (car.s >= car.len) {
        const [nx, nz] = DIR_VEC[car.outDir];
        car.s -= car.len;
        car.cell = [car.cell[0] + nx, car.cell[1] + nz];
        car.force = false;
        car.inDir = car.outDir;
        car.outDir = this.chooseNext(car.cell, car.inDir);
        car.path = lanePath(car.cell, car.inDir, car.outDir, this.grid.isRoundabout(car.cell[0], car.cell[1]));
        car.len = pathLength(car.path);
      }
      this.place(car);
    });
    this.sync();
  }
}
