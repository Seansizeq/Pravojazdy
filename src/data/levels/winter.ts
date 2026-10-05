import type { Level } from '../../types';
import { path } from './util';

// Зимова дорога: сніг, ожеледиця (A-32), зледеніле перехрестя, гальмування з ABS, обгін на снігу,
// світло й протитуманні фари в снігопад.
export const WINTER: Level = {
  id: 'winter',
  name: 'Зимова дорога',
  icon: '❄️',
  description: 'Сніг і ожеледиця: знак A-32, слизька дорога, гальмування з ABS, обгін на снігу.',
  task: 'route',
  seed: 1212,
  traffic: 3,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  weather: 'snow',
  quiz: { gap: 100, chance: 0.85 },
  cols: 12,
  rows: 20,
  map: [
    '..#.........', // 0
    '..#.........', // 1
    '..#####.....', // 2
    '......#.....', // 3
    '......#.....', // 4
    '......#.....', // 5
    '......#####.', // 6
    '..........#.', // 7
    '..........#.', // 8
    '..........#.', // 9
    '..........#.', // 10
    '...########.', // 11
    '...#..#.....', // 12
    '...#..#.....', // 13
    '...#..#.....', // 14
    '...#..#.....', // 15
    '...#..#.....', // 16
    '...#..#.....', // 17
    '...#..#.....', // 18
    '...#..#.....', // 19
  ],
  start: { cell: [3, 19], dir: 'N' },
  route: path([3, 19], [3, 11], [10, 11], [10, 6], [6, 6], [6, 2], [2, 2], [2, 0]),
  zones: [{ from: [0, 14], to: [11, 19], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' }],
  triggers: [
    { cell: [3, 17], q: 'win_crosswalk' },
    { cell: [3, 14], q: 'cty_exit_town' },
    { cell: [3, 12], q: 'win_lights' },
    { cell: [5, 11], q: 'win_slippery' },
    { cell: [8, 11], q: 'win_overtake' },
    { cell: [10, 9], q: 'win_frost' },
    { cell: [10, 7], q: 'win_abs' },
    { cell: [8, 6], q: 'fog_lights' },
    { cell: [6, 4], q: 'cty_curve_l' },
    { cell: [4, 2], q: 'q_lights' },
  ],
  signs: [
    { cell: [3, 18], travel: 'N', type: 'D-42' },
    { cell: [3, 16], travel: 'N', type: 'D-6' },
    { cell: [3, 15], travel: 'N', type: 'E-17a', along: 4 },
    { cell: [3, 14], travel: 'N', type: 'D-43', along: 6 },
    { cell: [3, 13], travel: 'S', type: 'D-42', along: 6 },
    // паралельна вулиця з села виходить на дорогу — зледеніле Т-перехрестя
    { cell: [6, 14], travel: 'N', type: 'D-43', along: 6 },
    { cell: [6, 13], travel: 'S', type: 'D-42', along: 6 },
    { cell: [6, 12], travel: 'N', type: 'A-7' },
    { cell: [10, 9], travel: 'N', type: 'A-32' },
    { cell: [6, 4], travel: 'N', type: 'A-2' },
  ],
  crosswalks: [{ cell: [3, 16], axis: 'v' }],
  actors: [
    // повільне авто попереду — чи варто обганяти на снігу?
    // (під питання — вантажівка); до повороту на (10,11) і далі зникає з поля зору
    { cell: [9, 11], kind: 'car', face: 'E', color: 0x5a6270, go: 'win_overtake', travel: 16, adapt: ['truck'] },
  ],
};
