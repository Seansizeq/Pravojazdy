import type { Level } from '../../../types';
import { BAY_LAT } from '../../../world/build';
import { crossings, gates } from './common';

// Європейське місто 32×32: кам'яниці з двосхилими дахами, ринкова площа з ратушею, костел, річка з трьома
// мостами й набережними, два рондо, головна вулиця з D-1, зона Tempo 30 і житлова зона (D-40).
const XING = crossings([
  { cell: [12, 10], face: 'N' },
  { cell: [12, 14], face: 'S', variant: 'wheelchair' },
  { cell: [10, 12], face: 'E' },
  { cell: [14, 12], face: 'W', variant: 'cane' },
  { cell: [16, 2], face: 'N' },
  { cell: [26, 14], face: 'S' },
  { cell: [19, 25], face: 'E' },
  { cell: [4, 6], face: 'N' },
  { cell: [8, 29], face: 'S' },
  { cell: [24, 4], face: 'W' },
  { cell: [2, 4], face: 'E' },
]);

export const FREE_EURO: Level = {
  id: 'free-euro',
  name: 'Європейське місто',
  icon: '🏰',
  description: 'Старе місто з ринковою площею, костелом і річкою: мости, рондо, Tempo 30, житлова зона, багато «зебр».',
  task: 'free',
  theme: 'euro',
  seed: 2027,
  traffic: 48,
  scenery: 'city',
  cols: 32,
  rows: 32,
  map: [
    '................................', // 0
    '................................', // 1
    '..############################..', // 2
    '..#...#...#........#....#....#..', // 3
    '..#...#...#........#....#....#..', // 4
    '..#...#...#........#....#....#..', // 5
    '..##################....#....#..', // 6
    '..#...#...#...#....#....#....#..', // 7
    '..#...#...#...#....#....######..', // 8
    '..#...#...#...#....#....#....#..', // 9
    '..#...##############....#....#..', // 10
    '..#...#...#...#....#....#....#..', // 11
    '..#...#...#...#....#....#....#..', // 12
    '..#...#...#...#....#....#....#..', // 13
    '..############################..', // 14
    '..#...#...#...#....#....#....#..', // 15
    '..#...#...#...#....#....#....#..', // 16
    '..#...#...#...#....#....#....#..', // 17
    '..#...##############....#....#..', // 18
    '..#...#...#...#....#....#....#..', // 19
    '..#...#...#...#....#....######..', // 20
    '..#...#...#...#....#....#..#.#..', // 21
    '..##################....#..#.#..', // 22
    '..#...#...#...#....#....#..#.#..', // 23
    '..#...#...#...#....#....#..#.#..', // 24
    '..#...#...#...#....#....#..#.#..', // 25
    '..#############....#....#..#.#..', // 26
    '..#...#...#...#....#....#..#.#..', // 27
    '..#...#...#...#....#....#..#.#..', // 28
    '..############################..', // 29
    '................................', // 30
    '................................', // 31
  ],
  start: { cell: [16, 29], dir: 'E' },
  roundabouts: [[10, 22], [24, 14]],
  zones: [
    { from: [3, 23], to: [9, 28], limit: 30, name: 'Strefa Tempo 30' },
    { from: [25, 21], to: [28, 28], limit: 20, name: 'Strefa zamieszkania', sign: 'D-40', end: 'D-41' },
  ],
  // річка з мостами (рядки 2, 14 і 29 — дороги над водою)
  water: [{ from: [21, -8], to: [22, 39] }],
  landmarks: [
    { cell: [12, 12], kind: 'townhall' },
    { cell: [11, 11], kind: 'square' },
    { cell: [12, 11], kind: 'square' },
    { cell: [13, 11], kind: 'square' },
    { cell: [11, 12], kind: 'square' },
    { cell: [13, 12], kind: 'square' },
    { cell: [11, 13], kind: 'square' },
    { cell: [13, 13], kind: 'square' },
    { cell: [12, 13], kind: 'fountain' },
    { cell: [8, 8], kind: 'church', face: 'S' },
    { cell: [3, 4], kind: 'school', face: 'W' },
  ],
  triggers: [
    // головна вулиця (рядок 14) і бічні в'їзди
    { cell: [5, 14], q: 'q_priority_road', dir: 'E' },
    { cell: [15, 14], q: 'q_priority_road', dir: 'W' },
    { cell: [6, 13], q: 'q_yield_a7', dir: 'S' },
    { cell: [6, 15], q: 'q_yield_a7', dir: 'N' },
    { cell: [14, 13], q: 'q_stop', dir: 'S' },
    { cell: [14, 15], q: 'q_stop', dir: 'N' },
    { cell: [10, 5], q: 'q_priority_road', dir: 'S' },
    { cell: [9, 6], q: 'q_stop', dir: 'E' },
    { cell: [11, 6], q: 'q_stop', dir: 'W' },
    { cell: [18, 22], q: 'q_yield_a7', dir: 'E' },
    { cell: [25, 8], q: 'q_stop', dir: 'W' },
    { cell: [28, 20], q: 'q_yield_a7', dir: 'E' },
    // рондо
    { cell: [10, 21], q: 'q_rondo_priority', dir: 'S' },
    { cell: [9, 22], q: 'q_rondo_priority', dir: 'E' },
    { cell: [11, 22], q: 'q_rondo_priority', dir: 'W' },
    { cell: [10, 23], q: 'q_rondo_priority', dir: 'N' },
    { cell: [24, 13], q: 'q_rondo_priority', dir: 'S' },
    { cell: [23, 14], q: 'q_rondo_priority', dir: 'E' },
    { cell: [25, 14], q: 'q_rondo_priority', dir: 'W' },
    { cell: [24, 15], q: 'q_rondo_priority', dir: 'N' },
    // житлова зона
    { cell: [27, 21], q: 'q_zone20', dir: 'S' },
    { cell: [27, 28], q: 'q_zone20', dir: 'N' },
    { cell: [27, 20], q: 'q_zone_exit', dir: 'N' },
    { cell: [27, 29], q: 'q_zone_exit', dir: 'S' },
    // знаки заборони, зупинки, школа, паркування
    { cell: [12, 18], q: 'q_no_stopping', dir: 'E' },
    { cell: [24, 23], q: 'q_uturn', dir: 'N' },
    { cell: [19, 8], q: 'q_no_overtaking', dir: 'S' },
    { cell: [2, 8], q: 'q_children', dir: 'N' },
    { cell: [8, 14], q: 'dt_bus_bay', dir: 'E' },
    { cell: [28, 14], q: 'dt_bus_bay', dir: 'W' },
    { cell: [12, 22], q: 'dt_disabled', dir: 'E' },
    { cell: [11, 10], q: 'q_park_crosswalk', dir: 'E' },
    { cell: [16, 6], q: 'q_left_position', dir: 'W' },
    { cell: [25, 29], q: 'q_left_position', dir: 'E' },
    { cell: [17, 22], q: 'dt_junction', dir: 'E' },
    { cell: [8, 2], q: 'q_park_sidewalk' },
    { cell: [13, 10], q: 'sch_trust', dir: 'W' },
    { cell: [15, 2], q: 'sch_trust', dir: 'E' },
    { cell: [2, 20], q: 'taxi_belts' },
    { cell: [29, 24], q: 'taxi_kids' },
    { cell: [17, 29], q: 'q_lights' },
    ...XING.triggers,
  ],
  signs: [
    { cell: [5, 14], travel: 'E', type: 'D-1' },
    { cell: [7, 14], travel: 'W', type: 'D-1' },
    { cell: [6, 13], travel: 'S', type: 'A-7' },
    { cell: [6, 15], travel: 'N', type: 'A-7' },
    { cell: [13, 14], travel: 'E', type: 'D-1' },
    { cell: [15, 14], travel: 'W', type: 'D-1' },
    { cell: [14, 13], travel: 'S', type: 'B-20' },
    { cell: [14, 15], travel: 'N', type: 'B-20' },
    { cell: [10, 5], travel: 'S', type: 'D-1' },
    { cell: [10, 7], travel: 'N', type: 'D-1' },
    { cell: [9, 6], travel: 'E', type: 'B-20' },
    { cell: [11, 6], travel: 'W', type: 'B-20' },
    { cell: [18, 22], travel: 'E', type: 'A-7' },
    { cell: [25, 8], travel: 'W', type: 'B-20' },
    { cell: [28, 20], travel: 'E', type: 'A-7' },
    // рондо
    { cell: [10, 21], travel: 'S', type: 'C-12', below: 'A-7' },
    { cell: [9, 22], travel: 'E', type: 'C-12', below: 'A-7' },
    { cell: [11, 22], travel: 'W', type: 'C-12', below: 'A-7' },
    { cell: [10, 23], travel: 'N', type: 'C-12', below: 'A-7' },
    { cell: [24, 13], travel: 'S', type: 'C-12', below: 'A-7' },
    { cell: [23, 14], travel: 'E', type: 'C-12', below: 'A-7' },
    { cell: [25, 14], travel: 'W', type: 'C-12', below: 'A-7' },
    { cell: [24, 15], travel: 'N', type: 'C-12', below: 'A-7' },
    // зони
    ...gates([[[6, 22], [6, 23]], [[6, 29], [6, 28]], [[2, 26], [3, 26]], [[10, 26], [9, 26]]], 'B-43', 'B-44', true),
    ...gates([[[27, 20], [27, 21]], [[27, 29], [27, 28]]], 'D-40', 'D-41', true),
    // заборони, зупинки, діти
    { cell: [12, 18], travel: 'E', type: 'B-36' },
    { cell: [16, 10], travel: 'W', type: 'B-35' },
    { cell: [24, 23], travel: 'N', type: 'B-23' },
    { cell: [19, 8], travel: 'S', type: 'B-25' },
    { cell: [2, 8], travel: 'N', type: 'A-17' },
    { cell: [8, 14], travel: 'E', type: 'D-15' },
    { cell: [28, 14], travel: 'W', type: 'D-15' },
    ...XING.signs,
  ],
  bays: [
    { cell: [12, 22], travel: 'E', along: -4, disabled: true },
    { cell: [12, 22], travel: 'E', along: 4 },
    { cell: [13, 22], travel: 'E', along: -4 },
  ],
  crosswalks: XING.crosswalks,
  actors: [
    ...XING.actors,
    // припарковані машини
    { cell: [8, 2], kind: 'car', face: 'E', color: 0x9b6be6, lateral: BAY_LAT },
    { cell: [12, 6], kind: 'car', face: 'W', color: 0xf2f2f2, lateral: BAY_LAT },
    { cell: [8, 18], kind: 'car', face: 'E', color: 0xe66a4f, lateral: BAY_LAT },
    { cell: [16, 22], kind: 'car', face: 'W', color: 0x4f8fe6, lateral: BAY_LAT },
    { cell: [26, 8], kind: 'car', face: 'E', color: 0x3ccf7a, lateral: BAY_LAT },
    { cell: [25, 2], kind: 'car', face: 'W', color: 0x5a6270, lateral: BAY_LAT },
    { cell: [29, 11], kind: 'car', face: 'N', color: 0xf5a623, lateral: BAY_LAT },
    { cell: [12, 29], kind: 'car', face: 'W', color: 0xe84f9b, lateral: BAY_LAT },
    { cell: [4, 22], kind: 'car', face: 'E', color: 0xf2f2f2, lateral: BAY_LAT },
    { cell: [6, 25], kind: 'police', face: 'S', lateral: BAY_LAT },
  ],
};
