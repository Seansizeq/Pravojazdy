import * as THREE from 'three';
import type { Cell, Dir, Level } from '../types';
import { BAY_LAT, DIR_VEC, LANE, RIGHT_OF, ROAD_HALF, TILE, bayFrame, cellCenter, type RoadGrid } from '../world/build';
import { lanePath } from '../world/paths';
import type { Car, Controls } from './car';
import type { Navigator } from './nav';

/** Перешкода на дорозі з точки зору автопілота. */
export interface AutoObstacle {
  obj: THREE.Object3D;
  halfW: number;
  halfL: number;
  kind: string;
  moving: boolean;
  /** назавжди нерухомий (розбите чи кинуте авто без сценарію) — можна об'їхати */
  static: boolean;
  /** пішохід або велосипедист: пропускаємо, де б на проїжджій частині він не був */
  vulnerable?: boolean;
  /** швидкість (м/с, вектор) — для прогнозу перетину траєкторій */
  vel: THREE.Vector3;
}

export interface AutoContext {
  car: Car;
  nav: Navigator;
  grid: RoadGrid;
  level: Level;
  /** чинний ліміт швидкості, км/год */
  limit: number;
  obstacles: AutoObstacle[];
  /** переїзди, де зараз небезпечно (потяг або шлагбаум) */
  rails: { cell: Cell; danger: boolean }[];
  stopSigns: { cell: Cell; travel: Dir }[];
}

const STEP = 1; // крок дискретизації траєкторії, м
const DECEL = 3; // з яким сповільненням плануємо зупинки, м/с²
const CAR_HALF_L = 2.15;
const CAR_HALF_W = 1.05;
const TURN_SPEED = 5.5; // ≈ 20 км/год у поворотах

/**
 * Автопілот: їде маршрутом навігатора по своїй смузі, тримає ліміт, гальмує перед поворотами,
 * зупиняється на STOP, пропускає пішоходів, чекає потяг, об'їжджає нерухомі перешкоди й паркується.
 */
export class Autopilot {
  private pts: THREE.Vector3[] = [];
  private dirs: THREE.Vector3[] = [];
  private route: Cell[] | null = null;
  private idx = 0;
  private offset = 0;
  private offsetUntil = 0;
  private blockedTime = 0;
  private stopWait = 0;
  private doneStops = new Set<string>();
  private park: { t: number; p: THREE.Vector3[] } | null = null;
  private parked = false;

  reset() {
    this.route = null;
    this.pts = [];
    this.idx = 0;
    this.offset = 0;
    this.blockedTime = 0;
    this.stopWait = 0;
    this.doneStops.clear();
    this.park = null;
    this.parked = false;
  }

  /** Траєкторія по правій смузі вздовж маршруту з кроком STEP. */
  private build(route: Cell[], grid: RoadGrid) {
    const raw: THREE.Vector3[] = [];
    const dir = (a: Cell, b: Cell): Dir => (b[0] > a[0] ? 'E' : b[0] < a[0] ? 'W' : b[1] > a[1] ? 'S' : 'N');
    for (let i = 0; i < route.length; i++) {
      const inDir = i > 0 ? dir(route[i - 1], route[i]) : dir(route[0], route[1]);
      const outDir = i < route.length - 1 ? dir(route[i], route[i + 1]) : inDir;
      for (const p of lanePath(route[i], inDir, outDir, grid.isRoundabout(route[i][0], route[i][1]))) {
        if (!raw.length || raw[raw.length - 1].distanceTo(p) > 0.05) raw.push(p);
      }
    }
    this.pts = [];
    for (let i = 1; i < raw.length; i++) {
      const seg = raw[i].distanceTo(raw[i - 1]);
      const n = Math.max(1, Math.round(seg / STEP));
      for (let k = 0; k < n; k++) this.pts.push(raw[i - 1].clone().lerp(raw[i], k / n));
    }
    this.pts.push(raw[raw.length - 1].clone());
    this.dirs = this.pts.map((_, i) => {
      const a = this.pts[Math.max(0, i - 1)], b = this.pts[Math.min(this.pts.length - 1, i + 1)];
      return b.clone().sub(a).setY(0).normalize();
    });
    this.idx = 0;
    this.route = route;
  }

  /** Найближча точка траєкторії до pos у вікні навколо поточної. */
  private project(pos: THREE.Vector3) {
    let best = this.idx, bd = Infinity;
    for (let k = Math.max(0, this.idx - 6); k < Math.min(this.pts.length, this.idx + 40); k++) {
      const d = (this.pts[k].x - pos.x) ** 2 + (this.pts[k].z - pos.z) ** 2;
      if (d < bd) [bd, best] = [d, k];
    }
    this.idx = best;
  }

  /** Індекс точки траєкторії біля p (якщо вона поруч із траєкторією попереду) або -1. */
  private find(p: THREE.Vector3, from: number, to: number, maxDist = 3) {
    let best = -1, bd = maxDist * maxDist;
    for (let k = Math.max(0, from); k < Math.min(this.pts.length, to); k++) {
      const d = (this.pts[k].x - p.x) ** 2 + (this.pts[k].z - p.z) ** 2;
      if (d < bd) [bd, best] = [d, k];
    }
    return best;
  }

  private right(k: number) {
    const d = this.dirs[k];
    return new THREE.Vector3(-d.z, 0, d.x);
  }

  update(dt: number, ctx: AutoContext): Controls {
    const { car, nav } = ctx;
    const idle: Controls = { enabled: true, gas: false, brake: Math.abs(car.speed) > 0.3, steer: 0 };

    if (ctx.level.task === 'park' && ctx.level.park && nav.finished) return this.parkStep(dt, ctx);
    if (!nav.active) return idle;
    if (this.route !== nav.route) this.build(nav.route, ctx.grid);
    this.project(car.pos);

    const v = car.speed;
    const horizon = Math.min(this.pts.length - 1, this.idx + Math.ceil((v * v) / (2 * DECEL) + 35));
    let vTarget = Math.min(car.maxFwd, Math.max(2, (ctx.limit - 4) / 3.6));
    const want = (d: number, vAt = 0) => {
      vTarget = Math.min(vTarget, Math.sqrt(Math.max(0, vAt * vAt + 2 * DECEL * Math.max(0, d))));
    };

    // повороти й рондо попереду: заздалегідь скидаємо швидкість
    for (let k = this.idx; k < horizon - 3; k++) {
      const turn = Math.acos(THREE.MathUtils.clamp(this.dirs[k].dot(this.dirs[k + 3]), -1, 1));
      if (turn > 0.12) {
        want((k - this.idx) * STEP - 2, TURN_SPEED);
        break;
      }
    }

    // кінець маршруту (таксі, вільна їзда): зупиняємось у центрі клітинки-цілі
    if (ctx.level.task === 'taxi' || ctx.level.task === 'free') {
      const end = this.find(cellCenter(nav.route[nav.route.length - 1]), this.idx, this.pts.length, 6);
      if (end >= 0) want((end - this.idx) * STEP);
    }

    // знак STOP: повна зупинка перед лінією
    for (const s of ctx.stopSigns) {
      const key = `${s.cell.join(',')},${s.travel}`;
      if (this.doneStops.has(key)) continue;
      const c = cellCenter(s.cell);
      const [dx, dz] = DIR_VEC[s.travel];
      const [rx, rz] = DIR_VEC[RIGHT_OF[s.travel]];
      const line = new THREE.Vector3(c.x + dx * (TILE / 2 - 1) + rx * LANE, 0, c.z + dz * (TILE / 2 - 1) + rz * LANE);
      const k = this.find(line, this.idx - 4, horizon + 10, 2.5);
      if (k < 0) continue;
      const d = (k - this.idx) * STEP - CAR_HALF_L - 0.6;
      if (d < 3 && Math.abs(v) < 0.2) {
        this.stopWait += dt;
        if (this.stopWait > 1.2) {
          this.doneStops.add(key);
          this.stopWait = 0;
        }
      }
      if (!this.doneStops.has(key)) want(d);
    }

    // переїзд: поки небезпечно — стоїмо перед ним (якщо ще не на коліях)
    for (const r of ctx.rails) {
      if (!r.danger) continue;
      const k = this.find(cellCenter(r.cell), this.idx - 2, horizon + 20, 6);
      if (k < 0) continue;
      const d = (k - this.idx) * STEP - 9 - CAR_HALF_L;
      if (d > -2) want(d);
    }

    // перешкоди на смузі: машини, автобуси, пішоходи, велосипедисти, потяги
    let blocker: { s: number; o: AutoObstacle; ext: number } | null = null;
    const look = Math.min(this.pts.length, this.idx + 55);
    for (const o of ctx.obstacles) {
      const p = o.obj.position;
      const k = this.find(p, this.idx - 2, look, 9);
      if (k < 0) continue;
      const rgt = this.right(k);
      const rel = p.clone().sub(this.pts[k]);
      const lat = rel.dot(rgt) + this.offset;
      // напрямок перешкоди відносно траєкторії
      const fwd = new THREE.Vector3(-Math.sin(o.obj.rotation.y), 0, -Math.cos(o.obj.rotation.y));
      const cos = Math.abs(fwd.dot(this.dirs[k])), sin = Math.sqrt(Math.max(0, 1 - cos * cos));
      const extW = cos * o.halfW + sin * o.halfL;
      const extL = cos * o.halfL + sin * o.halfW;
      // пішохода/велосипедиста пропускаємо, поки він будь-де на проїжджій частині (вісь дороги — на LANE ліворуч)
      if (o.vulnerable ? Math.abs(lat + LANE) > ROAD_HALF + 0.3 : Math.abs(lat) > extW + CAR_HALF_W + 0.1) continue;
      const s = (k - this.idx) * STEP + rel.dot(this.dirs[k]);
      if (s < -extL) continue;
      const d = s - extL - CAR_HALF_L - (o.vulnerable ? 3 : 2.5);
      want(d);
      if (!blocker || s < blocker.s) blocker = { s, o, ext: extL };
    }

    // перетин траєкторій (поворот ліворуч, рівнозначне перехрестя): де машина перетне нашу траєкторію
    // і коли туди приїде вона та ми. Якщо майже одночасно — пропускаємо її, чекаючи перед місцем перетину.
    const reach = Math.min(this.pts.length, this.idx + 60);
    for (const o of ctx.obstacles) {
      if (!o.moving || o.vulnerable) continue;
      const sp = o.vel.length();
      const dirO = sp > 0.05 ? o.vel.clone().divideScalar(sp) : new THREE.Vector3(-Math.sin(o.obj.rotation.y), 0, -Math.cos(o.obj.rotation.y));
      // сценарна машина, що щойно рушила, — вважаємо, що вже їде; трафік — з його реальною швидкістю
      const speedO = Math.max(sp, o.kind === 'car' || o.kind === 'bus' || o.kind === 'police' ? 3 : 0);
      if (speedO < 0.5 || o.obj.position.distanceTo(car.pos) > 80) continue;
      for (let t = 0; t <= 6; t += 0.2) {
        const ox = o.obj.position.x + dirO.x * speedO * t, oz = o.obj.position.z + dirO.z * speedO * t;
        let kc = -1;
        for (let k = this.idx; k < reach; k += 2) {
          if ((this.pts[k].x - ox) ** 2 + (this.pts[k].z - oz) ** 2 < 3.4 * 3.4) {
            kc = k;
            break;
          }
        }
        if (kc < 0) continue;
        // попутна машина в нашій смузі — це не перетин (її веде блок «перешкоди»)
        if (dirO.dot(this.dirs[kc]) > 0.7) break;
        const dist = (kc - this.idx) * STEP;
        const tUs = dist / Math.max(Math.abs(v), 3);
        // ми приїдемо майже одночасно з нею (або одразу після) — пропускаємо
        if (tUs > t - 3 && tUs < t + 2.5 && dist - 7 > -2) want(dist - 7);
        break;
      }
    }

    // нерухома перешкода (ДТП, кинуте авто): постояли — об'їжджаємо зліва
    if (blocker && blocker.o.static && Math.abs(v) < 0.3 && blocker.s < 14) this.blockedTime += dt;
    else if (!blocker) this.blockedTime = 0;
    if (this.blockedTime > 1.5 && this.offset === 0 && blocker && this.oncomingClear(ctx, 4)) {
      this.offset = 4;
      this.offsetUntil = this.idx + Math.ceil(blocker.s + blocker.ext + 8);
      this.blockedTime = 0;
    }
    if (this.offset && this.idx > this.offsetUntil) this.offset = 0;

    // рульове: точка попереду на траєкторії (з урахуванням об'їзду)
    const ahead = Math.min(this.pts.length - 1, this.idx + Math.round(THREE.MathUtils.clamp(4 + Math.abs(v) * 0.5, 4, 14) / STEP));
    const target = this.pts[ahead].clone().addScaledVector(this.right(ahead), -this.offset);
    return { enabled: true, steer: this.steerTo(car, target), ...this.pedals(v, vTarget) };
  }

  /** Чи вільна зустрічна смуга для об'їзду. */
  private oncomingClear(ctx: AutoContext, offset: number) {
    for (const o of ctx.obstacles) {
      if (!o.moving) continue;
      const k = this.find(o.obj.position, this.idx, this.idx + 60, 10);
      if (k < 0) continue;
      const lat = o.obj.position.clone().sub(this.pts[k]).dot(this.right(k)) + offset;
      if (Math.abs(lat) < 3) return false;
    }
    return true;
  }

  private steerTo(car: Car, target: THREE.Vector3) {
    const want = Math.atan2(-(target.x - car.pos.x), -(target.z - car.pos.z));
    let diff = want - car.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return THREE.MathUtils.clamp(diff * 2.6, -1, 1);
  }

  /** Газ/гальмо (кнопки, не педаль): з гістерезисом довкола цільової швидкості. */
  private pedals(v: number, vTarget: number) {
    if (vTarget < 0.3) return { gas: false, brake: v > 0.3 };
    if (v < vTarget - 0.4) return { gas: true, brake: false };
    if (v > vTarget + 0.7) return { gas: false, brake: true };
    return { gas: false, brake: false };
  }

  /** Паркування: під'їзд смугою до заднього краю місця, далі плавний заїзд (як паркувальний асистент). */
  private parkStep(dt: number, ctx: AutoContext): Controls {
    const { car } = ctx;
    const park = ctx.level.park!;
    const { cx, cz, ax, az } = bayFrame(park);
    const bay = new THREE.Vector3(cx, 0, cz);
    const along = new THREE.Vector3(ax, 0, az);
    const rgt = new THREE.Vector3(-az, 0, ax);
    const lane = bay.clone().addScaledVector(rgt, -(BAY_LAT - LANE));
    const al = car.pos.clone().sub(bay).dot(along);
    const stay: Controls = { enabled: true, gas: false, brake: Math.abs(car.speed) > 0.3, steer: 0 };
    if (this.parked) return stay;

    if (this.park) {
      // крива Безьє від смуги до центру місця; курс — за дотичною
      this.park.t = Math.min(1, this.park.t + dt / 3.2);
      const t = this.park.t * this.park.t * (3 - 2 * this.park.t);
      const [p0, p1, p2, p3] = this.park.p;
      const u = 1 - t;
      const pos = p0.clone().multiplyScalar(u * u * u)
        .addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
      const tan = p1.clone().sub(p0).multiplyScalar(3 * u * u)
        .addScaledVector(p2.clone().sub(p1), 6 * u * t).addScaledVector(p3.clone().sub(p2), 3 * t * t);
      car.pos.copy(pos);
      if (tan.lengthSq() > 1e-6) car.heading = Math.atan2(-tan.x, -tan.z);
      car.speed = 0;
      car.sync();
      if (this.park.t >= 1) this.parked = true;
      return { enabled: true, gas: false, brake: false, steer: 0 };
    }

    // під'їзд по смузі до точки за 3,4 м перед центром місця
    const stopAt = -3.4;
    const d = stopAt - al;
    if (d < 0.4 && Math.abs(car.speed) < 0.4) {
      const p0 = car.pos.clone();
      this.park = {
        t: 0,
        p: [p0, p0.clone().addScaledVector(along, 1.6), bay.clone().addScaledVector(along, -1.6), bay.clone()],
      };
      return stay;
    }
    const target = lane.clone().addScaledVector(along, Math.max(al + 5, stopAt + 1));
    const vT = Math.min(5, Math.sqrt(Math.max(0, 2 * DECEL * Math.max(0, d - 0.3))));
    return { enabled: true, steer: this.steerTo(car, target), ...this.pedals(car.speed, vT) };
  }
}
