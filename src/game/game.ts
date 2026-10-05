import * as THREE from 'three';
import type { Cell, Dir, Level, Zone } from '../types';
import { QUESTIONS } from '../data/questions';
import { matchingQuestions, weatherAt, type SceneChoice } from '../data/sceneMatch';
import { FREE_MAPS, LEVELS } from '../data/levels';
import {
  BAY_LEN, DIR_ANGLE, DIR_VEC, ISLAND_R, LANE, OPP, RIGHT_OF, ROAD_HALF, SIDEWALK, TILE, bayFrame, buildCity, cellCenter,
  dirBetween, headingDir, sameCell, type Actor3D, type Rail3D, type RoadGrid, type Sign3D,
} from '../world/build';
import { makeBeacon, makePerson, mat } from '../world/models';
import { findRoute } from '../world/paths';
import { THEME_LOOK } from '../world/themes';
import { Autopilot, type AutoObstacle } from './autopilot';
import { Car } from './car';
import { Input } from './input';
import { Minimap } from './minimap';
import { Navigator, type Maneuver } from './nav';
import { Traffic } from './traffic';
import { UI, type Best, type Mistake, type NavView } from './ui';

type State = 'menu' | 'driving' | 'quiz' | 'paused' | 'finished';

const DEFAULT_LIMIT = 50;
/** перше питання — не раніше, ніж проїдеш стільки метрів */
const FIRST_QUESTION_M = 30;
/** найменша відстань між двома питаннями, щоб гравець встигав їхати */
const MIN_QUESTION_GAP = 100;
const STORAGE_KEY = 'pdrpl.best';

/** Скільки метрів між питаннями і яка частка точок «активна» в одній поїздці. */
const QUIZ_RULES: Record<Level['task'], { gap: number; chance: number }> = {
  route: { gap: 100, chance: 0.75 },
  park: { gap: 100, chance: 0.75 },
  taxi: { gap: 140, chance: 0.6 },
  free: { gap: 150, chance: 0.6 },
};

const TURN_VIEW = {
  straight: ['↑', 'Прямо'],
  left: ['↰', 'Ліворуч'],
  right: ['↱', 'Праворуч'],
  uturn: ['↶', 'Розворот'],
} as const;

interface TriggerState {
  cell: Cell;
  q: string;
  dir?: Dir;
  fired: boolean;
  active: boolean;
  /** офіційне питання, обране для цієї точки в поточній поїздці */
  pick: string | null;
  /**
   * Питання, що відповідають сцені точки, і як підлаштувати під кожне сцену.
   * null — точка без відомого напрямку (вільна їзда, таксі): рахуємо в момент проїзду.
   */
  options: Option[] | null;
}

type Option = { id: string; choice: SceneChoice; choices?: SceneChoice[] };

/** Бали за правильну відповідь: 50 за кожен іспитовий бал питання (1–3). */
const REWARD_PER_POINT = 50;

interface Obstacle {
  obj: THREE.Object3D;
  halfW: number;
  halfL: number;
}

function loadBest(): Record<string, Best> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Налаштування гравця (таймер, автопілот), що зберігаються між сесіями. */
function loadFlag(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function saveFlag(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? '1' : '0');
  } catch {
    /* приватний режим */
  }
}

/**
 * Час на відповідь — як на іспиті (§ 19 ust. 6 rozporządzenia MI z 24.11.2023, Dz.U. 2023 poz. 2659):
 * «так/ні» — 20 с на читання, потім 15 с на відповідь; A/B/C — 50 с на читання й відповідь.
 */
const EXAM_TIME = { yesNo: { read: 20, answer: 15 }, abc: { read: 0, answer: 50 } };

function saveBest(best: Record<string, Best>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  } catch {
    /* приватний режим — просто не зберігаємо */
  }
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.5, 700);
  private sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  private hemi = new THREE.HemisphereLight(0xfff6e8, 0x8a6f5a, 1.4);
  private headlights = new THREE.SpotLight(0xfff2cc, 0, 70, 0.55, 0.6, 1.2);
  private clock = new THREE.Clock();

  private input = new Input();
  private ui = new UI();
  private car = new Car();
  private minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement);

  private level!: Level;
  private grid!: RoadGrid;
  private nav!: Navigator;
  private traffic!: Traffic;
  private actors: Actor3D[] = [];
  private signs3d: Sign3D[] = [];
  private weatherNow: NonNullable<Level['weather']> = 'clear';
  private rails: (Rail3D & { closed: number; warned: boolean; danger: boolean })[] = [];
  private autopilot = new Autopilot();
  /** автопілот: авто саме їде маршрутом, гравець лише відповідає на питання */
  private autoOn = loadFlag('pdrpl.autopilot', false);
  /** обмеження часу на відповідь, як на іспиті */
  private timerOn = loadFlag('pdrpl.timer', true);
  private unload: (() => void) | null = null;
  private beacon = makeBeacon(0xffc83d);
  private person = makePerson(0x22c55e);

  private state: State = 'menu';
  private camHeading = 0;
  private camPos = new THREE.Vector3();
  private time = 0;

  private triggers: TriggerState[] = [];
  private stopSigns: { cell: Cell; travel: Dir }[] = [];
  private stopWatch: { cell: Cell; minSpeed: number } | null = null;
  private lastCellKey = '';
  private score = 0;
  private correct = 0;
  private asked = 0;
  private mistakes: Mistake[] = [];
  private violations: string[] = [];
  private overSpeedTime = 0;
  /** скільки секунд поспіль авто без причини їде зустрічною смугою / по рондо проти напрямку */
  private wrongLaneTime = 0;
  private wrongRondoTime = 0;
  /** діє знак B-25 «zakaz wyprzedzania» для руху в цьому напрямку (до найближчого перехрестя) */
  private noOvertake: Dir | null = null;
  private violationCooldown = 0;
  private distance = 0;
  private lastQuizAt = -Infinity;
  private askedSession = new Set<string>();
  /** питання, які вже траплялися (між поїздками) — щоб наступна поїздка була з іншими */
  private seen = new Set<string>();
  private examGot = 0;
  private examMax = 0;
  private questionsOn = true;
  private zone: Zone | null = null;

  // задачі
  private target: Cell | null = null;
  private stopIdx = 0;
  private offRouteTime = 0;
  private parkedTime = 0;
  private goalsReached = 0;

  constructor(canvas: HTMLCanvasElement) {
    // на телефонах — менша роздільність і тіні, щоб гра не гальмувала
    const phone = window.matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0xd9c3a3);
    this.scene.fog = new THREE.Fog(0xd9c3a3, 90, 230);

    this.scene.add(this.hemi);
    // фари авто гравця (вмикаються вночі): світять уперед і трохи вниз
    this.headlights.position.set(0, 1.2, -1.5);
    this.headlights.target.position.set(0, 0, -25);
    this.car.obj.add(this.headlights, this.headlights.target);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -60;
    sc.right = sc.top = 60;
    sc.near = 1;
    sc.far = 200;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target, this.world);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.bindButtons();
    this.load(LEVELS[0]);
    this.reset();
    this.showMenu();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- рівні

  private load(level: Level) {
    if (this.level === level) return;
    this.unload?.();
    this.world.clear();
    this.level = level;
    const city = buildCity(this.world, level);
    this.grid = city.grid;
    this.actors = city.actors;
    this.signs3d = city.signs;
    this.rails = city.rails.map((r) => ({ ...r, closed: 0, warned: false, danger: false }));
    this.unload = city.dispose;
    this.nav = new Navigator(this.grid);
    this.traffic = new Traffic(this.world, this.grid);
    this.world.add(this.car.obj, this.beacon, this.person);
    this.car.maxFwd = (level.maxSpeed ?? 60) / 3.6;
    this.applyWeather(level.weather ?? 'clear');
    // для кожної точки — лише ті офіційні питання, що відповідають ситуації на дорозі
    const route = level.route ?? [];
    const all = level.exam ? Object.keys(QUESTIONS) : null;
    this.triggers = level.triggers.map((t) => {
      const i = route.findIndex((c) => sameCell(c, t.cell));
      const d = t.dir ?? (i < 0 ? null : i > 0 ? dirBetween(route[i - 1], t.cell) : dirBetween(t.cell, route[1]));
      // підлаштування сцени — лише на рівнях з фіксованим маршрутом (у вільній їзді й таксі напрямок наперед невідомий)
      const options = d && route.length ? matchingQuestions(level, t.cell, d, t.q, all, true) : null;
      return { ...t, fired: false, active: false, pick: null, options };
    });
    this.stopSigns = level.signs.filter((s) => s.type === 'B-20').map((s) => ({ cell: s.cell, travel: s.travel }));
    this.minimap.setGrid(this.grid);
  }

  /** Освітлення й туман під погоду рівня. */
  private applyWeather(w: NonNullable<Level['weather']>) {
    this.weatherNow = w;
    // туман уночі — темний і густий; ліхтарі та фари світяться, як і вночі
    const nightFog = w === 'fog' && this.level.weather === 'night';
    const look = nightFog ? { sky: 0x2a3140, near: 6, far: 48, hemi: 0.42, sun: 0.25, sunColor: 0x9fb2ff } : {
      clear: { sky: 0xd9c3a3, near: 90, far: 230, hemi: 1.4, sun: 2.2, sunColor: 0xfff1dc },
      fog: { sky: 0xc4c7c9, near: 12, far: 95, hemi: 1.25, sun: 0.7, sunColor: 0xf4f4f4 },
      night: { sky: 0x141a2c, near: 18, far: 120, hemi: 0.32, sun: 0.22, sunColor: 0x9fb2ff },
      snow: { sky: 0xdde5ec, near: 70, far: 220, hemi: 1.55, sun: 1.7, sunColor: 0xffffff },
    }[w];
    // небо й далечінь під місцевість (пустельне марево, прозоре гірське повітря…)
    const theme = this.level.theme ? THEME_LOOK[this.level.theme] : null;
    if (theme && !nightFog && (w === 'clear' || w === 'snow')) Object.assign(look, { sky: theme.sky, near: theme.fogNear, far: theme.fogFar });
    (this.scene.background as THREE.Color).setHex(look.sky);
    if (nightFog) w = 'night';
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(look.sky);
    fog.near = look.near;
    fog.far = look.far;
    // далі за туманом усе одно лише колір неба — не малюємо (на телефоні в портреті камера бачить до горизонту)
    this.camera.far = look.far + 40;
    this.camera.updateProjectionMatrix();
    this.hemi.intensity = look.hemi;
    this.sun.intensity = look.sun;
    this.sun.color.setHex(look.sunColor);
    const night = w === 'night';
    this.headlights.intensity = night ? 60 : 0;
    // ліхтарі й фари світяться вночі
    (mat(0xfff1b8) as THREE.MeshLambertMaterial).emissive.setHex(night ? 0xffe39a : 0);
    (mat(0xfff6c8) as THREE.MeshLambertMaterial).emissive.setHex(night ? 0xfff1c0 : 0);
  }

  private showMenu() {
    this.state = 'menu';
    this.ui.hideScreens();
    this.ui.show('hud', false);
    this.ui.menu(LEVELS, FREE_MAPS, loadBest(), (l) => this.start(l));
  }

  private start(level: Level) {
    this.load(level);
    this.reset();
    this.ui.hideScreens();
    this.ui.show('hud');
    this.state = 'driving';
    const intro: Record<Level['task'], string> = {
      route: 'Тисни ГАЗ і їдь за підказками вгорі',
      park: 'Доїдь до синьої рамки і припаркуйся',
      taxi: 'Їдь до пасажира за підказками вгорі 🚕',
      free: 'Вільна їзда! Натисни на панель угорі, щоб обрати ціль',
    };
    this.ui.toast(intro[level.task], 3200);
  }

  private reset() {
    const { cell, dir } = this.level.start;
    const p = cellCenter(cell);
    const [rx, rz] = DIR_VEC[RIGHT_OF[dir]];
    const [dx, dz] = DIR_VEC[dir];
    p.x += rx * LANE - dx * TILE * 0.25;
    p.z += rz * LANE - dz * TILE * 0.25;
    this.car.place(p, DIR_ANGLE[dir]);
    this.camHeading = DIR_ANGLE[dir];
    this.camPos.set(Infinity, 0, 0);
    this.lastCellKey = '';

    this.level.actors.forEach((a, i) => a.adapt && this.actors[i].setVariant(a.variant));
    this.level.signs.forEach((s, i) => s.alts && this.signs3d[i].setAlt(null));
    this.weatherNow = 'clear';
    this.applyWeather(weatherAt(this.level, cell));
    const rules = this.quizRules;
    const taken = new Set<string>();
    this.triggers.forEach((t) => {
      t.fired = false;
      t.active = Math.random() < rules.chance;
      const opt = t.options ? this.pickOption(t.options, taken) : null;
      t.pick = opt?.id ?? null;
      if (opt) {
        taken.add(opt.id);
        const all = opt.choices ?? [opt.choice];
        this.applyChoice(all[Math.floor(Math.random() * all.length)]);
      }
    });
    for (const a of this.actors) {
      a.obj.position.copy(a.home);
      a.dir.copy(a.homeDir);
      a.obj.rotation.y = a.homeYaw;
      a.obj.visible = true;
      a.obj.scale.setScalar(1);
      // пішоходи й велосипедисти без прив'язки до питання рухаються постійно
      // потяг без сценарію курсує за розкладом
      a.moving = (a.kind === 'pedestrian' || a.kind === 'cyclist' || a.kind === 'train') && !a.go;
      a.moved = 0;
      a.speed = 0;
      a.pause = 0;
    }
    for (const r of this.rails) {
      r.closed = 0;
      r.warned = false;
      r.danger = false;
    }
    // трафік не з'являється там, де стоять сценарні машини
    const sceneCars = this.actors.filter((a) => a.kind === 'car' || a.kind === 'bus' || a.kind === 'police').map((a) => a.home);
    this.traffic.spawn(this.level.traffic ?? 0, cell, sceneCars);

    this.score = 0;
    this.correct = 0;
    this.asked = 0;
    this.examGot = 0;
    this.examMax = 0;
    this.mistakes = [];
    this.violations = [];
    this.overSpeedTime = 0;
    this.wrongLaneTime = 0;
    this.wrongRondoTime = 0;
    this.noOvertake = null;
    this.violationCooldown = 0;
    this.distance = 0;
    this.lastQuizAt = -Infinity;
    this.stopWatch = null;
    this.zone = this.zoneAt(cell);
    this.stopIdx = 0;
    this.offRouteTime = 0;
    this.parkedTime = 0;
    this.goalsReached = 0;

    this.nav.setRoute(this.level.route ?? null);
    this.autopilot.reset();
    this.setTarget(this.level.task === 'taxi' ? this.level.stops![0].cell : null);
    this.ui.setScore(0);
  }

  // ---------------------------------------------------------------- кнопки

  private bindButtons() {
    const on = (id: string, fn: () => void) => (document.getElementById(id)!.onclick = fn);
    on('btn-restart', () => this.start(this.level));
    on('btn-restart-pause', () => this.start(this.level));
    on('btn-menu', () => this.showMenu());
    on('btn-menu-pause', () => this.showMenu());
    on('btn-next', () => {
      const i = LEVELS.indexOf(this.level);
      this.start(LEVELS[Math.min(i + 1, LEVELS.length - 1)]);
    });
    on('btn-pause', () => this.pause(true));
    on('btn-resume', () => this.pause(false));
    on('btn-questions', () => {
      this.questionsOn = !this.questionsOn;
      this.updatePauseScreen();
    });
    const toggleAuto = () => this.setAuto(!this.autoOn);
    const toggleTimer = () => {
      this.timerOn = !this.timerOn;
      saveFlag('pdrpl.timer', this.timerOn);
      this.ui.setOptions(this.autoOn, this.timerOn);
    };
    on('btn-auto', toggleAuto);
    on('btn-auto-pause', toggleAuto);
    on('opt-auto', toggleAuto);
    on('btn-timer-pause', toggleTimer);
    on('opt-timer', toggleTimer);
    this.ui.setOptions(this.autoOn, this.timerOn);
    this.ui.onNavClick(() => {
      if (this.level.task === 'free' && this.state === 'driving') this.pickFreeTarget();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'driving') this.pause(true);
        else if (this.state === 'paused') this.pause(false);
      }
    });
  }

  private setAuto(on: boolean, why?: string) {
    this.autoOn = on;
    saveFlag('pdrpl.autopilot', on);
    this.autopilot.reset();
    this.ui.setOptions(this.autoOn, this.timerOn);
    if (this.state === 'driving') this.ui.toast(why ?? (on ? '🤖 Автопілот увімкнено — відповідай на питання' : '🤖 Автопілот вимкнено'), 2200);
  }

  /** Що бачить автопілот: машини, автобуси, пішоходи на переході, велосипедисти, потяги, трафік. */
  private autoObstacles(): AutoObstacle[] {
    const out: AutoObstacle[] = [];
    for (const a of this.actors) {
      if (!a.obj.visible) continue;
      // хто йде вздовж краю дороги, не перекриває смугу — його просто об'їжджаємо, не зачіпаючи
      const vulnerable = (a.kind === 'pedestrian' && !a.walker) || a.kind === 'cyclist';
      // пішохід, що чекає на тротуарі, не заважає; той, що переходить, — так
      if (a.kind === 'pedestrian' && (!a.moving || a.pause > 0)) continue;
      out.push({
        obj: a.obj, halfW: a.halfW, halfL: a.halfL, kind: a.kind, moving: a.moving, vulnerable,
        static: !a.go && !a.moving && (a.kind === 'car' || a.kind === 'bus' || a.kind === 'police'),
        vel: a.moving && a.kind !== 'pedestrian' ? a.dir.clone().multiplyScalar(a.speed) : new THREE.Vector3(),
      });
    }
    for (const c of this.traffic.cars) {
      const fwd = new THREE.Vector3(-Math.sin(c.obj.rotation.y), 0, -Math.cos(c.obj.rotation.y));
      out.push({ obj: c.obj, halfW: c.halfW, halfL: c.halfL, kind: 'traffic', moving: true, static: false, vel: fwd.multiplyScalar(c.speed) });
    }
    return out;
  }

  private pause(on: boolean) {
    if (on && this.state !== 'driving') return;
    if (!on && this.state !== 'paused') return;
    this.state = on ? 'paused' : 'driving';
    if (on) this.updatePauseScreen();
    this.ui.show('screen-pause', on);
  }

  private updatePauseScreen() {
    const free = this.level.task === 'free';
    const lines = [
      `${this.level.icon} ${this.level.name}`,
      `Відповіді: ${this.correct} з ${this.asked} · Порушень: ${this.violations.length}`,
    ];
    if (free) lines.push(`Досягнуто цілей: ${this.goalsReached}`);
    this.ui.setPause(lines.join('<br>'), this.questionsOn, free);
    this.ui.setOptions(this.autoOn, this.timerOn);
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // на вузьких (портретних) екранах — ширший кут, щоб бачити дорогу попереду,
    // і кадр зміщений, щоб авто було вище за кнопки й спідометр
    const portrait = w < h;
    this.camera.fov = portrait ? 66 : 48;
    this.camera.setViewOffset(w, h, 0, h * 0.1, w, h);
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- цілі (таксі, вільна їзда)

  private get carCell() {
    return this.grid.cellAt(this.car.pos.x, this.car.pos.z);
  }

  private setTarget(cell: Cell | null) {
    this.target = cell;
    this.offRouteTime = 0;
    this.beacon.visible = !!cell;
    this.person.visible = false;
    if (!cell) {
      if (this.level.task !== 'route' && this.level.task !== 'park') this.nav.setRoute(null);
      return;
    }
    this.nav.setRoute(findRoute(this.grid, this.carCell, headingDir(this.car.heading), cell));
    const p = cellCenter(cell);
    this.beacon.position.set(p.x, 0, p.z);
    // пасажир чекає на тротуарі з боку будинків
    if (this.level.stops?.[this.stopIdx]?.kind === 'pickup') {
      const n = this.grid.neighbors(cell[0], cell[1]);
      const side = (['E', 'S', 'W', 'N'] as Dir[]).find((d) => !n[d]) ?? 'E';
      const [sx, sz] = DIR_VEC[side];
      this.person.position.set(p.x + sx * (TILE / 2 - SIDEWALK / 2), 0.35, p.z + sz * (TILE / 2 - SIDEWALK / 2));
      this.person.rotation.y = DIR_ANGLE[side];
      this.person.visible = true;
    }
  }

  private pickFreeTarget() {
    const here = this.carCell;
    // на великих картах ціль не надто близько й не на іншому кінці світу
    const near: Cell[] = [];
    const far: Cell[] = [];
    for (let r = 0; r < this.level.rows; r++) {
      for (let c = 0; c < this.level.cols; c++) {
        if (!this.grid.isRoad(c, r) || this.grid.isJunction(c, r)) continue;
        const d = Math.abs(c - here[0]) + Math.abs(r - here[1]);
        if (d >= 8 && d <= 24) near.push([c, r]);
        else if (d >= 6) far.push([c, r]);
      }
    }
    const cells = near.length ? near : far;
    if (!cells.length) return;
    this.setTarget(cells[Math.floor(Math.random() * cells.length)]);
    this.ui.toast('🎯 Нова ціль! Підказки — вгорі', 2000);
  }

  private updateTasks(dt: number) {
    const task = this.level.task;
    const cell = this.carCell;
    const slow = Math.abs(this.car.speed) < 1.5;

    // перебудова маршруту, якщо з'їхав з нього
    if (this.target) {
      this.offRouteTime = this.nav.offRoute ? this.offRouteTime + dt : 0;
      if (this.offRouteTime > 0.6 || !this.nav.active) {
        this.setTarget(this.target);
        if (this.nav.active) this.ui.toast('🔄 Перебудовую маршрут', 1200);
      }
    }

    if (task === 'route' && this.nav.finished) return this.finish();

    if (task === 'park' && this.level.park) {
      const { cx, cz, ax, az } = bayFrame(this.level.park);
      const dx = this.car.pos.x - cx, dz = this.car.pos.z - cz;
      const along = dx * ax + dz * az;
      const lat = dx * -az + dz * ax;
      let diff = this.car.heading - DIR_ANGLE[this.level.park.travel];
      diff = Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff)));
      const inside = Math.abs(along) < BAY_LEN / 2 - 1 && Math.abs(lat) < 0.9;
      if (inside && diff < 0.45 && Math.abs(this.car.speed) < 0.3) {
        this.parkedTime += dt;
        if (this.parkedTime > 1) {
          this.score += 200;
          return this.finish('Паркування +200 ⭐');
        }
      } else {
        this.parkedTime = 0;
        if (inside && diff >= 0.45 && slow) this.ui.toast('Стань рівніше вздовж бордюру', 900);
      }
      return;
    }

    if (!this.target || !sameCell(cell, this.target) || !slow) return;

    if (task === 'taxi') {
      const stops = this.level.stops!;
      const kind = stops[this.stopIdx].kind;
      if (kind === 'pickup') {
        this.ui.toast('🧍 Пасажир сів. Вези за адресою!', 2200);
      } else {
        this.score += 150;
        this.ui.setScore(this.score);
        this.ui.toast('✅ Пасажира доставлено! +150', 2200);
      }
      this.stopIdx++;
      if (this.stopIdx >= stops.length) return this.finish(`Доставлено пасажирів: ${stops.length / 2}`);
      this.setTarget(stops[this.stopIdx].cell);
    } else if (task === 'free') {
      this.goalsReached++;
      this.score += 50;
      this.ui.setScore(this.score);
      this.ui.toast('🎯 Ціль досягнута! +50', 2000);
      this.setTarget(null);
    }
  }

  private finish(extra?: string) {
    if (this.state !== 'driving') return;
    this.state = 'finished';
    const pct = this.asked ? Math.round((this.correct / this.asked) * 100) : 100;
    const best = loadBest();
    const prev = best[this.level.id];
    if (!prev || this.score > prev.score) {
      best[this.level.id] = { score: this.score, pct };
      saveBest(best);
    }
    const i = LEVELS.indexOf(this.level);
    const titles: Record<Level['task'], [string, string]> = {
      route: ['🏁', 'Маршрут пройдено!'],
      park: ['🅿️', 'Припарковано!'],
      taxi: ['🚕', 'Зміну завершено!'],
      free: ['🚗', 'Поїздку завершено'],
    };
    const [icon, title] = titles[this.level.task];
    this.ui.finish({
      icon, title, extra,
      score: this.score, correct: this.correct, total: this.asked,
      mistakes: this.mistakes, violations: this.violations,
      hasNext: i >= 0 && i < LEVELS.length - 1,
      exam: this.level.exam ? { got: this.examGot, max: this.examMax } : undefined,
    });
  }

  // ---------------------------------------------------------------- правила

  private zoneAt([c, r]: Cell) {
    return this.level.zones?.find((z) => c >= z.from[0] && c <= z.to[0] && r >= z.from[1] && r <= z.to[1]) ?? null;
  }

  private get limit() {
    return this.zone?.limit ?? this.level.limit ?? DEFAULT_LIMIT;
  }

  private violation(msg: string) {
    if (this.violationCooldown > 0) return;
    this.violationCooldown = 4;
    this.violations.push(msg);
    this.score = Math.max(0, this.score - 25);
    this.ui.setScore(this.score);
    this.ui.toast(`⚠️ ${msg} (−25)`, 2600);
  }

  private onEnterCell(cell: Cell) {
    // зони погоди (наприклад, туман у низині посеред нічного рівня)
    const w = weatherAt(this.level, cell);
    if (w !== this.weatherNow) {
      this.applyWeather(w);
      if (w === 'fog') this.ui.toast('🌫️ Туман: видимість різко впала', 2200);
    }

    // зони швидкості
    const zone = this.zoneAt(cell);
    if (zone !== this.zone) {
      const base = this.level.limit ?? DEFAULT_LIMIT;
      this.ui.toast(zone ? `${zone.name}: максимум ${zone.limit} км/год` : `${this.zone?.name ?? 'Зона'} — кінець: ${base} км/год`, 2600);
      this.zone = zone;
    }

    // знак STOP: стежимо, чи авто повністю зупиниться
    const dir = headingDir(this.car.heading);
    if (this.stopWatch && !sameCell(this.stopWatch.cell, cell)) {
      if (this.stopWatch.minSpeed > 0.4) this.violation('Не зупинився на знаку STOP');
      else this.ui.toast('👍 Правильна зупинка на STOP');
      this.stopWatch = null;
    }
    const stop = this.stopSigns.find((s) => sameCell(s.cell, cell) && s.travel === dir);
    if (stop) this.stopWatch = { cell, minSpeed: Infinity };

    // заборона обгону (B-25) діє до найближчого перехрестя
    if (this.grid.isJunction(cell[0], cell[1]) || this.noOvertake !== dir) this.noOvertake = null;
    if (this.level.signs.some((s) => s.type === 'B-25' && s.travel === dir && sameCell(s.cell, cell))) this.noOvertake = dir;

    // питання
    const free = this.level.task === 'free';
    const { gap } = this.quizRules;
    for (const t of this.triggers) {
      if (!sameCell(t.cell, cell) || (t.dir && t.dir !== dir)) continue;
      if (!free) {
        if (t.fired) continue;
        t.fired = true;
      }
      this.releaseActors(t.q);
      if (!this.questionsOn || (!free && !t.active)) continue;
      if (this.distance < FIRST_QUESTION_M || this.distance - this.lastQuizAt < gap) continue;
      if (free || !t.options) {
        if (free && Math.random() > this.quizRules.chance) continue;
        // напрямок відомий лише зараз: беремо питання, що відповідають сцені саме в цьому напрямку
        const all = this.level.exam ? Object.keys(QUESTIONS) : null;
        t.pick = this.pickOption(matchingQuestions(this.level, t.cell, dir, t.q, all, false), this.askedSession)?.id ?? null;
      }
      if (!t.pick) continue;
      this.openQuiz(t.pick);
      break;
    }
  }

  /** Частота питань: базова для типу завдання, рівень може перевизначити. */
  private get quizRules() {
    const rules = { ...QUIZ_RULES[this.level.task], ...this.level.quiz };
    // не частіше, ніж раз на MIN_QUESTION_GAP метрів, хай що задано в рівні
    return { ...rules, gap: Math.max(MIN_QUESTION_GAP, rules.gap) };
  }

  /** Випадкове питання з тих, що підходять до сцени: спершу ті, що ще не траплялися й не взяті іншими точками. */
  private pickOption(options: Option[], taken: Set<string>): Option | null {
    if (!options.length) return null;
    const free = options.filter((o) => !taken.has(o.id));
    const fresh = free.filter((o) => !this.seen.has(o.id));
    if (!fresh.length && free.length) {
      // усі питання точки вже були — починаємо коло спочатку
      for (const o of options) this.seen.delete(o.id);
    }
    const from = fresh.length ? fresh : free.length ? free : options;
    return from[Math.floor(Math.random() * from.length)];
  }

  /** Підлаштувати сцену під обране питання: різновиди учасників і варіанти знаків. */
  private applyChoice(choice: SceneChoice) {
    for (const [i, v] of choice.actors) this.actors[i].setVariant(v);
    for (const [i, alt] of choice.signs) this.signs3d[i].setAlt(alt);
  }

  private releaseActors(q: string) {
    for (const a of this.actors) if (a.go === q) a.moving = true;
  }

  private openQuiz(id: string) {
    const q = QUESTIONS[id];
    if (!q) return;
    this.state = 'quiz';
    this.asked++;
    this.askedSession.add(id);
    this.seen.add(id);
    this.examMax += q.points;
    const reward = REWARD_PER_POINT * q.points;
    const time = this.timerOn ? (q.ua.options.length === 2 ? EXAM_TIME.yesNo : EXAM_TIME.abc) : null;
    this.ui.quiz(
      q,
      reward,
      time,
      (ok, picked) => {
        if (ok) {
          this.score += reward;
          this.correct++;
          this.examGot += q.points;
        } else {
          this.mistakes.push({ q, picked });
        }
        this.ui.setScore(this.score);
      },
      () => {
        this.state = 'driving';
        this.lastQuizAt = this.distance;
        this.car.speed = Math.min(this.car.speed, 6);
      },
    );
  }

  // ---------------------------------------------------------------- рух

  private updateActors(dt: number) {
    const blinkOn = this.time % 0.8 < 0.4;
    for (const a of this.actors) {
      // поворотник блимає, поки машина стоїть і щойно рушила; аварійка — завжди
      if (a.blink) for (const b of a.blinkers) b.visible = blinkOn && (a.blink === 'hazard' || a.moved < 8);

      if (a.kind === 'pedestrian') {
        this.updatePedestrian(a, dt);
        continue;
      }
      if (a.kind === 'train' && !a.go) {
        // потяг без сценарію (вільна їзда): проїхав лінію — пауза — знову з її початку
        if (a.pause > 0) {
          a.pause -= dt;
          if (a.pause <= 0) {
            a.obj.position.copy(a.home);
            a.moved = 0;
            a.obj.visible = true;
          }
          continue;
        }
        if (a.moved >= a.travel) {
          a.obj.visible = false;
          a.pause = 25 + Math.random() * 30;
          continue;
        }
      }
      if (!a.moving || !a.obj.visible) continue;
      if (a.kind === 'cyclist' && !a.go && a.moved >= a.travel) {
        // велосипедист без сценарію їздить по колу: повертається на старт
        a.obj.position.copy(a.home);
        a.moved = 0;
      }
      a.speed = Math.min(a.maxSpeed, a.speed + 4 * dt);
      const ds = a.speed * dt;
      a.obj.position.addScaledVector(a.dir, ds);
      a.moved += ds;
      if (a.moved >= a.travel) {
        // проїхала свій шлях — плавно зникає
        const s = a.obj.scale.x - dt * 3;
        if (s <= 0.05) a.obj.visible = false;
        else a.obj.scale.setScalar(s);
      }
    }
  }

  /** Переїзди: шлагбауми опускаються, поки поруч потяг; червоні вогні блимають. */
  private updateRails(dt: number) {
    const blink = this.time % 1 < 0.5;
    for (const r of this.rails) {
      const c = cellCenter(r.cell);
      let near = false;
      let soon = false;
      for (const a of this.actors) {
        if (a.kind !== 'train' || !a.obj.visible || (r.go && a.go !== r.go) || !a.moving) continue;
        // відстань уздовж руху потяга до переїзду: >0 — переїзд попереду
        const s = (c.x - a.obj.position.x) * a.dir.x + (c.z - a.obj.position.z) * a.dir.z;
        if (s > -a.halfL - 12 && s < a.halfL + (r.arms.length ? 160 : 80)) near = true;
        // автопілот обережніший: не рушає, поки потяг ближче ніж ~200 м
        if (s > -a.halfL - 12 && s < a.halfL + 200) soon = true;
      }
      r.closed = THREE.MathUtils.clamp(r.closed + (near ? dt : -dt) / 2.5, 0, 1);
      r.danger = near || soon || r.closed > 0.02;
      for (const arm of r.arms) arm.rotation.z = (-Math.PI / 2 + 0.05) * (1 - r.closed);
      for (const l of r.lamps) {
        const on = (near || r.closed > 0.02) && blink;
        l.material = mat(on ? 0xff2a1a : 0x551111, on ? { emissive: 0xff2a1a } : {});
      }
      // в'їзд на переїзд, коли горять червоні вогні або опущено шлагбаум
      if ((near || r.closed > 0.05) && sameCell(this.carCell, r.cell)) {
        if (!r.warned) this.violation(r.arms.length ? 'В\'їзд на переїзд при червоних вогнях і шлагбаумі' : 'В\'їзд на переїзд перед потягом');
        r.warned = true;
      }
    }
  }

  /** Пішохід переходить «зебру», чекає на тротуарі й іде назад — і так по колу. */
  private updatePedestrian(a: Actor3D, dt: number) {
    if (!a.moving) return;
    if (a.pause > 0) {
      a.pause -= dt;
      if (a.pause <= 0) {
        a.dir.negate();
        a.obj.rotation.y += Math.PI;
        a.moved = 0;
      }
      return;
    }
    const ds = a.maxSpeed * dt;
    a.obj.position.addScaledVector(a.dir, ds);
    a.moved += ds;
    // на тротуарі пішохід вище, ніж на проїжджій частині
    if (!a.walker) a.obj.position.y = a.moved < 0.7 || a.moved > a.travel - 0.7 ? 0.35 : 0;
    if (a.moved >= a.travel) a.pause = 3 + Math.random() * 3;
  }

  /**
   * Правила, що перевіряються щокадру: зустрічна смуга (об'їзд перешкоди й обгін дозволені, якщо попереду вільно),
   * обгін під B-25 і на «зебрі», рух по рондо проти напрямку, пішохід на переході.
   */
  private checkRoadRules(dt: number, cell: Cell) {
    const car = this.car;
    const p = car.pos;
    const fwd = car.forward;
    const moving = car.speed > 1.5;

    // рондо — лише проти годинникової стрілки (дивлячись згори)
    if (moving && this.grid.isRoundabout(cell[0], cell[1])) {
      const c = cellCenter(cell);
      const dx = p.x - c.x, dn = c.z - p.z;
      const dist = Math.hypot(dx, dn);
      // швидкість уздовж кола: > 0 — проти годинникової стрілки
      const tang = ((dx * -fwd.z - dn * fwd.x) * car.speed) / Math.max(dist, 1);
      this.wrongRondoTime = dist > ISLAND_R && dist < TILE / 2 && tang < -2 ? this.wrongRondoTime + dt : 0;
      if (this.wrongRondoTime > 0.8) this.violation('Рух по рондо проти напрямку');
    } else {
      this.wrongRondoTime = 0;
    }

    // пішохід на «зебрі»: поки він іде проїжджою частиною, переїжджати перехід не можна (PoRD art. 26 ust. 1)
    if (moving) {
      for (let i = 0; i < this.actors.length; i++) {
        const a = this.actors[i];
        if (a.kind !== 'pedestrian' || a.walker || !a.obj.visible || !a.moving || a.pause > 0 || a.obj.position.y !== 0) continue;
        // уже ≈ 2 с на проїжджій частині — водій мав час її помітити й зупинитися
        if (a.moved < 3.5 || !this.level.crosswalks.some((cw) => sameCell(cw.cell, this.level.actors[i].cell))) continue;
        const d = a.obj.position.clone().sub(p);
        if (Math.abs(d.dot(fwd)) < 2.5 && Math.abs(d.x * fwd.z - d.z * fwd.x) < ROAD_HALF * 2 + 1) {
          this.violation('Не пропустив пішохода на переході');
          break;
        }
      }
    }

    // зустрічна смуга — на прямих ділянках (на перехрестях і в поворотах смуги неоднозначні)
    const dir = headingDir(car.heading);
    const exits = this.grid.exits(cell[0], cell[1]);
    const [ax, az] = DIR_VEC[dir];
    const straight = exits.length === 2 && exits[0] === OPP[exits[1]] && exits.includes(dir) && !this.grid.isRoundabout(cell[0], cell[1]);
    if (!straight || fwd.x * ax + fwd.z * az < 0.7) return;
    const c = cellCenter(cell);
    const [rx, rz] = DIR_VEC[RIGHT_OF[dir]];
    const lat = (q: THREE.Vector3) => (q.x - c.x) * rx + (q.z - c.z) * rz;
    const myLat = lat(p);
    if (!moving || myLat > -0.6) {
      if (myLat > -0.6) this.wrongLaneTime = 0;
      return;
    }
    // хто на нашій смузі поруч (обгін, об'їзд) і хто їде назустріч
    const others = [
      ...this.actors
        .filter((a) => a.obj.visible && (a.kind === 'car' || a.kind === 'bus' || a.kind === 'police' || a.kind === 'cyclist'))
        .map((a) => ({ pos: a.obj.position, yaw: a.obj.rotation.y, moving: a.moving && a.speed > 0.5 })),
      ...this.traffic.cars.map((t) => ({ pos: t.obj.position, yaw: t.heading, moving: t.speed > 0.5 })),
    ];
    let passing = false, passingMoving = false, headOn = false;
    for (const o of others) {
      const s = (o.pos.x - p.x) * ax + (o.pos.z - p.z) * az;
      const l = lat(o.pos);
      const same = -Math.sin(o.yaw) * ax - Math.cos(o.yaw) * az;
      if (l > 0 && s > -14 && s < 30 && (!o.moving || same > 0)) {
        passing = true;
        if (o.moving) passingMoving = true;
      }
      if (o.moving && same < -0.7 && s > 0 && s < 35 && Math.abs(l - myLat) < 2.6) headOn = true;
    }
    // протилежна проїжджа частина автостради чи швидкісної дороги (за відбійником) — завжди рух проти напрямку
    const dual = this.level.scenery === 'highway' && (!this.level.zones?.length || this.zone?.sign === 'D-7' || this.zone?.sign === 'D-9');
    const ahead = cellCenter(cell).addScaledVector(new THREE.Vector3(ax, 0, az), TILE);
    const nearXing = this.level.crosswalks.some((cw) => sameCell(cw.cell, cell) || sameCell(cw.cell, this.grid.cellAt(ahead.x, ahead.z)));
    if (headOn) this.violation('Небезпечний виїзд на зустрічну смугу');
    else if (passingMoving && this.noOvertake === dir) this.violation('Обгін у зоні знака B-25 «zakaz wyprzedzania»');
    else if (passingMoving && nearXing) this.violation('Обгін на пішохідному переході або перед ним');
    this.wrongLaneTime = passing && !dual ? 0 : this.wrongLaneTime + dt;
    if (this.wrongLaneTime > 2.5) this.violation(dual ? 'Їзда проти руху на автостраді / швидкісній дорозі' : 'Їзда по зустрічній смузі');
  }

  /** Зіткнення з іншими машинами (прямокутник машини проти кола гравця). */
  private collide() {
    const p = this.car.pos;
    const up = new THREE.Vector3(0, 1, 0);
    const obstacles: Obstacle[] = [...this.actors, ...this.traffic.cars];
    for (const a of obstacles) {
      if (!a.obj.visible) continue;
      const halfW = a.halfW + 1.05;
      const halfL = a.halfL + 1.05;
      const local = p.clone().sub(a.obj.position).applyAxisAngle(up, -a.obj.rotation.y);
      const px = halfW - Math.abs(local.x);
      const pz = halfL - Math.abs(local.z);
      if (px > 0 && pz > 0) {
        if (px < pz) local.x = Math.sign(local.x || 1) * halfW;
        else local.z = Math.sign(local.z || 1) * halfL;
        p.copy(local.applyAxisAngle(up, a.obj.rotation.y).add(a.obj.position));
        const kind = 'kind' in a ? (a as Actor3D).kind : 'car';
        const soft = kind === 'pedestrian' || kind === 'cyclist';
        const hard = Math.abs(this.car.speed) > (soft ? 0.5 : 3) || kind === 'train';
        this.car.speed *= soft || kind === 'train' ? 0 : -0.25;
        this.car.sync();
        const what = { pedestrian: 'Наїзд на пішохода!', cyclist: 'Наїзд на велосипедиста!', train: 'Зіткнення з потягом!' } as Record<string, string>;
        if (hard) this.violation(what[kind] ?? 'Зіткнення з іншим авто');
      }
    }
  }

  /** Переїзди, до яких наближається потяг (або ще опущені шлагбауми): трафік чекає перед ними. */
  private railStops(): Cell[] {
    return this.rails.filter((r) => r.danger).map((r) => r.cell);
  }

  /** Пішоходи на проїжджій частині — перед ними зупиняється й трафік. */
  private pedestrianSpots() {
    return this.actors
      .filter((a) => a.kind === 'pedestrian' && !a.walker && a.obj.position.y === 0)
      .map((a) => a.obj.position);
  }

  /** Перед чим зупиняється трафік: пішоходи на проїжджій частині й сценарні машини, що їдуть. */
  private trafficObstacles() {
    const vehicle = (a: Actor3D) => a.kind === 'car' || a.kind === 'bus' || a.kind === 'police' || a.kind === 'cyclist';
    // довга машина (автобус) — ще й передня й задня точки, щоб трафік не під'їжджав упритул до її середини
    const points = (a: Actor3D) => {
      if (a.halfL < 3) return [a.obj.position];
      const f = new THREE.Vector3(-Math.sin(a.obj.rotation.y), 0, -Math.cos(a.obj.rotation.y)).multiplyScalar(a.halfL - 2.15);
      return [a.obj.position, a.obj.position.clone().add(f), a.obj.position.clone().sub(f)];
    };
    const moving = this.actors.filter((a) => a.moving && a.obj.visible && vehicle(a)).flatMap(points);
    // сценарна машина, що стоїть просто в смузі й рушить після свого питання, — трафік стає за нею, а не проїжджає крізь
    // (машини біля бордюру й аварійні, що не рушають ніколи, не рахуються — інакше за ними був би вічний затор)
    const waiting = this.actors.filter((a, i) => {
      if (a.moving || !a.obj.visible || !a.go || a.kind === 'cyclist' || !vehicle(a)) return false;
      const lat = this.level.actors[i].lateral ?? (a.kind === 'bus' ? LANE + 1.2 : LANE);
      return Math.abs(lat - LANE) < 1.5;
    });
    this.traffic.blocked = new Set(waiting.map((a) => this.grid.cellAt(a.obj.position.x, a.obj.position.z).join(',')));
    return [...this.pedestrianSpots(), ...moving, ...waiting.flatMap(points)];
  }

  private frustum = new THREE.Frustum();
  private projView = new THREE.Matrix4();
  /** Довкола чого тримати трафік і що зараз у кадрі (за минулим кадром) — щоб машини не з'являлися на очах. */
  private viewArea() {
    this.projView.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    return { center: this.car.pos, frustum: this.frustum };
  }

  private navView(): NavView {
    const task = this.level.task;
    if (task === 'free' && !this.target) {
      return { icon: '🎯', dist: 'Вільна їзда', label: 'Натисни: обрати ціль', clickable: true };
    }
    if (this.nav.offRoute && !this.target) {
      return { icon: '↩', dist: 'Не туди!', label: 'Повернись на маршрут', color: '#e5484d' };
    }
    if (task === 'park' && this.nav.finished) {
      return { icon: '🅿️', dist: 'Паркування', label: 'Стань у синю рамку', color: '#3b82f6' };
    }
    if (!this.nav.active) return { icon: '↑', dist: '—', label: '' };

    const m: Maneuver = this.nav.nextManeuver(this.car.pos);
    const stop = this.level.stops?.[this.stopIdx];
    const dist = m.dist < 15 ? 'Зараз' : `${Math.round(m.dist / 10) * 10} м`;
    let icon: string, label: string;
    if (m.kind === 'rondo') [icon, label] = ['↻', `Рондо: ${m.exit}-й з'їзд`];
    else if (m.kind === 'turn') [icon, label] = TURN_VIEW[m.turn];
    else if (stop) [icon, label] = stop.kind === 'pickup' ? ['🧍', 'Пасажир'] : ['📍', 'Висадка'];
    else if (task === 'free') [icon, label] = ['🎯', 'Ціль'];
    else if (task === 'park') [icon, label] = ['🅿️', 'Паркування'];
    else [icon, label] = ['🏁', 'Фініш'];

    if (stop && m.kind !== 'finish') label += stop.kind === 'pickup' ? ' · до пасажира' : ' · висадка';
    return { icon, dist, label, clickable: task === 'free' };
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    if (this.state === 'driving') {
      this.violationCooldown = Math.max(0, this.violationCooldown - dt);
      const before = this.car.pos.clone();
      // будь-яке натискання керування вимикає автопілот
      const { input } = this;
      if (this.autoOn && (input.gas || input.brake || input.left || input.right)) this.setAuto(false, '🤖 Автопілот вимкнено — керуєш ти');
      if (this.autoOn && this.level.task === 'free' && !this.target) this.pickFreeTarget();
      const controls = this.autoOn
        ? this.autopilot.update(dt, {
          car: this.car, nav: this.nav, grid: this.grid, level: this.level, limit: this.limit,
          obstacles: this.autoObstacles(), rails: this.rails, stopSigns: this.stopSigns,
        })
        : input;
      const hit = this.car.update(dt, controls, this.grid);
      if (hit) this.ui.toast('Обережно, бордюр!', 1200);
      this.updateActors(dt);
      this.updateRails(dt);
      this.collide();
      this.distance += before.distanceTo(this.car.pos);

      const cell = this.carCell;
      this.traffic.update(dt, { pos: this.car.pos, cell, heading: this.car.heading, speed: this.car.speed }, this.trafficObstacles(), this.railStops(), this.viewArea());
      this.nav.update(cell);

      if (this.stopWatch) this.stopWatch.minSpeed = Math.min(this.stopWatch.minSpeed, Math.abs(this.car.speed));
      const key = cell.join(',');
      if (key !== this.lastCellKey) {
        this.lastCellKey = key;
        this.onEnterCell(cell);
      }

      // перевищення швидкості
      if (this.car.kmh > this.limit + 3) {
        this.overSpeedTime += dt;
        if (this.overSpeedTime > 1.5) this.violation(`Перевищення швидкості (ліміт ${this.limit} км/год)`);
      } else {
        this.overSpeedTime = 0;
      }
      this.checkRoadRules(dt, cell);

      if (this.state === 'driving') this.updateTasks(dt);

      if (this.state === 'driving') {
        this.ui.setNav(this.navView());
        this.ui.setSpeed(this.car.kmh, this.limit);
        this.ui.setProgress(this.level.task === 'route' || this.level.task === 'park' ? this.nav.ratio : null);
      }
    } else if (this.state === 'menu') {
      // повільний обліт міста на фоні меню
      this.camHeading += dt * 0.08;
      this.updateActors(dt);
      this.updateRails(dt);
      this.traffic.update(dt, { pos: new THREE.Vector3(-999, 0, -999), cell: [-99, -99] }, this.trafficObstacles(), this.railStops(), this.viewArea());
    }

    // пульсація маркера цілі
    if (this.beacon.visible) {
      this.beacon.rotation.y += dt;
      const s = 1 + Math.sin(this.time * 4) * 0.08;
      this.beacon.scale.set(s, 1, s);
    }
    if (this.person.visible) this.person.position.y = 0.35 + Math.abs(Math.sin(this.time * 5)) * 0.15;

    this.updateCamera(dt);
    this.minimap.draw(
      { x: this.car.pos.x, z: this.car.pos.z, heading: this.car.heading },
      this.nav.route,
      this.nav.progress,
      this.target ?? (this.level.park ? this.level.park.cell : null),
      this.traffic.cars.map((c) => ({ x: c.obj.position.x, z: c.obj.position.z })),
      this.time,
    );
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(dt: number) {
    if (this.state !== 'menu') {
      // камера плавно повертається за авто
      let diff = this.car.heading - this.camHeading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.camHeading += diff * Math.min(1, dt * 2.5);
    }
    const fwd = new THREE.Vector3(-Math.sin(this.camHeading), 0, -Math.cos(this.camHeading));
    const target = this.car.pos.clone().addScaledVector(fwd, 9);
    const desired = this.car.pos.clone().addScaledVector(fwd, -12);
    desired.y = 30;
    if (!Number.isFinite(this.camPos.x)) this.camPos.copy(desired);
    this.camPos.lerp(desired, Math.min(1, dt * 6));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target);

    this.sun.position.set(this.car.pos.x - 18, 80, this.car.pos.z + 12);
    this.sun.target.position.copy(this.car.pos);
  }
}
