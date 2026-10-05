import type { Level } from '../../../types';
import { BAY_LAT } from '../../../world/build';
import { crossings, gates } from './common';

// Пустеля 32×32: місто-оаза в центрі (50 км/год, рондо, головні проспекти з D-1) і пустельна траса
// навколо (90 км/год) з серпантинами, боковим вітром і гравієм на дорозі.
const XING = crossings([
  { cell: [15, 13], face: 'E' },
  { cell: [13, 15], face: 'N' },
  { cell: [17, 15], face: 'S', variant: 'wheelchair' },
  { cell: [15, 17], face: 'W' },
  { cell: [13, 20], face: 'N' },
  { cell: [20, 17], face: 'E', variant: 'cane' },
  { cell: [10, 13], face: 'E' },
]);

export const FREE_DESERT: Level = {
  id: 'free-desert',
  name: 'Пустеля',
  icon: '🏜️',
  description: 'Місто-оаза серед дюн: рондо, головні проспекти, а навколо — траса 90 з серпантинами й боковим вітром.',
  task: 'free',
  theme: 'desert',
  seed: 4242,
  traffic: 34,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  cols: 32,
  rows: 32,
  map: [
    '................................', // 0
    '................................', // 1
    '................................', // 2
    '...######################.......', // 3
    '...#...........#........#.......', // 4
    '...#...........#........#.......', // 5
    '...#...........#........#####...', // 6
    '...#...........#............#...', // 7
    '...#...........#............#...', // 8
    '...#...........#............#...', // 9
    '...#......###########.......#...', // 10
    '...#......#.#..#....#.......#...', // 11
    '...#......#.#..######.......#...', // 12
    '...#......#.#..#....#.......#...', // 13
    '...#......#.#..#....#.......#...', // 14
    '...##########################...', // 15
    '...#......#....#..#.#.......#...', // 16
    '...#......#....#..#.#.......#...', // 17
    '...#......######..#.#.......#...', // 18
    '...#......#....#..#.#.......#...', // 19
    '...#......###########.......#...', // 20
    '...#...........#............#...', // 21
    '...#...........#............#...', // 22
    '...#...........#............#...', // 23
    '...#...........#............#...', // 24
    '...####........#............#...', // 25
    '......#........#............#...', // 26
    '......#........#............#...', // 27
    '......#######################...', // 28
    '................................', // 29
    '................................', // 30
    '................................', // 31
  ],
  start: { cell: [15, 26], dir: 'N' },
  roundabouts: [[15, 15]],
  zones: [{ from: [9, 9], to: [21, 21], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' }],
  water: [
    { from: [6, 6], to: [8, 8] },
    { from: [22, 23], to: [24, 25] },
  ],
  landmarks: [
    { cell: [16, 4], kind: 'fuel', face: 'W' },
    { cell: [11, 13], kind: 'school', face: 'W' },
    { cell: [16, 16], kind: 'fountain' },
  ],
  triggers: [
    // в'їзди в місто й виїзди з нього
    { cell: [15, 8], q: 'q_speed50', dir: 'S' },
    { cell: [8, 15], q: 'q_speed50', dir: 'E' },
    { cell: [22, 15], q: 'q_speed50', dir: 'W' },
    { cell: [15, 22], q: 'q_speed50', dir: 'N' },
    { cell: [15, 8], q: 'cty_exit_town', dir: 'N' },
    { cell: [8, 15], q: 'cty_exit_town', dir: 'W' },
    { cell: [22, 15], q: 'cty_exit_town', dir: 'E' },
    { cell: [15, 22], q: 'cty_exit_town', dir: 'S' },
    { cell: [15, 7], q: 'cty_speed90', dir: 'N' },
    { cell: [15, 23], q: 'cty_speed90', dir: 'S' },
    // рондо
    { cell: [15, 14], q: 'q_rondo_priority', dir: 'S' },
    { cell: [14, 15], q: 'q_rondo_priority', dir: 'E' },
    { cell: [16, 15], q: 'q_rondo_priority', dir: 'W' },
    { cell: [15, 16], q: 'q_rondo_priority', dir: 'N' },
    // головні проспекти і бічні вулиці
    { cell: [15, 9], q: 'q_priority_road', dir: 'S' },
    { cell: [21, 15], q: 'q_priority_road', dir: 'W' },
    { cell: [15, 21], q: 'q_priority_road', dir: 'N' },
    { cell: [14, 10], q: 'q_yield_a7', dir: 'E' },
    { cell: [16, 20], q: 'q_yield_a7', dir: 'W' },
    { cell: [20, 14], q: 'q_yield_a7', dir: 'S' },
    { cell: [16, 12], q: 'q_yield_a7', dir: 'W' },
    { cell: [11, 18], q: 'q_yield_a7', dir: 'W' },
    { cell: [10, 14], q: 'q_stop', dir: 'S' },
    { cell: [12, 11], q: 'q_stop', dir: 'N' },
    { cell: [18, 19], q: 'q_stop', dir: 'S' },
    { cell: [19, 12], q: 'q_stop', dir: 'E' },
    { cell: [17, 12], q: 'q_no_stopping', dir: 'E' },
    { cell: [11, 20], q: 'q_parking', dir: 'E' },
    { cell: [19, 20], q: 'dt_bus_bay', dir: 'E' },
    { cell: [10, 11], q: 'q_children', dir: 'S' },
    { cell: [18, 10], q: 'dt_engine' },
    ...XING.triggers,
    // пустельна траса
    { cell: [3, 5], q: 'cty_curve_r', dir: 'N' },
    { cell: [5, 3], q: 'cty_curve_l', dir: 'W' },
    { cell: [21, 3], q: 'cty_curves', dir: 'E' },
    { cell: [28, 9], q: 'cty_curves', dir: 'N' },
    { cell: [3, 22], q: 'cty_curves', dir: 'S' },
    { cell: [9, 28], q: 'cty_curves', dir: 'W' },
    { cell: [28, 26], q: 'cty_curve_r', dir: 'S' },
    { cell: [26, 28], q: 'cty_curve_l', dir: 'E' },
    { cell: [28, 20], q: 'cty_wind', dir: 'N' },
    { cell: [3, 10], q: 'cty_wind', dir: 'S' },
    { cell: [20, 28], q: 'cty_gravel', dir: 'W' },
    { cell: [15, 5], q: 'q_no_overtaking', dir: 'S' },
    { cell: [5, 15], q: 'q_no_overtaking', dir: 'E' },
    { cell: [15, 25], q: 'q_uturn', dir: 'N' },
    { cell: [10, 3], q: 'q_lights' },
    { cell: [28, 23], q: 'dash_lamps' },
    { cell: [3, 13], q: 'taxi_phone' },
    { cell: [24, 15], q: 'hw_towing' },
  ],
  signs: [
    ...gates([[[15, 8], [15, 9]], [[8, 15], [9, 15]], [[22, 15], [21, 15]], [[15, 22], [15, 21]]]),
    // рондо
    { cell: [15, 14], travel: 'S', type: 'C-12', below: 'A-7' },
    { cell: [14, 15], travel: 'E', type: 'C-12', below: 'A-7' },
    { cell: [16, 15], travel: 'W', type: 'C-12', below: 'A-7' },
    { cell: [15, 16], travel: 'N', type: 'C-12', below: 'A-7' },
    // проспект N–S — головна на перехрестях з кільцевою вулицею
    { cell: [15, 9], travel: 'S', type: 'D-1' },
    { cell: [15, 11], travel: 'N', type: 'D-1' },
    { cell: [14, 10], travel: 'E', type: 'A-7' },
    { cell: [16, 10], travel: 'W', type: 'A-7' },
    { cell: [15, 21], travel: 'N', type: 'D-1' },
    { cell: [15, 19], travel: 'S', type: 'D-1' },
    { cell: [14, 20], travel: 'E', type: 'A-7' },
    { cell: [16, 20], travel: 'W', type: 'A-7' },
    // проспект W–E — головна; кільцева вулиця на заході зі STOP, на сході — з A-7
    { cell: [9, 15], travel: 'E', type: 'D-1' },
    { cell: [11, 15], travel: 'W', type: 'D-1' },
    { cell: [10, 14], travel: 'S', type: 'B-20' },
    { cell: [10, 16], travel: 'N', type: 'B-20' },
    { cell: [21, 15], travel: 'W', type: 'D-1' },
    { cell: [19, 15], travel: 'E', type: 'D-1' },
    { cell: [20, 14], travel: 'S', type: 'A-7' },
    { cell: [20, 16], travel: 'N', type: 'A-7' },
    // бічні вулиці на Т-перехрестях
    { cell: [12, 11], travel: 'N', type: 'B-20' },
    { cell: [12, 14], travel: 'S', type: 'A-7' },
    { cell: [16, 12], travel: 'W', type: 'A-7' },
    { cell: [19, 12], travel: 'E', type: 'B-20' },
    { cell: [18, 16], travel: 'N', type: 'A-7' },
    { cell: [18, 19], travel: 'S', type: 'B-20' },
    { cell: [14, 18], travel: 'E', type: 'A-7' },
    { cell: [11, 18], travel: 'W', type: 'A-7' },
    // заборони й зупинка
    { cell: [17, 12], travel: 'E', type: 'B-36' },
    { cell: [11, 20], travel: 'E', type: 'B-35' },
    { cell: [19, 20], travel: 'E', type: 'D-15' },
    { cell: [10, 11], travel: 'S', type: 'A-17' },
    ...XING.signs,
    // траса: повороти й серпантини (табличка — кількість поворотів)
    { cell: [3, 5], travel: 'N', type: 'A-1' },
    { cell: [5, 3], travel: 'W', type: 'A-2' },
    { cell: [21, 3], travel: 'E', type: 'A-3', plate: '3' },
    { cell: [28, 9], travel: 'N', type: 'A-4', plate: '3' },
    { cell: [3, 22], travel: 'S', type: 'A-4', plate: '3' },
    { cell: [9, 28], travel: 'W', type: 'A-3', plate: '3' },
    { cell: [28, 26], travel: 'S', type: 'A-1' },
    { cell: [26, 28], travel: 'E', type: 'A-2' },
    { cell: [28, 20], travel: 'N', type: 'A-19' },
    { cell: [3, 10], travel: 'S', type: 'A-19' },
    { cell: [20, 28], travel: 'W', type: 'A-28' },
    { cell: [15, 5], travel: 'S', type: 'B-25' },
    { cell: [5, 15], travel: 'E', type: 'B-25' },
    { cell: [15, 25], travel: 'N', type: 'B-23' },
  ],
  crosswalks: XING.crosswalks,
  actors: [
    ...XING.actors,
    // припарковані машини
    { cell: [13, 10], kind: 'car', face: 'W', color: 0xf2f2f2, lateral: BAY_LAT },
    { cell: [12, 13], kind: 'car', face: 'N', color: 0xe66a4f, lateral: BAY_LAT },
    { cell: [17, 20], kind: 'car', face: 'W', color: 0x4f8fe6, lateral: BAY_LAT },
    { cell: [20, 13], kind: 'car', face: 'S', color: 0xf5a623, lateral: BAY_LAT },
    { cell: [13, 18], kind: 'car', face: 'E', color: 0x3ccf7a, lateral: BAY_LAT },
  ],
};
