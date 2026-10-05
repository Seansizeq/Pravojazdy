import type { Cell, Dir, Level, SignType, Zone } from '../types';
import { DIR_VEC, OPP, RIGHT_OF, RoadGrid, dirBetween, sameCell } from '../world/build';
import { relTurn } from '../world/paths';
import { POOLS, QUESTIONS } from './questions';
import { matchingQuestions, weatherAt } from './sceneMatch';

const LEFT_OF: Record<Dir, Dir> = { N: 'W', W: 'S', S: 'E', E: 'N' };
const DIRS: Dir[] = ['N', 'E', 'S', 'W'];

/**
 * Перевіряє рівень на логічні помилки: знаки не там, де треба, питання не відповідає ситуації
 * на дорозі, зони без знаків на в'їзді/виїзді тощо. Повертає список проблем українською.
 */
export function auditLevel(level: Level): string[] {
  const out: string[] = [];
  const err = (m: string) => out.push(`[${level.id}] ${m}`);
  const g = new RoadGrid(level);
  const f = (c: Cell) => `(${c[0]},${c[1]})`;
  const road = (c: Cell) => g.isRoad(c[0], c[1]);
  const inMap = (c: Cell) => g.inBounds(c[0], c[1]);
  const step = (c: Cell, d: Dir, n = 1): Cell => [c[0] + DIR_VEC[d][0] * n, c[1] + DIR_VEC[d][1] * n];
  const exits = (c: Cell) => {
    const n = g.neighbors(c[0], c[1]);
    return DIRS.filter((d) => n[d]);
  };
  const junction = (c: Cell) => road(c) && exits(c).length >= 3;
  const rondo = (c: Cell) => g.isRoundabout(c[0], c[1]);
  const straight = (c: Cell) => {
    const e = exits(c);
    return e.length === 2 && e[0] === OPP[e[1]];
  };
  const signsAt = (c: Cell, d: Dir): SignType[] =>
    level.signs.filter((s) => sameCell(s.cell, c) && s.travel === d).flatMap((s) => (s.below ? [s.type, s.below] : [s.type]));
  const has = (c: Cell, d: Dir, t: SignType) => signsAt(c, d).includes(t);
  const crosswalk = (c: Cell) => level.crosswalks.some((cw) => sameCell(cw.cell, c));
  const zoneOf = (c: Cell): Zone | null =>
    level.zones?.find((z) => c[0] >= z.from[0] && c[0] <= z.to[0] && c[1] >= z.from[1] && c[1] <= z.to[1]) ?? null;
  const yieldSign = (c: Cell, d: Dir) => has(c, d, 'A-7') || has(c, d, 'B-20');
  const railAt = (c: Cell) => level.rails?.find((r) => sameCell(r.cell, c));
  const props = (c: Cell, kind: string) => (level.props ?? []).some((pr) => sameCell(pr.cell, c) && pr.kind === kind);
  const hazardAt = (c: Cell) => level.actors.some((a) => a.blink === 'hazard' && sameCell(a.cell, c));

  // ---------- карта
  if (level.map.length !== level.rows) err(`рядків у карті ${level.map.length}, а rows = ${level.rows}`);
  level.map.forEach((row, r) => row.length !== level.cols && err(`рядок ${r}: довжина ${row.length} ≠ ${level.cols}`));
  for (let r = 0; r < level.rows - 1; r++) {
    for (let c = 0; c < level.cols - 1; c++) {
      if (road([c, r]) && road([c + 1, r]) && road([c, r + 1]) && road([c + 1, r + 1])) err(`блок доріг 2×2 біля ${f([c, r])}`);
    }
  }
  if (!road(level.start.cell) || !exits(level.start.cell).includes(level.start.dir)) {
    err(`старт ${f(level.start.cell)} у напрямку ${level.start.dir} — не на дорозі`);
  }

  // ---------- маршрут
  const route = level.route ?? [];
  const routeDir = new Map<string, Dir>();
  route.forEach((c, i) => {
    if (!road(c) || !inMap(c)) err(`маршрут: ${f(c)} не дорога`);
    if (i > 0) {
      const p = route[i - 1];
      if (Math.abs(c[0] - p[0]) + Math.abs(c[1] - p[1]) !== 1) err(`маршрут: розрив між ${f(p)} і ${f(c)}`);
    }
    // напрямок, у якому авто в'їжджає в клітинку
    routeDir.set(c.join(','), i > 0 ? dirBetween(route[i - 1], c) : dirBetween(c, route[1]));
  });
  if (route.length && (!sameCell(route[0], level.start.cell) || dirBetween(route[0], route[1]) !== level.start.dir)) {
    err('маршрут не починається зі стартової клітинки/напрямку');
  }
  const routeIdx = (c: Cell) => route.findIndex((x) => sameCell(x, c));
  /** Наступний маневр маршруту після клітинки i: [клітинка, поворот]. */
  const nextTurn = (i: number): [Cell, string] | null => {
    for (let j = Math.max(1, i); j < route.length - 1; j++) {
      const a = dirBetween(route[j - 1], route[j]);
      const b = dirBetween(route[j], route[j + 1]);
      if (rondo(route[j])) return [route[j], 'rondo'];
      if (a !== b) return [route[j], relTurn(a, b)];
    }
    return null;
  };

  // ---------- рондо
  for (const rb of level.roundabouts ?? []) {
    if (!junction(rb)) err(`рондо ${f(rb)} має менше 3 виїздів`);
    for (const d of exits(rb)) {
      const a = step(rb, d);
      if (inMap(a) && !has(a, OPP[d], 'C-12')) err(`рондо ${f(rb)}: на в'їзді з ${f(a)} немає знака C-12`);
    }
  }

  // ---------- переходи
  for (const cw of level.crosswalks) {
    const [c, r] = cw.cell;
    if (!road(cw.cell)) err(`перехід ${f(cw.cell)} не на дорозі`);
    else if (!straight(cw.cell)) err(`перехід ${f(cw.cell)} не на прямій ділянці`);
    else if ((cw.axis === 'v') !== g.neighbors(c, r).N) err(`перехід ${f(cw.cell)}: неправильна орієнтація`);
  }

  // ---------- пішоходи йдуть упоперек дороги (на «зебрі» або поза нею — як у питаннях про перехід поза переходом)
  for (const a of level.actors.filter((x) => x.kind === 'pedestrian' && x.variant !== 'worker' && !x.walk)) {
    if (!road(a.cell)) {
      err(`пішохід ${f(a.cell)}: не на дорозі`);
      continue;
    }
    const vertical = road(step(a.cell, 'N')) || road(step(a.cell, 'S'));
    if (vertical === (a.face === 'N' || a.face === 'S')) err(`пішохід ${f(a.cell)}: іде вздовж дороги, а не впоперек`);
  }

  // ---------- знаки
  for (const s of level.signs) {
    const types = s.below ? [s.type, s.below] : [s.type];
    const where = `знак ${types.join('+')} ${f(s.cell)}→${s.travel}`;
    if (!road(s.cell)) {
      err(`${where}: не на дорозі`);
      continue;
    }
    if (!road(step(s.cell, s.travel))) {
      err(`${where}: у цьому напрямку тут не проїхати`);
      continue;
    }
    const next = step(s.cell, s.travel);
    const isYield = types.includes('B-20') || (types.includes('A-7') && !types.includes('C-12'));
    // табличка T-1 з відстанню («80 m»): перехрестя — за стільки метрів попереду
    const dist = s.plate?.match(/^(\d+) m$/);
    if (isYield && railAt(next) && types.includes('B-20')) {
      // STOP перед залізничним переїздом — окремий випадок (§ 21 ust. 4)
    } else if (isYield && dist) {
      const k = Math.round(Number(dist[1]) / 20);
      if (![k, k + 1].some((n) => junction(step(s.cell, s.travel, n)))) err(`${where}: за ${dist[1]} попереду немає перехрестя`);
    } else if (isYield) {
      if (!junction(next) || rondo(next)) err(`${where}: попереду немає перехрестя`);
      else {
        // поперечна дорога на цьому перехресті має бути головною — без A-7/B-20
        for (const p of [LEFT_OF[s.travel], RIGHT_OF[s.travel]]) {
          if (!exits(next).includes(p)) continue;
          const a = step(next, p);
          if (inMap(a) && yieldSign(a, OPP[p])) err(`${where}: поперечна дорога теж має знак «поступись»`);
        }
        if (!exits(next).includes(LEFT_OF[s.travel]) || !exits(next).includes(RIGHT_OF[s.travel])) {
          if (exits(next).includes(s.travel)) err(`${where}: стоїть на головній дорозі Т-перехрестя`);
        }
      }
    }
    if (types.includes('C-12') && !rondo(next)) err(`${where}: попереду немає рондо`);
    if ((types.includes('D-6') || types.includes('D-6b')) && !crosswalk(s.cell) && !crosswalk(next)) err(`${where}: поруч немає переходу`);
    const railAhead = (n: number) => {
      for (let k = 0; k <= n; k++) if (railAt(step(s.cell, s.travel, k))) return railAt(step(s.cell, s.travel, k));
      return undefined;
    };
    if (types.includes('A-9') && !railAhead(6)?.barrier) err(`${where}: попереду немає переїзду зі шлагбаумами`);
    if (types.includes('A-10') && (!railAhead(6) || railAhead(6)?.barrier)) err(`${where}: попереду немає переїзду без шлагбаумів`);
    if (types.includes('G-3') && !railAt(next)) err(`${where}: хрест G-3 не перед переїздом`);
    if (types.some((t) => t.startsWith('G-1')) && !railAhead(6)) err(`${where}: стовпчик G-1 не перед переїздом`);
    if (types.includes('A-8') && !(rondo(next) || rondo(step(s.cell, s.travel, 2)) || rondo(step(s.cell, s.travel, 3)))) {
      err(`${where}: попереду немає рондо`);
    }
    if (types.includes('D-15') && !straight(s.cell)) err(`${where}: зупинка не на прямій`);
    if (types.includes('D-1')) {
      // на найближчому перехресті поперечні в'їзди мають поступатися
      for (let k = 1, c = next; k <= 4; k++, c = step(c, s.travel)) {
        if (!road(c)) break;
        if (!junction(c)) continue;
        if (rondo(c)) break;
        for (const p of [LEFT_OF[s.travel], RIGHT_OF[s.travel]]) {
          const a = step(c, p);
          if (exits(c).includes(p) && inMap(a) && !yieldSign(a, OPP[p])) {
            err(`${where}: на перехресті ${f(c)} в'їзд з ${f(a)} без A-7/B-20`);
          }
        }
        break;
      }
    }
    const zoneSign: Partial<Record<SignType, number>> = { 'B-43': 30, 'D-40': 20 };
    for (const t of types) {
      // знаки, що відкривають зону рівня (D-42, D-7, D-9…), мають стояти на її межі
      const zs = level.zones?.filter((zz) => zz.sign === t) ?? [];
      if (zs.length && !zs.some((z) => zoneOf(next) === z || zoneOf(s.cell) === z)) err(`${where}: поруч немає зони «${zs[0].name}»`);
    }
    for (const t of types) {
      const lim = zoneSign[t];
      if (lim && zoneOf(next)?.limit !== lim && zoneOf(s.cell)?.limit !== lim) err(`${where}: поруч немає зони ${lim}`);
    }
  }

  // ---------- межі зон: знаки на в'їзді й виїзді
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const a: Cell = [c, r];
      if (!road(a)) continue;
      for (const d of exits(a)) {
        const b = step(a, d);
        if (!inMap(b)) continue;
        const za = zoneOf(a), zb = zoneOf(b);
        if (za === zb) continue;
        const near = (t: SignType) => has(a, d, t) || has(b, d, t);
        const startSign = (z: Zone): SignType => z.sign ?? (z.limit === 20 ? 'D-40' : 'B-43');
        const endSign = (z: Zone): SignType => z.end ?? (z.limit === 20 ? 'D-41' : 'B-44');
        if (zb && !near(startSign(zb))) err(`в'їзд у «${zb.name}» ${f(a)}→${f(b)} без знака ${startSign(zb)}`);
        if (za && !zb && !near(endSign(za))) err(`виїзд з «${za.name}» ${f(a)}→${f(b)} без знака ${endSign(za)}`);
      }
    }
  }

  // ---------- питання: чи відповідає ситуації на дорозі
  for (const t of level.triggers) {
    const where = `питання ${t.q} ${f(t.cell)}`;
    if (!level.exam && !POOLS[t.q]?.ids.length) {
      err(`${where}: такого пулу питань немає`);
      continue;
    }
    if (!road(t.cell)) {
      err(`${where}: не на дорозі`);
      continue;
    }
    const onRoute = routeIdx(t.cell);
    if (route.length && onRoute < 0) err(`${where}: не на маршруті — ніколи не спрацює`);
    const rd = routeDir.get(t.cell.join(','));
    if (t.dir && rd && t.dir !== rd) err(`${where}: напрямок ${t.dir}, а маршрут іде ${rd}`);
    const dirs: Dir[] = t.dir ? [t.dir] : rd ? [rd] : exits(t.cell).map((d) => OPP[d]).filter((d) => road(step(t.cell, d)));

    for (const d of dirs) {
      const next = step(t.cell, d);
      const actor = (kind: string) => level.actors.find((a) => a.go === t.q && a.kind === kind);
      const sign = (...types: SignType[]) => types.some((ty) => has(t.cell, d, ty));
      const railNear = (n: number, back = false) => (back ? backFind : ahead)(n, (c) => !!railAt(c));
      const backFind = (n: number, ok: (c: Cell) => boolean) => back(n, ok);
      // без маршруту (вільна їзда) дорога попереду однозначна аж до найближчого перехрестя:
      // клітинки, якими поїде авто, і поворот у кожній
      const freeAhead: [Cell, string][] = [];
      if (!route.length) {
        let c = t.cell, dir = d;
        for (let k = 0; k < 12; k++) {
          const nx = step(c, dir);
          if (!road(nx) || !inMap(nx) || junction(nx) || rondo(nx)) break;
          const out = exits(nx).filter((x) => x !== OPP[dir]);
          if (out.length !== 1) break;
          freeAhead.push([nx, relTurn(dir, out[0])]);
          c = nx;
          dir = out[0];
        }
      }
      const turnsAhead = (n: number) => {
        if (!route.length) return freeAhead.slice(0, n).filter(([, tr]) => tr !== 'straight').length;
        if (onRoute < 0) return 0;
        let cnt = 0;
        for (let j = onRoute + 1; j < Math.min(route.length - 1, onRoute + n + 1); j++) {
          if (dirBetween(route[j - 1], route[j]) !== dirBetween(route[j], route[j + 1])) cnt++;
        }
        return cnt;
      };
      const weather = weatherAt(level, t.cell);
      const back = (n: number, ok: (c: Cell) => boolean) => {
        for (let k = 0; k <= n; k++) if (ok(step(t.cell, OPP[d], k))) return true;
        return false;
      };
      const ahead = (n: number, ok: (c: Cell) => boolean) => {
        for (let k = 0; k <= n; k++) if (ok(step(t.cell, d, k))) return true;
        return false;
      };
      const passed = (type: SignType, n: number) => {
        if (onRoute >= 0) {
          for (let k = onRoute; k >= Math.max(0, onRoute - n); k--) {
            const c = route[k];
            if (has(c, routeDir.get(c.join(','))!, type)) return true;
          }
          return false;
        }
        return back(n, (c) => has(c, d, type));
      };
      const turn = onRoute >= 0 ? nextTurn(onRoute) : route.length ? null : freeAhead.find(([, tr]) => tr !== 'straight') ?? null;
      const railAhead6 = () => {
        for (let k = 0; k <= 6; k++) if (railAt(step(t.cell, d, k))) return railAt(step(t.cell, d, k));
        return undefined;
      };
      const turnSoon = (kind: string) => !!turn && turn[1] === kind && Math.abs(turn[0][0] - t.cell[0]) + Math.abs(turn[0][1] - t.cell[1]) <= 2;
      const need = (ok: boolean, why: string) => ok || err(`${where} (рух ${d}): ${why}`);

      switch (t.q) {
        case 'q_stop': need(has(t.cell, d, 'B-20'), 'немає знака STOP'); break;
        case 'q_yield_a7':
          // A-7 біля перехрестя або A-7 з табличкою відстані трохи раніше
          need(ahead(2, (c) => has(c, d, 'A-7')) && ahead(7, (c) => junction(c) && !rondo(c)), 'немає A-7 перед перехрестям');
          break;
        case 'q_priority_road': need(passed('D-1', 2), 'немає знака D-1'); break;
        case 'q_no_overtaking': need(has(t.cell, d, 'B-25'), 'немає знака B-25'); break;
        case 'q_uturn': need(has(t.cell, d, 'B-23'), 'немає знака B-23'); break;
        case 'q_parking': need(has(t.cell, d, 'B-35'), 'немає знака B-35'); break;
        case 'q_children': need(has(t.cell, d, 'A-17'), 'немає знака A-17'); break;
        case 'q_tempo30': need(passed('B-43', 4) && zoneOf(t.cell)?.limit === 30, 'не в зоні Tempo 30 / немає B-43'); break;
        case 'q_zone20': need(passed('D-40', 2) && zoneOf(t.cell)?.limit === 20, 'не в житловій зоні / немає D-40'); break;
        case 'q_rondo_priority':
          need(has(t.cell, d, 'C-12') && has(t.cell, d, 'A-7') && rondo(next), 'немає C-12 + A-7 перед рондо'); break;
        case 'q_rondo_no_a7':
          need(has(t.cell, d, 'C-12') && !has(t.cell, d, 'A-7') && rondo(next), 'має бути C-12 без A-7 перед рондо'); break;
        case 'q_rondo_direction':
        case 'q_rondo_signal': need(ahead(2, rondo), 'попереду немає рондо'); break;
        case 'q_crosswalk': {
          const cw = ahead(1, crosswalk) ? (crosswalk(t.cell) ? t.cell : next) : null;
          need(!!cw, 'попереду немає переходу');
          const ped = level.actors.some((a) => a.kind === 'pedestrian' && (!a.go || a.go === t.q) && !!cw && sameCell(a.cell, cw));
          need(ped, 'біля переходу немає пішохода, який почне переходити');
          break;
        }
        case 'q_right_hand': {
          const j = next;
          need(junction(j) && !rondo(j), 'попереду немає перехрестя');
          need(!exits(j).some((p) => inMap(step(j, p)) && (yieldSign(step(j, p), OPP[p]) || has(step(j, p), OPP[p], 'D-1'))),
            'перехрестя не рівнозначне (є знаки пріоритету)');
          const car = actor('car');
          need(!!car && sameCell(car.cell, step(j, RIGHT_OF[d])) && car.face === OPP[RIGHT_OF[d]], 'немає авто праворуч');
          if (route.length) need(turnSoon('right'), 'маршрут тут не повертає праворуч (а в питанні — так)');
          break;
        }
        case 'q_left_oncoming': {
          need(passed('D-1', 2) || sign('A-7'), 'немає знака D-1 чи A-7');
          if (route.length) need(turnSoon('left') && junction(turn![0]), 'маршрут не повертає ліворуч на перехресті');
          const car = actor('car');
          need(!!car && car.face === OPP[d], 'немає зустрічного авто');
          break;
        }
        case 'q_left_position':
          if (route.length) need(turnSoon('left') && junction(turn![0]), 'маршрут не повертає ліворуч на перехресті');
          else need(ahead(3, (c) => junction(c) && !rondo(c) && exits(c).includes(LEFT_OF[d])), 'попереду немає перехрестя з поворотом ліворуч');
          break;
        case 'q_bus_stop':
          need(ahead(1, (c) => has(c, d, 'D-15')), 'немає зупинки D-15');
          need(!!actor('bus'), 'на зупинці немає автобуса');
          break;
        case 'q_park_crosswalk': need(ahead(1, crosswalk), 'поруч немає переходу'); break;
        case 'q_no_stopping': need(sign('B-36'), 'немає знака B-36'); break;
        case 'q_rondo_warn': need(sign('A-8') && ahead(3, rondo), 'немає A-8 перед рондо'); break;
        case 'q_end_priority': need(ahead(2, (c) => has(c, d, 'D-2')), 'немає знака D-2'); break;
        case 'q_zone_exit': need(passed('D-41', 2), 'немає знака D-41'); break;
        // біля школи
        case 'sch_white_cane':
        case 'sch_turn_peds': {
          need(level.actors.some((a) => a.kind === 'pedestrian' && a.go === t.q), 'немає пішохода, який почне переходити');
          if (t.q === 'sch_turn_peds') need(turnSoon('right') || turnSoon('left'), 'маршрут тут не повертає');
          else need(ahead(1, crosswalk), 'попереду немає переходу');
          break;
        }
        case 'sch_cyclist': need(!!actor('cyclist') && actor('cyclist')!.face === d, 'попереду немає велосипедиста, що їде в тому ж напрямку'); break;
        case 'sch_cyclist_xing': {
          // переїзд попереду (зі знаком D-6b) або на дорозі, куди повертаєш праворуч
          const j = [step(t.cell, d), step(t.cell, d, 2)].find((c) => junction(c) && !rondo(c));
          const side = !!j && turnSoon('right') && crosswalk(step(j, RIGHT_OF[d]));
          need((ahead(1, (c) => has(c, d, 'D-6b')) && ahead(2, crosswalk)) || side, 'немає знака D-6b і переходу');
          need(!!actor('cyclist'), 'немає велосипедиста, який переїжджає');
          break;
        }
        case 'sch_no_overtake_xing': need(ahead(2, crosswalk), 'попереду немає переходу'); break;
        case 'sch_school_bus':
          need(ahead(2, (c) => level.actors.some((a) => a.kind === 'bus' && !!a.blink && sameCell(a.cell, c))), 'попереду немає автобуса з аварійкою чи поворотником');
          break;
        // заміська дорога
        case 'cty_exit_town': need(passed('D-43', 1), 'немає знака D-43'); break;
        case 'cty_speed90': need(!zoneOf(t.cell) && (level.limit ?? 50) === 90, 'тут не діє 90 км/год (поза населеним пунктом)'); break;
        case 'cty_curve_r': need(sign('A-1') && turnSoon('right'), 'немає A-1 перед поворотом праворуч'); break;
        case 'cty_curve_l': need(sign('A-2') && turnSoon('left'), 'немає A-2 перед поворотом ліворуч'); break;
        case 'cty_curves': {
          // знак із табличкою «Koniec» стоїть після звивистої ділянки, решта — перед двома й більше вигинами
          const end = level.signs.some((x) => x.travel === d && x.plate === 'Koniec' && sameCell(x.cell, t.cell));
          need(sign('A-3', 'A-4') && (end || turnsAhead(8) >= 2), 'немає A-3/A-4 перед двома поворотами');
          break;
        }
        case 'cty_a5': need(sign('A-5') && ahead(2, (c) => junction(c) && !rondo(c)), 'немає A-5 перед перехрестям'); break;
        case 'cty_a6': need(sign('A-5', 'A-6a', 'A-6b', 'A-6c', 'A-6d') && ahead(3, junction), 'немає A-5/A-6 перед перехрестям'); break;
        case 'cty_signs_dist': need(level.signs.some((x) => x.travel === d && sameCell(x.cell, t.cell) && x.type.startsWith('A-') && !!x.plate?.match(/^\d+ m$/)), 'немає попереджувального знака з табличкою відстані'); break;
        case 'cty_twoway': need(ahead(2, (c) => has(c, d, 'A-20')), 'немає знака A-20'); break;
        case 'cty_gravel': need(sign('A-28'), 'немає знака A-28'); break;
        case 'q_leave_parking':
          need(sign('D-41', 'D-47') || ahead(2, (c) => has(c, d, 'D-41') || has(c, d, 'D-47')) || passed('D-41', 2) || passed('D-47', 2), 'немає знака D-41 чи D-47 (виїзд на дорогу)');
          break;
        case 'sch_horn': need(level.actors.some((a) => (a.kind === 'cyclist' || !!a.walk) && (a.go === t.q || !a.go) && ahead(3, (c) => sameCell(c, a.cell))), 'попереду немає велосипедиста чи пішоходів на проїжджій частині'); break;
        case 'cty_bump': need(sign('A-11', 'A-11a'), 'немає знака A-11/A-11a'); break;
        case 'cty_works': need(sign('A-14') && ahead(3, (c) => props(c, 'barrier') || props(c, 'cone')), 'немає A-14 і огородження робіт'); break;
        case 'cty_animals': need(sign('A-18b'), 'немає знака A-18b'); break;
        case 'cty_wind': need(sign('A-19'), 'немає знака A-19'); break;
        case 'cty_cyclists': need(sign('A-24', 'A-25'), 'немає знака A-24/A-25'); break;
        case 'cty_lights_ahead': need(sign('A-29'), 'немає знака A-29'); break;
        case 'cty_narrow': need(sign('A-12a'), 'немає знака A-12a'); break;
        // залізниця
        case 'rail_a9': need(sign('A-9') && !!railAhead6()?.barrier, 'немає A-9 перед переїздом зі шлагбаумами'); break;
        case 'rail_a10': need(sign('A-10') && !!railAhead6() && !railAhead6()?.barrier, 'немає A-10 перед переїздом без шлагбаумів'); break;
        case 'rail_posts': need(sign('G-1a', 'G-1b', 'G-1c') && !!railAhead6(), 'немає стовпчика G-1 перед переїздом'); break;
        case 'rail_cross': need(sign('G-3') && !sign('B-20') && !!railAt(next), 'немає хреста G-3 (без STOP) перед переїздом'); break;
        case 'rail_stop': need(sign('B-20') && !!railAt(next), 'немає STOP перед переїздом'); break;
        case 'rail_signal': need(ahead(2, (c) => !!railAt(c)?.barrier), 'попереду немає переїзду зі шлагбаумами'); break;
        case 'rail_after': need(railNear(2, true), 'позаду немає переїзду'); break;
        case 'rail_stuck':
        case 'rail_queue': need(railNear(3) || railNear(3, true), 'поруч немає переїзду'); break;
        // траса
        case 'hw_motorway': need(passed('D-9', 3) || zoneOf(t.cell)?.sign === 'D-9', 'немає знака D-9 і це не автострада'); break;
        case 'hw_express': need(passed('D-7', 3) || zoneOf(t.cell)?.sign === 'D-7', 'немає знака D-7 і це не швидкісна дорога'); break;
        case 'hw_breakdown':
        case 'acc_triangle':
          // перед зламаним авто (видно трикутник і авто попереду) або щойно проїхавши його
          need(ahead(3, (c) => props(c, 'triangle')) || back(8, (c) => props(c, 'triangle')), 'поруч немає трикутника аварійної зупинки');
          need(ahead(8, hazardAt) || back(2, hazardAt), 'поруч немає авто з аварійкою');
          break;
        case 'acc_witness':
        case 'acc_duties': need(ahead(5, hazardAt), 'попереду немає ДТП (авто з аварійкою)'); break;
        // погода
        case 'fog_lights': need(['fog', 'night', 'snow'].includes(weather), 'на рівні немає туману/ночі/снігопаду'); break;
        case 'fog_drive':
        case 'night_beams':
        case 'night_parked': need(weather === 'fog' || weather === 'night', 'на рівні немає туману/ночі'); break;
        case 'win_frost': need(sign('A-32') && weather === 'snow', 'немає A-32 або рівень не зимовий'); break;
        case 'win_slippery':
        case 'win_lights':
        case 'win_overtake': need(weather === 'snow', 'рівень не зимовий'); break;
        case 'win_crosswalk': need(weather === 'snow' && ahead(1, crosswalk), 'немає переходу на зимовій дорозі'); break;
      }
    }
  }

  // ---------- кожна точка має хоча б одне офіційне питання, що відповідає ситуації на дорозі
  for (const t of level.triggers) {
    const route = level.route ?? [];
    const i = route.findIndex((c) => sameCell(c, t.cell));
    const rd = i < 0 ? null : i > 0 ? dirBetween(route[i - 1], t.cell) : dirBetween(t.cell, route[1]);
    const dirs: Dir[] = t.dir ? [t.dir] : rd ? [rd] : DIRS_ALL.filter((d) => road(step(t.cell, d)) && road(step(t.cell, OPP[d])));
    const all = level.exam ? Object.keys(QUESTIONS) : null;
    for (const d of dirs) {
      if (!matchingQuestions(level, t.cell, d, t.q, all, route.length > 0).length) {
        err(`точка ${t.q} ${f(t.cell)} (рух ${d}): жодне питання пулу не відповідає сцені`);
      }
    }
  }
  return out;
}

const DIRS_ALL: Dir[] = ['N', 'E', 'S', 'W'];

/** Перевіряє всі рівні й пише результат у консоль (лише в dev-режимі). */
export function auditAll(levels: Level[]) {
  const issues = levels.flatMap(auditLevel);
  if (issues.length) console.warn(`Перевірка рівнів: ${issues.length} проблем\n` + issues.join('\n'));
  else console.info('Перевірка рівнів: усе гаразд ✅');
  return issues;
}
