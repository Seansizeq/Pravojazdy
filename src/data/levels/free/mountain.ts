import type { Level } from '../../../types';
import { BAY_LAT } from '../../../world/build';
import { crossings, gates } from './common';

// Гори взимку 34×34: гірськолижне селище (50 км/год) серед засніжених вершин, серпантин зі шпильковими
// поворотами, перевал, замерзле озеро; ожеледиця (A-32), круті спуски й підйоми, дикі тварини.
const XING = crossings([
  { cell: [14, 12], face: 'N' },
  { cell: [18, 16], face: 'S' },
  { cell: [16, 10], face: 'E' },
]);
// «зебри» без пішоходів — для питань про перехід узимку
const EMPTY_XING = [
  { cell: [12, 14] as [number, number], axis: 'v' as const },
  { cell: [24, 14] as [number, number], axis: 'h' as const },
];

export const FREE_MOUNTAIN: Level = {
  id: 'free-mountain',
  name: 'Гори взимку',
  icon: '🏔️',
  description: 'Засніжені вершини, серпантин зі шпильковими поворотами, гірськолижне селище й ожеледиця на перевалі.',
  task: 'free',
  theme: 'mountain',
  weather: 'snow',
  seed: 7373,
  traffic: 20,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  cols: 34,
  rows: 34,
  map: [
    '..................................', // 0
    '..................................', // 1
    '..................................', // 2
    '................###############...', // 3
    '................#.............#...', // 4
    '................#.............#...', // 5
    '....#############.............#...', // 6
    '....#...........#.............#...', // 7
    '....#...........#.............#...', // 8
    '....#...........#.............#...', // 9
    '....#...........#.............#...', // 10
    '....#...........#.............#...', // 11
    '....#.......#########.........#...', // 12
    '....#.......#...#...#.........#...', // 13
    '....#.......#...#...###########...', // 14
    '....#.......#...#...#.........#...', // 15
    '....#.......#########.........#...', // 16
    '....#...........#.............#...', // 17
    '....#...#########.............#...', // 18
    '....#...#.....................#...', // 19
    '....#...#.....................#...', // 20
    '....#...#.....................#...', // 21
    '....#...#################.....#...', // 22
    '....#...................#.....#...', // 23
    '....#...................#.....#...', // 24
    '....#...................#.....#...', // 25
    '....#####################.....#...', // 26
    '....#.........................#...', // 27
    '....#.........................#...', // 28
    '....#.........................#...', // 29
    '....###########################...', // 30
    '..................................', // 31
    '..................................', // 32
    '..................................', // 33
  ],
  start: { cell: [26, 14], dir: 'W' },
  zones: [{ from: [11, 9], to: [21, 17], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' }],
  water: [{ from: [6, 9], to: [9, 13], frozen: true }],
  landmarks: [{ cell: [14, 14], kind: 'church', face: 'N' }],
  triggers: [
    // селище
    { cell: [16, 8], q: 'q_speed50', dir: 'S' },
    { cell: [22, 14], q: 'q_speed50', dir: 'W' },
    { cell: [16, 17], q: 'q_speed50', dir: 'N' },
    { cell: [16, 8], q: 'cty_exit_town', dir: 'N' },
    { cell: [22, 14], q: 'cty_exit_town', dir: 'E' },
    { cell: [16, 18], q: 'cty_exit_town', dir: 'S' },
    { cell: [16, 7], q: 'cty_speed90', dir: 'N' },
    { cell: [16, 11], q: 'q_priority_road', dir: 'S' },
    { cell: [16, 17], q: 'q_priority_road', dir: 'N' },
    { cell: [15, 12], q: 'q_yield_a7', dir: 'E' },
    { cell: [17, 12], q: 'q_yield_a7', dir: 'W' },
    { cell: [15, 16], q: 'q_yield_a7', dir: 'E' },
    { cell: [17, 16], q: 'q_yield_a7', dir: 'W' },
    { cell: [21, 14], q: 'q_yield_a7', dir: 'W' },
    { cell: [12, 14], q: 'win_crosswalk' },
    { cell: [24, 14], q: 'win_crosswalk' },
    ...XING.triggers,
    // серпантин і перевал
    { cell: [10, 18], q: 'cty_curves', dir: 'W' },
    { cell: [22, 22], q: 'cty_curve_r', dir: 'E' },
    { cell: [24, 24], q: 'cty_curve_r', dir: 'S' },
    { cell: [22, 26], q: 'cty_curves', dir: 'E' },
    { cell: [10, 22], q: 'cty_curve_r', dir: 'W' },
    { cell: [8, 20], q: 'cty_curve_r', dir: 'N' },
    { cell: [14, 18], q: 'cty_curve_l', dir: 'E' },
    { cell: [4, 28], q: 'cty_curve_l', dir: 'S' },
    { cell: [28, 30], q: 'cty_curve_l', dir: 'E' },
    { cell: [30, 5], q: 'cty_curve_l', dir: 'N' },
    { cell: [18, 3], q: 'cty_curve_l', dir: 'W' },
    { cell: [16, 5], q: 'cty_curve_r', dir: 'N' },
    { cell: [28, 3], q: 'cty_curve_r', dir: 'E' },
    { cell: [30, 28], q: 'cty_curve_r', dir: 'S' },
    { cell: [6, 30], q: 'cty_curve_r', dir: 'W' },
    { cell: [4, 8], q: 'cty_curve_r', dir: 'N' },
    { cell: [6, 6], q: 'cty_curve_l', dir: 'W' },
    { cell: [30, 8], q: 'cty_hill', dir: 'S' },
    { cell: [30, 25], q: 'cty_hill', dir: 'N' },
    { cell: [4, 12], q: 'cty_animals', dir: 'N' },
    // зимова дорога
    { cell: [4, 16], q: 'win_frost', dir: 'S' },
    { cell: [19, 22], q: 'win_frost', dir: 'E' },
    { cell: [30, 20], q: 'win_frost', dir: 'N' },
    { cell: [14, 26], q: 'win_slippery' },
    { cell: [30, 17], q: 'win_slippery' },
    { cell: [22, 3], q: 'win_slippery' },
    { cell: [4, 21], q: 'win_lights' },
    { cell: [18, 30], q: 'win_lights' },
    { cell: [11, 30], q: 'win_abs' },
    { cell: [10, 6], q: 'q_lights' },
    { cell: [26, 14], q: 'dash_lamps' },
  ],
  signs: [
    ...gates([[[16, 8], [16, 9]], [[22, 14], [21, 14]]]),
    // з півдня в селище в'їжджаємо одразу за поворотом — знаки в клітинці селища
    ...gates([[[16, 18], [16, 17]]], 'D-42', 'D-43', true),
    // головна вулиця селища (D-1), бічні в'їзди поступаються
    { cell: [16, 11], travel: 'S', type: 'D-1' },
    { cell: [16, 17], travel: 'N', type: 'D-1' },
    { cell: [15, 12], travel: 'E', type: 'A-7' },
    { cell: [17, 12], travel: 'W', type: 'A-7' },
    { cell: [15, 16], travel: 'E', type: 'A-7' },
    { cell: [17, 16], travel: 'W', type: 'A-7' },
    { cell: [21, 14], travel: 'W', type: 'A-7' },
    ...XING.signs,
    { cell: [12, 14], travel: 'N', type: 'D-6' },
    { cell: [12, 14], travel: 'S', type: 'D-6' },
    { cell: [24, 14], travel: 'E', type: 'D-6' },
    { cell: [24, 14], travel: 'W', type: 'D-6' },
    // серпантин: шпилькові повороти
    { cell: [10, 18], travel: 'W', type: 'A-4' },
    { cell: [22, 22], travel: 'E', type: 'A-1' },
    { cell: [24, 24], travel: 'S', type: 'A-1' },
    { cell: [22, 26], travel: 'E', type: 'A-4' },
    { cell: [10, 22], travel: 'W', type: 'A-1' },
    { cell: [8, 20], travel: 'N', type: 'A-1' },
    { cell: [14, 18], travel: 'E', type: 'A-2' },
    // кільце навколо гір
    { cell: [4, 28], travel: 'S', type: 'A-2' },
    { cell: [28, 30], travel: 'E', type: 'A-2' },
    { cell: [30, 5], travel: 'N', type: 'A-2' },
    { cell: [18, 3], travel: 'W', type: 'A-2' },
    { cell: [16, 5], travel: 'N', type: 'A-1' },
    { cell: [28, 3], travel: 'E', type: 'A-1' },
    { cell: [30, 28], travel: 'S', type: 'A-1' },
    { cell: [6, 30], travel: 'W', type: 'A-1' },
    { cell: [4, 8], travel: 'N', type: 'A-1' },
    { cell: [6, 6], travel: 'W', type: 'A-2' },
    // спуски, підйоми, ожеледиця, тварини
    { cell: [30, 8], travel: 'S', type: 'A-22' },
    { cell: [30, 25], travel: 'N', type: 'A-23', plate: '10%' },
    { cell: [4, 12], travel: 'N', type: 'A-18b', plate: '3 km' },
    { cell: [4, 16], travel: 'S', type: 'A-32' },
    { cell: [19, 22], travel: 'E', type: 'A-32' },
    { cell: [30, 20], travel: 'N', type: 'A-32' },
  ],
  crosswalks: [...XING.crosswalks, ...EMPTY_XING],
  actors: [
    ...XING.actors,
    { cell: [13, 12], kind: 'car', face: 'W', color: 0xd8262c, lateral: BAY_LAT },
    { cell: [19, 16], kind: 'car', face: 'E', color: 0x4f8fe6, lateral: BAY_LAT },
    { cell: [20, 13], kind: 'car', face: 'S', color: 0xf2f2f2, lateral: BAY_LAT },
  ],
};
