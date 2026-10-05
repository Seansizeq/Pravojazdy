import * as THREE from 'three';

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

export const BOX = new THREE.BoxGeometry(1, 1, 1);

export function mat(color: number, opts: { emissive?: number; transparent?: boolean; opacity?: number } = {}) {
  const key = `${color}|${opts.emissive ?? 0}|${opts.opacity ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      emissive: opts.emissive ?? 0x000000,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}

export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(BOX, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** Сторона квадрата (м), на які ділиться набір: камера й тіні малюють лише видимі квадрати великої карти. */
const CHUNK = 160;

/** Набір однакових примітивів → кілька InstancedMesh, по одному на квадрат карти (дешево для GPU). */
export class Batch {
  private items: { m: THREE.Matrix4; c?: THREE.Color }[] = [];
  private tmpQ = new THREE.Quaternion();
  private tmpE = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(
    private geometry: THREE.BufferGeometry,
    private material: THREE.Material,
    private cast = false,
    private receive = true,
  ) {}

  /** rx, rz — нахил після повороту ry (наприклад, листя пальми, що звисає). */
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, color?: number, rx = 0, rz = 0) {
    this.tmpE.set(rx, ry, rz);
    this.tmpQ.setFromEuler(this.tmpE);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      this.tmpQ,
      new THREE.Vector3(sx, sy, sz),
    );
    this.items.push({ m, c: color !== undefined ? new THREE.Color(color) : undefined });
  }

  build(): THREE.InstancedMesh[] {
    const chunks = new Map<string, { m: THREE.Matrix4; c?: THREE.Color }[]>();
    for (const it of this.items) {
      const key = `${Math.floor(it.m.elements[12] / CHUNK)},${Math.floor(it.m.elements[14] / CHUNK)}`;
      const list = chunks.get(key);
      if (list) list.push(it);
      else chunks.set(key, [it]);
    }
    return [...chunks.values()].map((list) => {
      const mesh = new THREE.InstancedMesh(this.geometry, this.material, list.length);
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        if (it.c) mesh.setColorAt(i, it.c);
      });
      mesh.castShadow = this.cast;
      mesh.receiveShadow = this.receive;
      mesh.computeBoundingSphere();
      return mesh;
    });
  }
}

function wheel() {
  const g = geo('wheel', () => new THREE.CylinderGeometry(0.42, 0.42, 0.36, 12).rotateZ(Math.PI / 2));
  const m = new THREE.Mesh(g, mat(0x222222));
  m.castShadow = true;
  return m;
}

function addWheels(g: THREE.Group, halfW: number, front: number, back: number) {
  for (const x of [-halfW, halfW]) {
    for (const z of [front, back]) {
      const w = wheel();
      w.position.set(x, 0.42, z);
      g.add(w);
    }
  }
}

function lights(g: THREE.Group, halfW: number, halfL: number, y: number) {
  for (const x of [-halfW + 0.35, halfW - 0.35]) {
    g.add(box(0.4, 0.2, 0.08, 0xfff6c8, x, y, -halfL - 0.02, false));
    g.add(box(0.4, 0.18, 0.08, 0xd8262c, x, y, halfL + 0.02, false));
  }
  // поворотники на кутах (перед — -Z, ліворуч — -X); вмикаються з гри
  for (const side of [-1, 1]) {
    for (const z of [-halfL - 0.05, halfL + 0.05]) {
      const b = box(0.32, 0.22, 0.14, 0xffa31a, side * (halfW + 0.03), y + 0.02, z, false);
      b.material = mat(0xffa31a, { emissive: 0xff8c00 });
      b.name = side < 0 ? 'blinkL' : 'blinkR';
      b.visible = false;
      g.add(b);
    }
  }
}

/** Легкове авто. Перед — у напрямку -Z. */
export function makeCar(color: number, opts: { rack?: boolean; police?: boolean } = {}) {
  const g = new THREE.Group();
  const body = opts.police ? 0x1d1d22 : color;
  g.add(box(2.0, 0.7, 4.3, body, 0, 0.75, 0));
  if (opts.police) g.add(box(2.02, 0.5, 1.8, 0xf4f4f4, 0, 0.8, 0.1));
  g.add(box(1.72, 0.62, 2.1, 0x2a3440, 0, 1.4, 0.35));
  g.add(box(1.78, 0.12, 2.0, opts.police ? 0xf4f4f4 : color, 0, 1.76, 0.35));
  g.add(box(2.06, 0.18, 0.25, 0x9a9a9a, 0, 0.5, -2.18, false));
  g.add(box(2.06, 0.18, 0.25, 0x9a9a9a, 0, 0.5, 2.18, false));
  addWheels(g, 0.95, -1.35, 1.35);
  lights(g, 1.0, 2.15, 0.85);

  if (opts.rack) {
    for (const x of [-0.75, 0.75]) g.add(box(0.08, 0.08, 2.1, 0xd9d9d9, x, 1.98, 0.35, false));
    for (const z of [-0.4, 0.35, 1.1]) g.add(box(1.6, 0.06, 0.06, 0xd9d9d9, 0, 1.98, z, false));
    // вихлопні труби, як на референсі
    for (const x of [-0.7, 0.7]) g.add(box(0.14, 0.9, 0.14, 0xcfcfcf, x, 1.45, -1.0, false));
  }
  if (opts.police) {
    g.add(box(0.7, 0.18, 0.4, 0xff2a2a, -0.38, 1.92, 0.4, false));
    g.add(box(0.7, 0.18, 0.4, 0x2a5bff, 0.38, 1.92, 0.4, false));
  }
  return g;
}

export function makeBus(color = 0xd8262c) {
  const g = new THREE.Group();
  g.add(box(2.5, 2.4, 11, color, 0, 1.75, 0));
  g.add(box(2.54, 0.9, 10.2, 0x2a3440, 0, 2.2, 0.2));
  g.add(box(2.56, 0.5, 11.02, 0xffc83d, 0, 0.8, 0));
  g.add(box(2.3, 0.15, 10.4, 0xe8e8e8, 0, 3.0, 0));
  addWheels(g, 1.15, -3.6, 3.4);
  lights(g, 1.25, 5.5, 1.0);
  return g;
}

export function makeCone() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    geo('cone', () => new THREE.ConeGeometry(0.35, 0.9, 8)),
    mat(0xe4483f),
  );
  cone.position.y = 0.55;
  cone.castShadow = true;
  g.add(cone);
  const stripe = new THREE.Mesh(
    geo('coneStripe', () => new THREE.CylinderGeometry(0.21, 0.26, 0.16, 8)),
    mat(0xffffff),
  );
  stripe.position.y = 0.6;
  g.add(stripe);
  g.add(box(0.8, 0.1, 0.8, 0xe4483f, 0, 0.05, 0, false));
  return g;
}

export function makeHydrant() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo('hyd', () => new THREE.CylinderGeometry(0.22, 0.26, 0.9, 8)), mat(0xd8262c));
  body.position.y = 0.45;
  body.castShadow = true;
  g.add(body);
  const cap = new THREE.Mesh(geo('hydCap', () => new THREE.SphereGeometry(0.24, 8, 6)), mat(0xd8262c));
  cap.position.y = 0.92;
  g.add(cap);
  g.add(box(0.7, 0.14, 0.14, 0xd8262c, 0, 0.6, 0, false));
  return g;
}

export function makeLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(geo('pole', () => new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6)), mat(0x3a3a44));
  pole.position.y = 2.1;
  pole.castShadow = true;
  g.add(pole);
  g.add(box(0.9, 0.12, 0.2, 0x3a3a44, 0.4, 4.15, 0, false));
  g.add(box(0.4, 0.14, 0.3, 0xfff1b8, 0.75, 4.05, 0, false));
  return g;
}

export function makeBusShelter() {
  const g = new THREE.Group();
  g.add(box(1.6, 0.12, 4.0, 0x9c6b7a, 0, 2.5, 0));
  g.add(box(0.1, 2.4, 3.8, 0x8fb6c9, 0.7, 1.25, 0));
  for (const z of [-1.9, 1.9]) g.add(box(0.12, 2.5, 0.12, 0x6f4a55, 0.7, 1.25, z));
  g.add(box(0.5, 0.45, 2.8, 0x6f4a55, 0.35, 0.45, 0));
  return g;
}

export function makeFinishLine(width: number) {
  const g = new THREE.Group();
  const n = 12;
  const s = width / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 2; j++) {
      const color = (i + j) % 2 ? 0x111111 : 0xffffff;
      const t = box(s, 0.04, s, color, -width / 2 + s * (i + 0.5), 0.06, (j - 0.5) * s, false);
      t.receiveShadow = true;
      g.add(t);
    }
  }
  return g;
}

/** Центральний острівець рондо: бордюр, трава й дерево. */
export function makeIsland(radius: number) {
  const g = new THREE.Group();
  const curb = new THREE.Mesh(
    geo(`island${radius}`, () => new THREE.CylinderGeometry(radius, radius, 0.4, 32)),
    mat(0xc9b29a),
  );
  curb.position.y = 0.2;
  curb.receiveShadow = true;
  g.add(curb);
  const grass = new THREE.Mesh(
    geo(`islandGrass${radius}`, () => new THREE.CylinderGeometry(radius - 0.4, radius - 0.4, 0.46, 32)),
    mat(0x86b86a),
  );
  grass.position.y = 0.23;
  grass.receiveShadow = true;
  g.add(grass);
  const trunk = new THREE.Mesh(geo('islandTrunk', () => new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6)), mat(0x7a5236));
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  g.add(trunk);
  const crown = new THREE.Mesh(
    geo('islandCrown', () => new THREE.IcosahedronGeometry(1.9, 0)),
    new THREE.MeshLambertMaterial({ color: 0x6a9c57, flatShading: true }),
  );
  crown.position.y = 3.6;
  crown.castShadow = true;
  g.add(crown);
  return g;
}

/** Пасажир, що чекає на тротуарі. */
export function makePerson(shirt: number) {
  const g = new THREE.Group();
  g.add(box(0.5, 0.8, 0.3, 0x2b3a55, 0, 0.4, 0));
  g.add(box(0.6, 0.8, 0.36, shirt, 0, 1.2, 0));
  const head = new THREE.Mesh(geo('head', () => new THREE.SphereGeometry(0.26, 10, 8)), mat(0xf1c7a0));
  head.position.y = 1.85;
  head.castShadow = true;
  g.add(head);
  // рука махає таксі
  const arm = box(0.16, 0.7, 0.16, shirt, 0.42, 1.75, 0);
  arm.rotation.z = -0.5;
  g.add(arm);
  return g;
}

/** Світловий стовп-маркер цілі, видимий здалеку. */
export function makeBeacon(color: number) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    geo('beam', () => new THREE.CylinderGeometry(2.2, 2.2, 26, 24, 1, true)),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 13;
  g.add(beam);
  const ring = new THREE.Mesh(
    geo('beaconRing', () => new THREE.RingGeometry(2.4, 3.1, 32).rotateX(-Math.PI / 2)),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  ring.position.y = 0.1;
  g.add(ring);
  return g;
}

/** Потяг з локомотива й двох вагонів. Перед — у напрямку -Z. Довжина ≈ 52 м. */
export function makeTrain() {
  const g = new THREE.Group();
  const body = (z: number, len: number, color: number) => {
    g.add(box(3.0, 3.2, len, color, 0, 2.2, z));
    g.add(box(3.04, 0.9, len - 1.2, 0x2a3440, 0, 2.9, z));
    g.add(box(2.6, 0.5, len - 0.6, 0x3a3a44, 0, 0.55, z, false));
  };
  body(-13, 16, 0xd8262c); // локомотив
  g.add(box(2.9, 1.2, 0.2, 0x2a3440, 0, 3.0, -21.05, false)); // лобове скло
  body(4.5, 17, 0xf2c230);
  body(22.5, 17, 0xf2c230);
  for (const z of [-19, -7, -2, 11, 16, 29]) {
    for (const x of [-1.2, 1.2]) g.add(box(0.3, 0.9, 1.6, 0x222222, x, 0.45, z, false));
  }
  return g;
}

/** Велосипедист. Перед — у напрямку -Z. */
export function makeCyclist(shirt: number) {
  const g = new THREE.Group();
  const wheelGeo = geo('bikeWheel', () => new THREE.TorusGeometry(0.34, 0.05, 6, 16).rotateY(Math.PI / 2));
  for (const z of [-0.55, 0.55]) {
    const w = new THREE.Mesh(wheelGeo, mat(0x222222));
    w.position.set(0, 0.39, z);
    g.add(w);
  }
  g.add(box(0.06, 0.06, 1.1, 0x3b82f6, 0, 0.75, 0, false)); // рама
  g.add(box(0.5, 0.06, 0.06, 0x222222, 0, 1.05, -0.5, false)); // кермо
  g.add(box(0.3, 0.75, 0.3, 0x2b3a55, 0, 1.05, 0.15)); // ноги
  g.add(box(0.46, 0.7, 0.32, shirt, 0, 1.6, 0.0)); // тулуб
  const head = new THREE.Mesh(geo('head', () => new THREE.SphereGeometry(0.26, 10, 8)), mat(0xf1c7a0));
  head.position.set(0, 2.15, -0.1);
  head.castShadow = true;
  g.add(head);
  g.add(box(0.5, 0.18, 0.55, 0xffc83d, 0, 2.38, -0.1, false)); // шолом
  return g;
}

/** Ostrzegawczy trójkąt odblaskowy на підставці. Лицем у +Z (до водія, що під'їжджає ззаду). */
export function makeTriangle() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.32, 0);
  shape.lineTo(0.32, 0);
  shape.lineTo(0, 0.56);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.17, 0.09);
  hole.lineTo(0, 0.39);
  hole.lineTo(0.17, 0.09);
  hole.closePath();
  shape.holes.push(hole);
  const tri = new THREE.Mesh(geo('triangle', () => new THREE.ShapeGeometry(shape)), new THREE.MeshBasicMaterial({ color: 0xff2a1a, side: THREE.DoubleSide }));
  tri.position.y = 0.12;
  tri.rotation.x = -0.15;
  g.add(tri);
  g.add(box(0.5, 0.04, 0.3, 0x333333, 0, 0.03, 0.08, false));
  // збільшено, щоб трикутник було видно з камери над авто
  g.scale.setScalar(2.2);
  return g;
}

/** Бар'єр дорожніх робіт: червоно-біла планка на ніжках. */
export function makeRoadBarrier() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) g.add(box(0.4, 0.35, 0.12, i % 2 ? 0xffffff : 0xe4483f, -1 + i * 0.4, 0.95, 0, false));
  for (const x of [-1.1, 1.1]) g.add(box(0.1, 1.0, 0.1, 0x555555, x, 0.5, 0, false));
  return g;
}

/**
 * Шлагбаум (półzapora) зі світлофором: два червоні вогні (blinkRail) і стріла (arm),
 * що обертається навколо осі Z. Стріла лежить уздовж -X від стовпа, коли закрита.
 */
export function makeRailBarrier(armLen: number) {
  const g = new THREE.Group();
  g.add(box(0.3, 1.4, 0.3, 0xf2f2f2, 0, 0.7, 0)); // стовп механізму
  const mast = box(0.16, 3.2, 0.16, 0xf2f2f2, 0.45, 1.6, 0);
  g.add(mast);
  for (let i = 0; i < 4; i++) g.add(box(0.17, 0.4, 0.17, 0xd8262c, 0.45, 0.4 + i * 0.8, 0, false));
  g.add(box(1.0, 0.45, 0.25, 0x111111, 0.45, 2.9, 0.12, false)); // табло з вогнями
  const lamps: THREE.Mesh[] = [];
  for (const x of [0.2, 0.7]) {
    const l = box(0.3, 0.3, 0.06, 0x551111, x, 2.9, 0.26, false);
    l.name = 'blinkRail';
    lamps.push(l);
    g.add(l);
  }
  const arm = new THREE.Group();
  arm.position.set(0, 1.1, 0);
  const n = Math.max(2, Math.round(armLen / 0.8));
  for (let i = 0; i < n; i++) arm.add(box(armLen / n, 0.14, 0.1, i % 2 ? 0xffffff : 0xd8262c, -(i + 0.5) * (armLen / n), 0, 0, false));
  arm.name = 'arm';
  g.add(arm);
  return { obj: g, arm, lamps };
}

/** Людина на інвалідному візку. Перед — у напрямку -Z. */
export function makeWheelchair(shirt: number) {
  const g = new THREE.Group();
  const wheelGeo = geo('chairWheel', () => new THREE.TorusGeometry(0.33, 0.04, 6, 18).rotateY(Math.PI / 2));
  for (const x of [-0.36, 0.36]) {
    const w = new THREE.Mesh(wheelGeo, mat(0x333333));
    w.position.set(x, 0.36, 0.05);
    g.add(w);
  }
  for (const x of [-0.24, 0.24]) g.add(box(0.08, 0.16, 0.08, 0x333333, x, 0.08, -0.4, false)); // передні колеса
  g.add(box(0.6, 0.08, 0.5, 0x555b66, 0, 0.55, 0, false)); // сидіння
  g.add(box(0.6, 0.55, 0.08, 0x555b66, 0, 0.85, 0.25, false)); // спинка
  g.add(box(0.44, 0.22, 0.5, 0x2b3a55, 0, 0.7, -0.15)); // ноги
  g.add(box(0.44, 0.12, 0.16, 0x2b3a55, 0, 0.32, -0.42, false)); // ступні
  g.add(box(0.52, 0.65, 0.3, shirt, 0, 1.0, 0.05)); // тулуб
  const head = new THREE.Mesh(geo('head', () => new THREE.SphereGeometry(0.26, 10, 8)), mat(0xf1c7a0));
  head.position.set(0, 1.55, 0.02);
  head.castShadow = true;
  g.add(head);
  return g;
}

/** Незряча людина з білою тростиною. */
export function makeBlindPedestrian(shirt: number) {
  const g = makePerson(shirt);
  // прибираємо підняту руку «таксі» й додаємо тростину попереду
  const arm = g.children[g.children.length - 1];
  g.remove(arm);
  const cane = box(0.05, 1.3, 0.05, 0xf4f4f4, 0.3, 0.62, -0.42, false);
  cane.rotation.x = 0.55;
  g.add(cane);
  g.add(box(0.06, 0.12, 0.06, 0xd8262c, 0.3, 0.07, -0.78, false));
  g.add(box(0.5, 0.1, 0.12, 0x111111, 0, 1.92, -0.2, false)); // темні окуляри
  return g;
}

/** Дорожній робітник у помаранчевому жилеті з каскою. */
export function makeWorker() {
  const g = makePerson(0xff7a1a);
  g.add(box(0.62, 0.1, 0.38, 0xf4f4f4, 0, 1.3, 0, false)); // світловідбивна смуга
  g.add(box(0.5, 0.16, 0.5, 0xffc83d, 0, 2.12, 0, false)); // каска
  return g;
}

/** Людина на електросамокаті. Перед — у напрямку -Z. */
export function makeScooter(shirt: number) {
  const g = new THREE.Group();
  for (const z of [-0.45, 0.4]) g.add(box(0.08, 0.2, 0.2, 0x222222, 0, 0.1, z, false));
  g.add(box(0.18, 0.06, 0.9, 0x3a3a44, 0, 0.18, 0, false)); // дека
  g.add(box(0.05, 1.05, 0.05, 0x3a3a44, 0, 0.7, -0.45, false)); // кермова стійка
  g.add(box(0.5, 0.05, 0.05, 0x222222, 0, 1.22, -0.45, false));
  g.add(box(0.3, 0.8, 0.26, 0x2b3a55, 0, 0.62, 0)); // ноги
  g.add(box(0.46, 0.68, 0.3, shirt, 0, 1.36, -0.05)); // тулуб
  const head = new THREE.Mesh(geo('head', () => new THREE.SphereGeometry(0.26, 10, 8)), mat(0xf1c7a0));
  head.position.set(0, 1.92, -0.08);
  head.castShadow = true;
  g.add(head);
  return g;
}

/** Шкільний автобус: помаранчевий, з табличкою «dzieci» ззаду. */
export function makeSchoolBus() {
  const g = makeBus(0xf08a24);
  // жовта табличка з дітьми на задній стінці (+Z)
  g.add(box(0.9, 0.9, 0.06, 0xffc61a, 0.6, 2.0, 5.53, false));
  g.add(box(0.5, 0.36, 0.08, 0x1b1b1b, 0.6, 2.0, 5.56, false));
  return g;
}

/** Вантажівка з фургоном. Перед — у напрямку -Z. Довжина ≈ 9 м. */
export function makeTruck(color = 0xe8e8e8) {
  const g = new THREE.Group();
  g.add(box(2.4, 2.1, 2.2, 0x4f8fe6, 0, 1.55, -3.3)); // кабіна
  g.add(box(2.42, 0.8, 0.1, 0x2a3440, 0, 2.05, -4.42, false)); // лобове скло
  g.add(box(2.5, 3.0, 6.6, color, 0, 2.1, 1.05)); // фургон
  g.add(box(2.3, 0.4, 8.6, 0x3a3a44, 0, 0.6, -0.1, false)); // рама
  addWheels(g, 1.1, -3.2, 2.6);
  addWheels(g, 1.1, 3.6, 3.6);
  lights(g, 1.2, 4.4, 0.9);
  return g;
}
