import type { Level } from '../../types';
import { path } from './util';

// Залізничні переїзди: на старті — без шлагбаумів, перед ним авто, яке хочеться обігнати;
// далі зі шлагбаумами і світлофором (A-9, стовпчики G-1), без шлагбаумів зі STOP (A-10)
// і лише з хрестом G-3. На трьох останніх після питання їде потяг.
export const RAIL: Level = {
  id: 'rail',
  name: 'Залізничні переїзди',
  icon: '🚂',
  description: 'Переїзди зі шлагбаумами, зі STOP і без нічого. Почекай на потяг, не об’їжджай шлагбаум.',
  task: 'route',
  seed: 3131,
  // міський трафік не вміє чекати перед шлагбаумом — тому без нього
  traffic: 0,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  quiz: { gap: 100, chance: 0.85 },
  cols: 12,
  rows: 32,
  map: [
    '.........#..', // 0
    '.........#..', // 1
    '.........#..', // 2
    '.........#..', // 3
    '.........#..', // 4  ← переїзд 3: лише G-3
    '.........#..', // 5
    '.........#..', // 6
    '...#######..', // 7
    '...#........', // 8
    '...#........', // 9
    '...#........', // 10 ← переїзд 2: STOP
    '...#........', // 11
    '...#........', // 12
    '...#######..', // 13
    '.........#..', // 14
    '.........#..', // 15
    '.........#..', // 16
    '.........#..', // 17 ← переїзд 1: шлагбауми
    '.........#..', // 18
    '.........#..', // 19
    '.........#..', // 20
    '.........#..', // 21
    '.........#..', // 22
    '.........#..', // 23
    '.........#..', // 24
    '.........#..', // 25
    '.........#..', // 26 ← переїзд 0: A-10 і хрест G-3, перед ним — авто
    '.........#..', // 27
    '.........#..', // 28
    '.........#..', // 29
    '.........#..', // 30
    '.........#..', // 31
  ],
  start: { cell: [9, 31], dir: 'N' },
  route: path([9, 31], [9, 13], [3, 13], [3, 7], [9, 7], [9, 0]),
  rails: [
    { cell: [9, 26], axis: 'v' },
    { cell: [9, 17], axis: 'v', barrier: true, tracks: 2, go: 'rail_posts' },
    { cell: [3, 10], axis: 'v', go: 'rail_a10' },
    { cell: [9, 4], axis: 'v', go: 'rail_cross' },
  ],
  triggers: [
    { cell: [9, 29], q: 'cty_overtake' },
    { cell: [9, 21], q: 'rail_a9' },
    { cell: [9, 19], q: 'rail_posts' },
    { cell: [9, 18], q: 'rail_signal' },
    { cell: [9, 16], q: 'rail_after' },
    { cell: [9, 15], q: 'rail_stuck' },
    { cell: [3, 12], q: 'rail_a10' },
    { cell: [3, 11], q: 'rail_stop' },
    { cell: [3, 8], q: 'rail_after' },
    { cell: [9, 6], q: 'rail_queue' },
    { cell: [9, 5], q: 'rail_cross' },
    { cell: [9, 2], q: 'rail_stuck' },
  ],
  signs: [
    // переїзд 0 без шлагбаумів: A-10 і хрест G-3
    { cell: [9, 29], travel: 'N', type: 'A-10' },
    { cell: [9, 27], travel: 'N', type: 'G-3' },
    // переїзд 1 зі шлагбаумами: A-9 над стовпчиком G-1a, далі G-1b і G-1c
    { cell: [9, 21], travel: 'N', type: 'A-9', below: 'G-1a' },
    { cell: [9, 20], travel: 'N', type: 'G-1b' },
    { cell: [9, 19], travel: 'N', type: 'G-1c' },
    // переїзд 2 без шлагбаумів: A-10, потім STOP над хрестом G-3
    { cell: [3, 12], travel: 'N', type: 'A-10', below: 'G-1a' },
    { cell: [3, 11], travel: 'N', type: 'B-20', below: 'G-3' },
    // переїзд 3: A-10 і хрест G-3 без STOP
    { cell: [9, 6], travel: 'N', type: 'A-10' },
    { cell: [9, 5], travel: 'N', type: 'G-3' },
  ],
  crosswalks: [],
  actors: [
    { cell: [9, 17], kind: 'train', face: 'W', lateral: 2.2, along: -170, go: 'rail_posts', travel: 360 },
    { cell: [3, 10], kind: 'train', face: 'E', lateral: 0, along: -260, go: 'rail_a10', travel: 520 },
    { cell: [9, 4], kind: 'train', face: 'W', lateral: 0, along: -110, go: 'rail_cross', travel: 300 },
    // повільне авто попереду (під питання — вантажівка) перед переїздом 0: обганяти тут не можна
    { cell: [9, 27], kind: 'car', face: 'N', color: 0x9b6be6, along: 4, go: 'cty_overtake', travel: 70, adapt: ['truck'] },
    // авто попереду перед STOP на переїзді 2 — рушає, щойно наближаєшся
    { cell: [3, 11], kind: 'car', face: 'N', color: 0x3ccf7a, along: 4, go: 'rail_a10', travel: 50 },
    // авто попереду перед переїздом 3 — питання про чергу й місце за переїздом
    { cell: [9, 5], kind: 'car', face: 'N', color: 0xe66a4f, along: 4, go: 'rail_queue', travel: 45 },
  ],
};
