import type { Actor, ActorVariant, Cell, Dir, SignDef, SignType, Trigger } from '../../../types';
import { OPP, dirBetween } from '../../../world/build';

/**
 * Знаки на межі зони: для кожної пари [ззовні, всередині] — знак початку зони (за замовчуванням D-42)
 * для в'їзду і знак кінця (D-43) для виїзду, обидва — біля самої межі клітинок.
 * inside — обидва знаки в клітинці всередині зони (коли зовнішня клітинка — перехрестя).
 */
export function gates(pairs: [Cell, Cell][], enter: SignType = 'D-42', exit: SignType = 'D-43', inside = false): SignDef[] {
  return pairs.flatMap(([out, inn]) => {
    const d = dirBetween(out, inn);
    return [
      inside ? { cell: inn, travel: d, type: enter, along: -6 } : { cell: out, travel: d, type: enter, along: 6 },
      { cell: inn, travel: OPP[d], type: exit, along: 6 },
    ];
  });
}

/**
 * Пішохідні переходи: «зебра», знаки D-6 з обох боків, пішохід, що постійно переходить дорогу
 * в напрямку face, і точка з питанням про перехід.
 */
export function crossings(list: { cell: Cell; face: Dir; variant?: ActorVariant; quiz?: boolean }[]) {
  const crosswalks: { cell: Cell; axis: 'v' | 'h' }[] = [];
  const actors: Actor[] = [];
  const signs: SignDef[] = [];
  const triggers: Trigger[] = [];
  for (const x of list) {
    // пішохід іде впоперек дороги: на схід/захід — дорога вертикальна
    const vertical = x.face === 'E' || x.face === 'W';
    crosswalks.push({ cell: x.cell, axis: vertical ? 'v' : 'h' });
    actors.push({ cell: x.cell, kind: 'pedestrian', face: x.face, variant: x.variant });
    for (const travel of (vertical ? ['N', 'S'] : ['E', 'W']) as Dir[]) signs.push({ cell: x.cell, travel, type: 'D-6' });
    if (x.quiz !== false) triggers.push({ cell: x.cell, q: 'q_crosswalk' });
  }
  return { crosswalks, actors, signs, triggers };
}
