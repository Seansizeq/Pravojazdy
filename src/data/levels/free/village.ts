import type { Level } from '../../../types';
import { BAY_LAT } from '../../../world/build';
import { crossings, gates } from './common';

// Село 34×34: два села (50 км/год) серед полів, садів і пасовищ, дороги між ними (90 км/год),
// рівнозначне перехрестя з A-5 і залізниця, що перетинає три дороги: переїзд зі шлагбаумами (A-9, G-1),
// зі STOP (A-10, B-20 + G-3) і лише з хрестом G-3. Потяг курсує за розкладом.
const XING = crossings([
  { cell: [6, 5], face: 'N' },
  { cell: [8, 7], face: 'E' },
  { cell: [22, 22], face: 'N' },
  { cell: [25, 24], face: 'E', variant: 'cane' },
  { cell: [28, 27], face: 'S' },
]);

export const FREE_VILLAGE: Level = {
  id: 'free-village',
  name: 'Село',
  icon: '🏡',
  description: 'Поля, сади й корови: два села, заміські дороги, рівнозначне перехрестя і три залізничні переїзди з потягом.',
  task: 'free',
  theme: 'village',
  seed: 5150,
  traffic: 24,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  cols: 34,
  rows: 34,
  map: [
    '..................................', // 0
    '..................................', // 1
    '..................................', // 2
    '..................................', // 3
    '..................................', // 4
    '...#########################......', // 5
    '...#....#...#....#.........#......', // 6
    '...#....#...#....#.........#......', // 7
    '...#....#...#....#.........#......', // 8
    '...##########....#.........#......', // 9
    '........#........#.........#......', // 10
    '........#........#.........#......', // 11
    '........#........#.........#......', // 12
    '........#........#.........#......', // 13
    '........#........#.........#......', // 14
    '........#........#.........#......', // 15
    '........####################......', // 16
    '........#........#.........#......', // 17
    '........#........#.........#......', // 18
    '........#........#.........#......', // 19
    '........#........#.........#......', // 20 ← залізниця
    '........#........#.........#......', // 21
    '........#........#..###########...', // 22
    '........#........#..#....#....#...', // 23
    '........##########..#....#....#...', // 24
    '.................#..#....#....#...', // 25
    '.................#..#....#....#...', // 26
    '.................##############...', // 27
    '..................................', // 28
    '..................................', // 29
    '..................................', // 30
    '..................................', // 31
    '..................................', // 32
    '..................................', // 33
  ],
  start: { cell: [12, 16], dir: 'E' },
  zones: [
    { from: [2, 4], to: [13, 10], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' },
    { from: [19, 21], to: [31, 28], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' },
  ],
  rails: [
    { cell: [8, 20], axis: 'v', barrier: true },
    { cell: [17, 20], axis: 'v' },
    { cell: [27, 20], axis: 'v' },
  ],
  water: [{ from: [12, 29], to: [15, 31] }],
  landmarks: [
    { cell: [5, 7], kind: 'church', face: 'N' },
    { cell: [10, 6], kind: 'school', face: 'N' },
    { cell: [14, 12], kind: 'windmill' },
    { cell: [31, 12], kind: 'windmill' },
    { cell: [27, 24], kind: 'church', face: 'N' },
    { cell: [18, 4], kind: 'fuel', face: 'S' },
  ],
  triggers: [
    // села
    { cell: [14, 5], q: 'q_speed50', dir: 'W' },
    { cell: [8, 11], q: 'q_speed50', dir: 'N' },
    { cell: [27, 21], q: 'q_speed50', dir: 'S' },
    { cell: [18, 27], q: 'q_speed50', dir: 'E' },
    { cell: [14, 5], q: 'cty_exit_town', dir: 'E' },
    { cell: [8, 11], q: 'cty_exit_town', dir: 'S' },
    { cell: [27, 21], q: 'cty_exit_town', dir: 'N' },
    { cell: [18, 27], q: 'cty_exit_town', dir: 'W' },
    { cell: [15, 5], q: 'cty_speed90', dir: 'E' },
    { cell: [8, 12], q: 'cty_speed90', dir: 'S' },
    { cell: [8, 12], q: 'cty_bump', dir: 'N' },
    { cell: [11, 5], q: 'q_children', dir: 'W' },
    { cell: [8, 6], q: 'q_yield_a7', dir: 'N' },
    { cell: [12, 6], q: 'q_yield_a7', dir: 'N' },
    { cell: [5, 9], q: 'dt_bus_bay', dir: 'E' },
    { cell: [28, 22], q: 'dt_bus_bay', dir: 'E' },
    { cell: [25, 23], q: 'q_stop', dir: 'N' },
    { cell: [25, 26], q: 'q_yield_a7', dir: 'S' },
    { cell: [23, 27], q: 'q_no_stopping', dir: 'W' },
    ...XING.triggers,
    // заміські дороги
    { cell: [17, 14], q: 'cty_a5', dir: 'S' },
    { cell: [15, 16], q: 'cty_a5', dir: 'E' },
    { cell: [19, 16], q: 'cty_a5', dir: 'W' },
    { cell: [17, 18], q: 'cty_a5', dir: 'N' },
    { cell: [17, 6], q: 'q_yield_a7', dir: 'N' },
    { cell: [9, 16], q: 'q_stop', dir: 'W' },
    { cell: [26, 16], q: 'q_yield_a7', dir: 'E' },
    { cell: [16, 24], q: 'q_yield_a7', dir: 'E' },
    { cell: [25, 5], q: 'cty_curve_r', dir: 'E' },
    { cell: [27, 7], q: 'cty_curve_l', dir: 'N' },
    { cell: [8, 22], q: 'cty_curve_l', dir: 'S' },
    { cell: [10, 24], q: 'cty_curve_r', dir: 'W' },
    { cell: [17, 25], q: 'cty_curve_l', dir: 'S' },
    { cell: [27, 9], q: 'cty_animals', dir: 'S' },
    { cell: [17, 10], q: 'cty_cyclists', dir: 'S' },
    { cell: [22, 5], q: 'q_no_overtaking', dir: 'E' },
    // переїзд 1 — шлагбауми
    { cell: [8, 17], q: 'rail_a9', dir: 'S' },
    { cell: [8, 18], q: 'rail_posts', dir: 'S' },
    { cell: [8, 19], q: 'rail_signal', dir: 'S' },
    { cell: [8, 21], q: 'rail_after', dir: 'S' },
    { cell: [8, 23], q: 'rail_a9', dir: 'N' },
    { cell: [8, 21], q: 'rail_signal', dir: 'N' },
    // переїзд 2 — STOP
    { cell: [17, 17], q: 'rail_a10', dir: 'S' },
    { cell: [17, 19], q: 'rail_stop', dir: 'S' },
    { cell: [17, 22], q: 'rail_after', dir: 'S' },
    { cell: [17, 23], q: 'rail_a10', dir: 'N' },
    { cell: [17, 21], q: 'rail_stop', dir: 'N' },
    // переїзд 3 — лише хрест G-3
    { cell: [27, 17], q: 'rail_a10', dir: 'S' },
    { cell: [27, 18], q: 'rail_stuck', dir: 'S' },
    { cell: [27, 19], q: 'rail_cross', dir: 'S' },
    // загальні
    { cell: [12, 16], q: 'q_lights' },
    { cell: [22, 16], q: 'dash_lamps' },
    { cell: [17, 12], q: 'taxi_phone' },
    { cell: [27, 12], q: 'hw_towing' },
    { cell: [13, 24], q: 'dt_left_edge' },
  ],
  signs: [
    ...gates([[[14, 5], [13, 5]], [[8, 11], [8, 10]], [[18, 27], [19, 27]]]),
    // в'їзд у друге село з півночі — одразу за переїздом, тож обидва знаки в клітинці села
    ...gates([[[27, 20], [27, 21]]], 'D-42', 'D-43', true),
    { cell: [11, 5], travel: 'W', type: 'A-17' },
    { cell: [8, 6], travel: 'N', type: 'A-7' },
    { cell: [12, 6], travel: 'N', type: 'A-7' },
    { cell: [5, 9], travel: 'E', type: 'D-15' },
    { cell: [28, 22], travel: 'E', type: 'D-15' },
    { cell: [25, 23], travel: 'N', type: 'B-20' },
    { cell: [25, 26], travel: 'S', type: 'A-7' },
    { cell: [23, 27], travel: 'W', type: 'B-36' },
    { cell: [8, 12], travel: 'N', type: 'A-11a', plate: '25 m' },
    ...XING.signs,
    // рівнозначне перехрестя посеред полів
    { cell: [17, 14], travel: 'S', type: 'A-5' },
    { cell: [15, 16], travel: 'E', type: 'A-5' },
    { cell: [19, 16], travel: 'W', type: 'A-5' },
    { cell: [17, 18], travel: 'N', type: 'A-5' },
    // примикання до головних доріг
    { cell: [17, 6], travel: 'N', type: 'A-7' },
    { cell: [9, 16], travel: 'W', type: 'B-20' },
    { cell: [26, 16], travel: 'E', type: 'A-7' },
    { cell: [16, 24], travel: 'E', type: 'A-7' },
    // повороти
    { cell: [25, 5], travel: 'E', type: 'A-1' },
    { cell: [27, 7], travel: 'N', type: 'A-2' },
    { cell: [8, 22], travel: 'S', type: 'A-2' },
    { cell: [10, 24], travel: 'W', type: 'A-1' },
    { cell: [17, 25], travel: 'S', type: 'A-2' },
    { cell: [27, 9], travel: 'S', type: 'A-18b', plate: '3 km' },
    { cell: [17, 10], travel: 'S', type: 'A-24' },
    { cell: [22, 5], travel: 'E', type: 'B-25' },
    // переїзд 1: A-9 над стовпчиком G-1a, далі G-1b і G-1c — з обох боків
    { cell: [8, 17], travel: 'S', type: 'A-9', below: 'G-1a' },
    { cell: [8, 18], travel: 'S', type: 'G-1b' },
    { cell: [8, 19], travel: 'S', type: 'G-1c' },
    { cell: [8, 23], travel: 'N', type: 'A-9', below: 'G-1a' },
    { cell: [8, 22], travel: 'N', type: 'G-1b' },
    { cell: [8, 21], travel: 'N', type: 'G-1c' },
    // переїзд 2: A-10, потім STOP над хрестом G-3
    { cell: [17, 17], travel: 'S', type: 'A-10' },
    { cell: [17, 19], travel: 'S', type: 'B-20', below: 'G-3' },
    { cell: [17, 23], travel: 'N', type: 'A-10' },
    { cell: [17, 21], travel: 'N', type: 'B-20', below: 'G-3' },
    // переїзд 3: A-10 і хрест G-3 без STOP
    { cell: [27, 17], travel: 'S', type: 'A-10' },
    { cell: [27, 19], travel: 'S', type: 'G-3' },
    { cell: [27, 21], travel: 'N', type: 'G-3' },
  ],
  crosswalks: XING.crosswalks,
  actors: [
    ...XING.actors,
    // потяг: зі заходу на схід через усі три переїзди, далі — пауза й наступний
    { cell: [0, 20], kind: 'train', face: 'E', along: -260, travel: 34 * 20 + 520 },
    // припарковані в селах
    { cell: [4, 5], kind: 'car', face: 'E', color: 0x9b6be6, lateral: BAY_LAT },
    { cell: [10, 9], kind: 'car', face: 'W', color: 0xf2f2f2, lateral: BAY_LAT },
    { cell: [21, 27], kind: 'car', face: 'E', color: 0x3ccf7a, lateral: BAY_LAT },
    { cell: [30, 24], kind: 'car', face: 'N', color: 0xe66a4f, lateral: BAY_LAT },
  ],
};
