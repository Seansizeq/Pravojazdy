import type { Level } from '../../../types';
import { BAY_LAT } from '../../../world/build';
import { crossings, gates } from './common';

// Морське узбережжя 32×32: курортне містечко (50 км/год) з рондо й набережною вздовж пляжу, пірс, маяк,
// а навколо — приморська дорога й соснові дюни (90 км/год) з боковим вітром.
const XING = crossings([
  { cell: [11, 23], face: 'S' },
  { cell: [19, 23], face: 'N', variant: 'wheelchair' },
  { cell: [15, 18], face: 'N' },
  { cell: [13, 15], face: 'E' },
  { cell: [17, 15], face: 'W', variant: 'cane' },
]);

export const FREE_COAST: Level = {
  id: 'free-coast',
  name: 'Морське узбережжя',
  icon: '🏖️',
  description: 'Курорт біля моря: набережна вздовж пляжу, пірс, маяк, рондо, а за містом — соснові дюни й вітер з моря.',
  task: 'free',
  theme: 'coast',
  seed: 8484,
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
    '................................', // 3
    '..############################..', // 4
    '..#..........#...............#..', // 5
    '..#..........#...............#..', // 6
    '..#..........#...............#..', // 7
    '..#..........#...............#..', // 8
    '..#######################....#..', // 9
    '..#..........#..........#....#..', // 10
    '..#..........#..........#....#..', // 11
    '..#..........#..........#....#..', // 12
    '..#......#############..#....#..', // 13
    '..#......#...#...#...#..#....#..', // 14
    '..#......#...#...#...#..#....#..', // 15
    '..#......#...#...#...#..#....#..', // 16
    '..#......#...#...#...#..#....#..', // 17
    '..#......#####################..', // 18
    '..#......#...#...#...#.......#..', // 19
    '..#......#...#...#...#.......#..', // 20
    '..#......#...#...#...#.......#..', // 21
    '..#......#...#...#...#.......#..', // 22
    '..############################..', // 23
    '................................', // 24
    '................................', // 25
    '................................', // 26
    '................................', // 27 ← море
    '................................', // 28
    '................................', // 29
    '................................', // 30
    '................................', // 31
  ],
  start: { cell: [6, 23], dir: 'E' },
  roundabouts: [[21, 18]],
  zones: [{ from: [8, 12], to: [22, 23], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' }],
  water: [{ from: [-14, 27], to: [46, 50] }],
  landmarks: [
    { cell: [30, 26], kind: 'lighthouse' },
    { cell: [15, 26], kind: 'pier', face: 'S' },
    { cell: [3, 22], kind: 'fuel', face: 'S' },
    { cell: [11, 20], kind: 'church', face: 'N' },
    { cell: [10, 15], kind: 'school', face: 'W' },
    { cell: [19, 20], kind: 'fountain' },
  ],
  triggers: [
    // курорт
    { cell: [13, 11], q: 'q_speed50', dir: 'S' },
    { cell: [23, 18], q: 'q_speed50', dir: 'W' },
    { cell: [7, 23], q: 'q_speed50', dir: 'E' },
    { cell: [23, 23], q: 'q_speed50', dir: 'W' },
    { cell: [13, 11], q: 'cty_exit_town', dir: 'N' },
    { cell: [23, 18], q: 'cty_exit_town', dir: 'E' },
    { cell: [7, 23], q: 'cty_exit_town', dir: 'W' },
    { cell: [23, 23], q: 'cty_exit_town', dir: 'E' },
    { cell: [21, 17], q: 'q_rondo_priority', dir: 'S' },
    { cell: [20, 18], q: 'q_rondo_priority', dir: 'E' },
    { cell: [22, 18], q: 'q_rondo_priority', dir: 'W' },
    { cell: [21, 19], q: 'q_rondo_priority', dir: 'N' },
    // набережна — головна дорога, вулиці міста поступаються
    { cell: [8, 23], q: 'q_priority_road', dir: 'E' },
    { cell: [22, 23], q: 'q_priority_road', dir: 'W' },
    { cell: [9, 22], q: 'q_yield_a7', dir: 'S' },
    { cell: [13, 22], q: 'q_yield_a7', dir: 'S' },
    { cell: [17, 22], q: 'q_yield_a7', dir: 'S' },
    { cell: [21, 22], q: 'q_yield_a7', dir: 'S' },
    { cell: [13, 12], q: 'q_priority_road', dir: 'S' },
    { cell: [12, 13], q: 'q_stop', dir: 'E' },
    { cell: [14, 13], q: 'q_stop', dir: 'W' },
    { cell: [9, 14], q: 'q_children', dir: 'S' },
    { cell: [15, 23], q: 'dt_bus_bay', dir: 'W' },
    ...XING.triggers,
    // заміські дороги
    { cell: [13, 5], q: 'q_yield_a7', dir: 'N' },
    { cell: [12, 9], q: 'q_stop', dir: 'E' },
    { cell: [14, 9], q: 'q_stop', dir: 'W' },
    { cell: [3, 9], q: 'q_yield_a7', dir: 'W' },
    { cell: [28, 18], q: 'q_yield_a7', dir: 'E' },
    { cell: [24, 17], q: 'q_yield_a7', dir: 'S' },
    { cell: [2, 6], q: 'cty_curve_r', dir: 'N' },
    { cell: [4, 4], q: 'cty_curve_l', dir: 'W' },
    { cell: [27, 4], q: 'cty_curve_r', dir: 'E' },
    { cell: [29, 6], q: 'cty_curve_l', dir: 'N' },
    { cell: [29, 21], q: 'cty_curve_r', dir: 'S' },
    { cell: [27, 23], q: 'cty_curve_l', dir: 'E' },
    { cell: [4, 23], q: 'cty_curve_r', dir: 'W' },
    { cell: [2, 21], q: 'cty_curve_l', dir: 'S' },
    { cell: [22, 9], q: 'cty_curve_r', dir: 'E' },
    { cell: [24, 11], q: 'cty_curve_l', dir: 'N' },
    { cell: [25, 23], q: 'cty_wind', dir: 'W' },
    { cell: [5, 23], q: 'cty_wind', dir: 'E' },
    { cell: [29, 12], q: 'q_no_overtaking', dir: 'S' },
    { cell: [6, 23], q: 'cty_speed90', dir: 'W' },
    { cell: [20, 4], q: 'q_lights' },
    { cell: [2, 15], q: 'taxi_phone' },
    { cell: [29, 10], q: 'dash_lamps' },
    { cell: [8, 4], q: 'hw_towing' },
    { cell: [18, 9], q: 'dt_left_edge' },
  ],
  signs: [
    ...gates([[[13, 11], [13, 12]], [[23, 18], [22, 18]], [[7, 23], [8, 23]], [[23, 23], [22, 23]]]),
    { cell: [21, 17], travel: 'S', type: 'C-12', below: 'A-7' },
    { cell: [20, 18], travel: 'E', type: 'C-12', below: 'A-7' },
    { cell: [22, 18], travel: 'W', type: 'C-12', below: 'A-7' },
    { cell: [21, 19], travel: 'N', type: 'C-12', below: 'A-7' },
    { cell: [8, 23], travel: 'E', type: 'D-1' },
    { cell: [22, 23], travel: 'W', type: 'D-1' },
    { cell: [9, 22], travel: 'S', type: 'A-7' },
    { cell: [13, 22], travel: 'S', type: 'A-7' },
    { cell: [17, 22], travel: 'S', type: 'A-7' },
    { cell: [21, 22], travel: 'S', type: 'A-7' },
    { cell: [13, 12], travel: 'S', type: 'D-1' },
    { cell: [12, 13], travel: 'E', type: 'B-20' },
    { cell: [14, 13], travel: 'W', type: 'B-20' },
    { cell: [9, 14], travel: 'S', type: 'A-17' },
    { cell: [15, 23], travel: 'W', type: 'D-15' },
    ...XING.signs,
    { cell: [13, 5], travel: 'N', type: 'A-7' },
    { cell: [12, 9], travel: 'E', type: 'B-20' },
    { cell: [14, 9], travel: 'W', type: 'B-20' },
    { cell: [3, 9], travel: 'W', type: 'A-7' },
    { cell: [28, 18], travel: 'E', type: 'A-7' },
    { cell: [24, 17], travel: 'S', type: 'A-7' },
    { cell: [2, 6], travel: 'N', type: 'A-1' },
    { cell: [4, 4], travel: 'W', type: 'A-2' },
    { cell: [27, 4], travel: 'E', type: 'A-1' },
    { cell: [29, 6], travel: 'N', type: 'A-2' },
    { cell: [29, 21], travel: 'S', type: 'A-1' },
    { cell: [27, 23], travel: 'E', type: 'A-2' },
    { cell: [4, 23], travel: 'W', type: 'A-1' },
    { cell: [2, 21], travel: 'S', type: 'A-2' },
    { cell: [22, 9], travel: 'E', type: 'A-1' },
    { cell: [24, 11], travel: 'N', type: 'A-2' },
    { cell: [25, 23], travel: 'W', type: 'A-19' },
    { cell: [5, 23], travel: 'E', type: 'A-19' },
    { cell: [29, 12], travel: 'S', type: 'B-25' },
  ],
  crosswalks: XING.crosswalks,
  actors: [
    ...XING.actors,
    { cell: [10, 13], kind: 'car', face: 'E', color: 0x4f8fe6, lateral: BAY_LAT },
    { cell: [17, 20], kind: 'car', face: 'S', color: 0xf5a623, lateral: BAY_LAT },
    { cell: [16, 13], kind: 'car', face: 'W', color: 0xe84f9b, lateral: BAY_LAT },
    { cell: [21, 14], kind: 'car', face: 'N', color: 0xf2f2f2, lateral: BAY_LAT },
    { cell: [18, 23], kind: 'car', face: 'E', color: 0x3ccf7a, lateral: BAY_LAT },
  ],
};
