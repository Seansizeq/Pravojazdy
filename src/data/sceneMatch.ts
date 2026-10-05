import type { ActorVariant, Cell, Dir, Level, SignAlt } from '../types';
import { BAY_LAT, DIR_VEC, OPP, RIGHT_OF, dirBetween, sameCell } from '../world/build';
import { POOLS } from './questions';
import { sceneSpec } from './scenes';

const LEFT_OF: Record<Dir, Dir> = { N: 'W', W: 'S', S: 'E', E: 'N' };
const DIRS: Dir[] = ['N', 'E', 'S', 'W'];

/** Як підлаштувати сцену під питання: різновид для учасників і варіант для знаків (за індексами в рівні). */
export interface SceneChoice {
  actors: [number, ActorVariant | undefined][];
  signs: [number, SignAlt | null][];
}

/**
 * Що бачить водій у точці cell, рухаючись у напрямку d: набір токенів у тому ж словнику,
 * що й вимоги до питань у scenes.ts (sign:X, plate:T, junction, xwalk, ped, carR …).
 */
export function sceneFacts(level: Level, cell: Cell, d: Dir): Set<string> {
  const f = new Set<string>(['gen']);
  const step = (c: Cell, dir: Dir, n = 1): Cell => [c[0] + DIR_VEC[dir][0] * n, c[1] + DIR_VEC[dir][1] * n];
  const road = (c: Cell) => c[1] >= 0 && c[1] < level.rows && c[0] >= 0 && c[0] < level.cols && level.map[c[1]][c[0]] === '#';
  const exits = (c: Cell) => DIRS.filter((x) => road(step(c, x)));
  const rondo = (c: Cell) => (level.roundabouts ?? []).some((r) => sameCell(r, c));
  const junction = (c: Cell) => road(c) && exits(c).length >= 3 && !rondo(c);
  const along = (k: number) => step(cell, d, k);
  const kOf = (c: Cell) => {
    for (let k = -6; k <= 5; k++) if (sameCell(along(k), c)) return k;
    return null;
  };

  // --- знаки й таблички в напрямку руху (щойно проїхані й попереду)
  for (const s of level.signs) {
    const k = kOf(s.cell);
    if (s.travel !== d || k === null || k < -2 || k > 2) continue;
    f.add(`sign:${s.type}`);
    if (s.below) f.add(`sign:${s.below}`);
    if (s.plate) f.add(`plate:${s.plate.replace(/ /g, '_')}`);
  }

  // --- геометрія попереду
  let J: Cell | null = null;
  for (let k = 1; k <= 2; k++) {
    const c = along(k);
    if (rondo(c)) f.add('rondo');
    if (!J && junction(c)) J = c;
  }
  if (J) {
    f.add('junction');
    if (!exits(J).includes(d)) f.add('tee');
  }
  // клітинки поперечних доріг одразу за перехрестям (куди можна повернути)
  const sideCells: Cell[] = J ? [step(J, RIGHT_OF[d]), step(J, LEFT_OF[d])] : [];
  const inSide = (c: Cell) => sideCells.some((x) => sameCell(x, c));
  for (let k = 0; k <= 2; k++) if (level.crosswalks.some((cw) => sameCell(cw.cell, along(k)))) f.add('xwalk');
  if (level.crosswalks.some((cw) => inSide(cw.cell))) f.add('xwalk');

  // --- переїзд
  for (const r of level.rails ?? []) {
    const k = kOf(r.cell);
    if (k === null || k < -2 || k > 3) continue;
    f.add('rail');
    if (r.barrier) f.add('rail:barrier');
    if ((r.tracks ?? 1) >= 2) f.add('rail:2');
    let stop = false;
    for (let j = Math.max(-2, k - 3); j <= k; j++) {
      if (level.signs.some((s) => s.travel === d && s.type === 'B-20' && sameCell(s.cell, along(j)))) stop = true;
    }
    if (stop) f.add('rail:stop');
    if (!stop && !r.barrier) f.add('rail:open');
  }

  // --- маневр на найближчому перехресті: за маршрутом або (без маршруту) за можливими виїздами
  const route = level.route ?? [];
  const i = route.findIndex((c) => sameCell(c, cell));
  if (i >= 0) {
    for (let j = i; j < route.length - 1 && j <= i + 3; j++) {
      if (!junction(route[j]) && !rondo(route[j])) continue;
      const a = j > 0 ? dirBetween(route[j - 1], route[j]) : d;
      const b = dirBetween(route[j], route[j + 1]);
      f.add(b === a ? 'straight' : b === RIGHT_OF[a] ? 'right' : b === LEFT_OF[a] ? 'left' : 'uturn');
      break;
    }
  } else if (J) {
    if (exits(J).includes(LEFT_OF[d])) f.add('left');
    if (exits(J).includes(RIGHT_OF[d])) f.add('right');
    if (exits(J).includes(d)) f.add('straight');
  }

  // клітинка маршруту в межах 8 клітинок позаду або 4 попереду від точки
  const onRouteNear = (c: Cell) => {
    if (i < 0) return false;
    for (let j = Math.max(0, i - 8); j <= Math.min(route.length - 1, i + 4); j++) if (sameCell(route[j], c)) return true;
    return false;
  };

  // --- учасники руху
  for (const a of level.actors) {
    const k = kOf(a.cell);
    const near = (k !== null && k >= -1 && k <= 3) || inSide(a.cell);
    if (a.kind === 'pedestrian') {
      if (!near) continue;
      if (a.variant === 'worker') {
        f.add('worker');
        continue;
      }
      if (a.walk) {
        // пішоходи йдуть проїжджою частиною
        f.add('pedroad');
        continue;
      }
      f.add('ped');
      if (a.variant === 'wheelchair') f.add('wheel');
      if (a.variant === 'cane') f.add('cane');
    } else if (a.kind === 'cyclist') {
      if (near) f.add(a.variant === 'scooter' ? 'scooter' : 'cyc');
    } else if (a.kind !== 'train') {
      if (near && a.kind === 'bus') f.add(a.variant === 'school' ? 'schoolbus' : 'bus');
      if (near && a.variant === 'truck') f.add('truck');
      // аварія поруч (попереду або щойно проїхана — і за поворотом, якщо їдеш за маршрутом)
      if ((a.yaw || a.blink === 'hazard') && ((k !== null && k >= -6 && k <= 4) || onRouteNear(a.cell))) f.add('acc');
      const parked = a.lateral !== undefined && Math.abs(a.lateral - BAY_LAT) < 0.6;
      if (parked) continue;
      if (a.face === OPP[d] && k !== null && k >= 0 && k <= 5) f.add('onc');
      if (a.face === d && k !== null && k >= 0 && k <= 3) f.add('ahead');
      if (J) {
        // авто на поперечній дорозі, що їде до перехрестя
        for (const side of [RIGHT_OF[d], LEFT_OF[d]]) {
          for (let n = 1; n <= 2; n++) {
            if (sameCell(a.cell, step(J, side, n)) && a.face === OPP[side]) {
              f.add('carX');
              f.add(side === RIGHT_OF[d] ? 'carR' : 'carL');
            }
          }
        }
      }
    }
  }
  for (const b of level.bays ?? []) {
    const k = kOf(b.cell);
    if (b.disabled && b.travel === d && k !== null && k >= -1 && k <= 2) f.add('disabledbay');
  }
  for (const p of level.props ?? []) {
    const k = kOf(p.cell);
    if (p.kind === 'triangle' && ((k !== null && k >= -6 && k <= 4) || onRouteNear(p.cell))) f.add('acc');
  }

  // --- середовище
  const scenery = level.scenery ?? 'city';
  f.add(scenery);
  if (scenery === 'highway') f.add('country');
  // на автостраді / швидкісній дорозі — за зоною, позначеною D-9 / D-7
  const zone = level.zones?.find((z) => cell[0] >= z.from[0] && cell[0] <= z.to[0] && cell[1] >= z.from[1] && cell[1] <= z.to[1]);
  if (zone?.sign === 'D-9') f.add('motorway');
  if (zone?.sign === 'D-7') f.add('expressway');
  // населений пункт (obszar zabudowany): місто або село між знаками D-42 і D-43
  if (scenery === 'city' || zone?.sign === 'D-42') f.add('builtup');
  const weather = weatherAt(level, cell);
  if (weather !== 'clear') f.add(weather);
  if (level.weather === 'night') f.add('night');
  return f;
}

/** Погода в клітинці з урахуванням зон погоди рівня. */
export function weatherAt(level: Level, cell: Cell): NonNullable<Level['weather']> {
  const z = level.weatherZones?.find(
    (w) => cell[0] >= w.from[0] && cell[0] <= w.to[0] && cell[1] >= w.from[1] && cell[1] <= w.to[1],
  );
  return z?.weather ?? level.weather ?? 'clear';
}

/** Яких токенів вимоги бракує у сцені (порожній масив — питання підходить). */
export function missing(spec: string, facts: Set<string>): string[] {
  const out: string[] = [];
  for (const tok of spec.split(/\s+/).filter(Boolean)) {
    if (tok.startsWith('!')) {
      if (facts.has(tok.slice(1))) out.push(tok);
      continue;
    }
    if (tok === 'turn') {
      if (!facts.has('left') && !facts.has('right')) out.push(tok);
      continue;
    }
    // 'sign:A-3|A-4' → будь-який із варіантів з тим самим префіксом
    const m = tok.match(/^([a-z]+:)(.+)$/);
    const alts = m ? m[2].split('|').map((v) => m[1] + v) : tok.split('|');
    if (!alts.some((a) => facts.has(a))) out.push(tok);
  }
  return out;
}

/**
 * Усі варіанти сцени точки: кожна комбінація різновидів учасників і варіантів знаків,
 * прив'язаних до цієї точки (go === key). Без підлаштування — лише основна сцена.
 */
export function sceneOptions(level: Level, cell: Cell, d: Dir, key: string, adaptive: boolean) {
  // лише елементи поруч із точкою, щоб точки з однаковою темою не перебивали одна одну
  const near = (c: Cell, kmin: number, kmax: number) => {
    for (let k = kmin; k <= kmax; k++) {
      if (sameCell(c, [cell[0] + DIR_VEC[d][0] * k, cell[1] + DIR_VEC[d][1] * k])) return true;
    }
    return false;
  };
  // і на поперечних дорогах одразу за перехрестям попереду (куди повертаєш)
  const at = (k: number): Cell => [cell[0] + DIR_VEC[d][0] * k, cell[1] + DIR_VEC[d][1] * k];
  const isRoad = (c: Cell) => c[1] >= 0 && c[1] < level.rows && c[0] >= 0 && c[0] < level.cols && level.map[c[1]][c[0]] === '#';
  const J = [at(1), at(2)].find((c) => isRoad(c) && DIRS.filter((x) => isRoad([c[0] + DIR_VEC[x][0], c[1] + DIR_VEC[x][1]])).length >= 3);
  const side = (c: Cell) =>
    !!J && [RIGHT_OF[d], LEFT_OF[d]].some((x) => sameCell(c, [J[0] + DIR_VEC[x][0], J[1] + DIR_VEC[x][1]]));
  const actorIdx = adaptive
    ? level.actors.flatMap((a, i) => (a.go === key && a.adapt?.length && (near(a.cell, -1, 3) || side(a.cell)) ? [i] : []))
    : [];
  const signIdx = adaptive
    ? level.signs.flatMap((s, i) => (s.go === key && s.alts?.length && s.travel === d && near(s.cell, -2, 2) ? [i] : []))
    : [];
  let choices: SceneChoice[] = [{ actors: [], signs: [] }];
  for (const i of actorIdx) {
    const opts: (ActorVariant | undefined)[] = [level.actors[i].variant, ...level.actors[i].adapt!];
    choices = choices.flatMap((c) => opts.map((v) => ({ ...c, actors: [...c.actors, [i, v] as [number, ActorVariant | undefined]] })));
  }
  for (const i of signIdx) {
    const opts: (SignAlt | null)[] = [null, ...level.signs[i].alts!];
    choices = choices.flatMap((c) => opts.map((v) => ({ ...c, signs: [...c.signs, [i, v] as [number, SignAlt | null]] })));
  }
  return choices.map((choice) => {
    const actors = level.actors.map((a, i) => {
      const c = choice.actors.find(([j]) => j === i);
      return c ? { ...a, variant: c[1] } : a;
    });
    const signs = level.signs.map((s, i) => {
      const c = choice.signs.find(([j]) => j === i);
      return c && c[1] ? { ...s, type: c[1].type, below: c[1].below, plate: c[1].plate } : s;
    });
    return { choice, facts: sceneFacts({ ...level, actors, signs }, cell, d) };
  });
}

/**
 * Питання з пулу (або з усієї бази в режимі іспиту), що відповідають сцені точки,
 * разом із тим, як підлаштувати сцену під кожне.
 */
export function matchingQuestions(
  level: Level, cell: Cell, d: Dir, key: string, all: string[] | null, adaptive: boolean,
): { id: string; choice: SceneChoice; choices: SceneChoice[] }[] {
  const options = sceneOptions(level, cell, d, key, adaptive);
  const ids = all ?? POOLS[key]?.ids ?? [];
  const out: { id: string; choice: SceneChoice; choices: SceneChoice[] }[] = [];
  for (const id of ids) {
    const spec = sceneSpec(id, all ? null : key, POOLS);
    // усі варіанти сцени, що підходять (наприклад, і візок, і біла тростина) — гра обере один випадково
    const ok = options.filter((o) => missing(spec, o.facts).length === 0).map((o) => o.choice);
    if (ok.length) out.push({ id, choice: ok[0], choices: ok });
  }
  return out;
}
