import type { Cell } from '../../types';

/** Розгортає ключові точки маршруту (лише по горизонталі/вертикалі) у послідовність сусідніх клітинок. */
export function path(...points: Cell[]): Cell[] {
  const out: Cell[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    let [c, r] = out[out.length - 1];
    const [tc, tr] = points[i];
    while (c !== tc || r !== tr) {
      if (c !== tc) c += Math.sign(tc - c);
      else r += Math.sign(tr - r);
      out.push([c, r]);
    }
  }
  return out;
}
