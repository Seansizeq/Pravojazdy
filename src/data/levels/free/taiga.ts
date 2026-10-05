import type { Level } from '../../../types';
import { BAY_LAT } from '../../../world/build';
import { crossings, gates } from './common';

// Тайга 36×36: звивисті лісові дороги (90 км/год) між ялинами й двома озерами, туман над великим озером,
// лісове селище з рівнозначним перехрестям, лосі на дорозі й зламане авто на узбіччі.
const XING = crossings([
  { cell: [16, 16], face: 'N' },
  { cell: [17, 17], face: 'E' },
]);

export const FREE_TAIGA: Level = {
  id: 'free-taiga',
  name: 'Тайга',
  icon: '🌲',
  description: 'Лісові серпантини серед ялин і озер: дикі тварини, туман над водою, лісове селище й аварія на узбіччі.',
  task: 'free',
  theme: 'taiga',
  seed: 6161,
  traffic: 22,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  cols: 36,
  rows: 36,
  map: [
    '....................................', // 0
    '....................................', // 1
    '....................................', // 2
    '....................############....', // 3
    '....###########.....#..........#....', // 4
    '....#.........#.....#..........#....', // 5
    '....#.........#.....#..........#....', // 6
    '....#.........#######..........#....', // 7
    '....#............#.............#....', // 8
    '....#............#.............#....', // 9
    '....#............#.............#....', // 10
    '....#............#.............#....', // 11
    '....####.........#..........####....', // 12
    '.......#.........#..........#.......', // 13
    '.......#.........#..........#.......', // 14
    '.......#.........#..........#.......', // 15
    '.......######################.......', // 16
    '.......#.........#..........#.......', // 17
    '.......#.........#..........####....', // 18
    '.......#.........#.............#....', // 19
    '....####.........#.............#....', // 20
    '....#............#.............#....', // 21
    '....#............#.............#....', // 22
    '....#............#.............#....', // 23
    '....#............#.............#....', // 24
    '....#............#.............#....', // 25
    '....#............#.............#....', // 26
    '....#............#.............#....', // 27
    '....#.......#########..........#....', // 28
    '....#.......#.......#..........#....', // 29
    '....#.......#.......#..........#....', // 30
    '....#.......#.......############....', // 31
    '....#########.......................', // 32
    '....................................', // 33
    '....................................', // 34
    '....................................', // 35
  ],
  start: { cell: [17, 24], dir: 'N' },
  zones: [{ from: [14, 13], to: [20, 19], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' }],
  weatherZones: [{ from: [21, 19], to: [33, 30], weather: 'fog' }],
  water: [
    { from: [9, 7], to: [12, 10] },
    { from: [22, 20], to: [26, 26] },
  ],
  landmarks: [
    { cell: [18, 14], kind: 'church', face: 'W' },
    { cell: [8, 17], kind: 'fuel', face: 'N' },
  ],
  triggers: [
    // селище
    { cell: [17, 12], q: 'q_speed50', dir: 'S' },
    { cell: [13, 16], q: 'q_speed50', dir: 'E' },
    { cell: [21, 16], q: 'q_speed50', dir: 'W' },
    { cell: [17, 20], q: 'q_speed50', dir: 'N' },
    { cell: [17, 12], q: 'cty_exit_town', dir: 'N' },
    { cell: [13, 16], q: 'cty_exit_town', dir: 'W' },
    { cell: [21, 16], q: 'cty_exit_town', dir: 'E' },
    { cell: [17, 20], q: 'cty_exit_town', dir: 'S' },
    { cell: [17, 11], q: 'cty_speed90', dir: 'N' },
    { cell: [12, 16], q: 'cty_speed90', dir: 'W' },
    { cell: [17, 14], q: 'cty_a5', dir: 'S' },
    { cell: [15, 16], q: 'cty_a5', dir: 'E' },
    { cell: [19, 16], q: 'cty_a5', dir: 'W' },
    { cell: [17, 18], q: 'cty_a5', dir: 'N' },
    ...XING.triggers,
    // примикання поперечних доріг до кільця
    { cell: [17, 8], q: 'q_stop', dir: 'N' },
    { cell: [17, 27], q: 'q_stop', dir: 'S' },
    { cell: [8, 16], q: 'q_yield_a7', dir: 'W' },
    { cell: [27, 16], q: 'q_yield_a7', dir: 'E' },
    // повороти (за годинниковою стрілкою)
    { cell: [12, 4], q: 'cty_curve_r', dir: 'E' },
    { cell: [14, 5], q: 'cty_curve_l', dir: 'S' },
    { cell: [18, 7], q: 'cty_curves', dir: 'E' },
    { cell: [29, 3], q: 'cty_curve_r', dir: 'E' },
    { cell: [31, 10], q: 'cty_curve_r', dir: 'S' },
    { cell: [28, 17], q: 'cty_curves', dir: 'S' },
    { cell: [31, 29], q: 'cty_curve_r', dir: 'S' },
    { cell: [22, 31], q: 'cty_curve_r', dir: 'W' },
    { cell: [15, 28], q: 'cty_curves', dir: 'W' },
    { cell: [6, 32], q: 'cty_curve_r', dir: 'W' },
    { cell: [4, 22], q: 'cty_curve_r', dir: 'N' },
    { cell: [7, 15], q: 'cty_curves', dir: 'N' },
    { cell: [4, 6], q: 'cty_curve_r', dir: 'N' },
    // повороти (проти годинникової стрілки)
    { cell: [4, 9], q: 'cty_curves', dir: 'S' },
    { cell: [7, 18], q: 'cty_curve_r', dir: 'S' },
    { cell: [4, 30], q: 'cty_curve_l', dir: 'S' },
    { cell: [9, 32], q: 'cty_curves', dir: 'E' },
    { cell: [18, 28], q: 'cty_curve_r', dir: 'E' },
    { cell: [29, 31], q: 'cty_curve_l', dir: 'E' },
    { cell: [31, 21], q: 'cty_curves', dir: 'N' },
    { cell: [28, 14], q: 'cty_curve_r', dir: 'N' },
    { cell: [31, 5], q: 'cty_curve_l', dir: 'N' },
    { cell: [23, 3], q: 'cty_curves', dir: 'W' },
    { cell: [16, 7], q: 'cty_curve_r', dir: 'W' },
    { cell: [6, 4], q: 'cty_curve_l', dir: 'W' },
    // лісові небезпеки
    { cell: [31, 7], q: 'cty_animals', dir: 'S' },
    { cell: [4, 26], q: 'cty_animals', dir: 'N' },
    { cell: [20, 5], q: 'cty_gravel', dir: 'N' },
    { cell: [31, 24], q: 'cty_hill', dir: 'S' },
    { cell: [31, 28], q: 'cty_hill', dir: 'N' },
    { cell: [24, 31], q: 'q_no_overtaking', dir: 'E' },
    // туман над озером
    { cell: [31, 22], q: 'fog_drive' },
    { cell: [31, 26], q: 'fog_lights' },
    // зламане авто з трикутником на узбіччі
    { cell: [23, 3], q: 'acc_triangle', dir: 'E' },
    { cell: [26, 3], q: 'acc_witness', dir: 'E' },
    { cell: [27, 3], q: 'acc_firstaid', dir: 'E' },
    { cell: [30, 3], q: 'acc_112', dir: 'W' },
    // загальні
    { cell: [25, 31], q: 'q_lights' },
    { cell: [8, 4], q: 'dash_lamps' },
    { cell: [4, 28], q: 'taxi_phone' },
    { cell: [24, 16], q: 'hw_towing' },
    { cell: [10, 16], q: 'dt_left_edge' },
  ],
  signs: [
    ...gates([[[17, 12], [17, 13]], [[13, 16], [14, 16]], [[21, 16], [20, 16]], [[17, 20], [17, 19]]]),
    // рівнозначне перехрестя в центрі селища
    { cell: [17, 14], travel: 'S', type: 'A-5' },
    { cell: [15, 16], travel: 'E', type: 'A-5' },
    { cell: [19, 16], travel: 'W', type: 'A-5' },
    { cell: [17, 18], travel: 'N', type: 'A-5' },
    ...XING.signs,
    { cell: [17, 8], travel: 'N', type: 'B-20' },
    { cell: [17, 27], travel: 'S', type: 'B-20' },
    { cell: [8, 16], travel: 'W', type: 'A-7' },
    { cell: [27, 16], travel: 'E', type: 'A-7' },
    // повороти
    { cell: [12, 4], travel: 'E', type: 'A-1' },
    { cell: [14, 5], travel: 'S', type: 'A-2' },
    { cell: [18, 7], travel: 'E', type: 'A-4' },
    { cell: [29, 3], travel: 'E', type: 'A-1' },
    { cell: [31, 10], travel: 'S', type: 'A-1' },
    { cell: [28, 17], travel: 'S', type: 'A-4' },
    { cell: [31, 29], travel: 'S', type: 'A-1' },
    { cell: [22, 31], travel: 'W', type: 'A-1' },
    { cell: [15, 28], travel: 'W', type: 'A-4' },
    { cell: [6, 32], travel: 'W', type: 'A-1' },
    { cell: [4, 22], travel: 'N', type: 'A-1' },
    { cell: [7, 15], travel: 'N', type: 'A-4' },
    { cell: [4, 6], travel: 'N', type: 'A-1' },
    { cell: [4, 9], travel: 'S', type: 'A-4' },
    { cell: [7, 18], travel: 'S', type: 'A-1' },
    { cell: [4, 30], travel: 'S', type: 'A-2' },
    { cell: [9, 32], travel: 'E', type: 'A-4' },
    { cell: [18, 28], travel: 'E', type: 'A-1' },
    { cell: [29, 31], travel: 'E', type: 'A-2' },
    { cell: [31, 21], travel: 'N', type: 'A-4' },
    { cell: [28, 14], travel: 'N', type: 'A-1' },
    { cell: [31, 5], travel: 'N', type: 'A-2' },
    { cell: [23, 3], travel: 'W', type: 'A-4' },
    { cell: [16, 7], travel: 'W', type: 'A-1' },
    { cell: [6, 4], travel: 'W', type: 'A-2' },
    // ліс
    { cell: [31, 7], travel: 'S', type: 'A-18b', plate: '3 km' },
    { cell: [4, 26], travel: 'N', type: 'A-18b', plate: '3 km' },
    { cell: [20, 5], travel: 'N', type: 'A-28' },
    { cell: [31, 24], travel: 'S', type: 'A-22' },
    { cell: [31, 28], travel: 'N', type: 'A-23', plate: '10%' },
    { cell: [24, 31], travel: 'E', type: 'B-25' },
  ],
  crosswalks: XING.crosswalks,
  props: [
    // трикутник аварійної зупинки ≈ 80 м за зламаним авто
    { cell: [24, 3], kind: 'triangle', face: 'E', lateral: 5.2 },
  ],
  actors: [
    ...XING.actors,
    // зламане авто на узбіччі з аварійкою
    { cell: [28, 3], kind: 'car', face: 'E', color: 0xf2f2f2, lateral: BAY_LAT + 0.6, blink: 'hazard' },
    // припарковані в селищі
    { cell: [17, 15], kind: 'car', face: 'N', color: 0x5a6270, lateral: BAY_LAT },
    { cell: [19, 16], kind: 'car', face: 'E', color: 0xe66a4f, lateral: BAY_LAT, along: 5 },
  ],
};
