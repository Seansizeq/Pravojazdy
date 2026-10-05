import type { Level } from '../../types';
import { BAY_LAT } from '../../world/build';
import { path } from './util';

// Сітка 10×17 клітинок, клітинка = 20 м.
export const OLDTOWN: Level = {
  id: 'oldtown',
  name: 'Старе Місто',
  icon: '🏛️',
  description: 'Перший виїзд: перехрестя, правило правої руки, STOP, автобус на зупинці.',
  task: 'route',
  seed: 1337,
  traffic: 4,
  cols: 10,
  rows: 17,
  map: [
    '....#.....', // 0
    '....#.....', // 1
    '.########.', // 2
    '.#..#...#.', // 3
    '.#..#...#.', // 4
    '.#..#####.', // 5
    '.#..#...#.', // 6
    '.#..#...#.', // 7
    '.#..#...#.', // 8
    '.#..#...#.', // 9
    '.########.', // 10
    '....#.....', // 11
    '....#.....', // 12
    '....#.....', // 13
    '....#.....', // 14
    '....#.....', // 15
    '..........', // 16
  ],
  start: { cell: [4, 15], dir: 'N' },
  route: path([4, 15], [4, 10], [8, 10], [8, 5], [4, 5], [4, 2], [1, 2], [1, 10], [3, 10]),
  triggers: [
    { cell: [4, 14], q: 'q_speed50' },
    { cell: [4, 13], q: 'q_crosswalk' },
    { cell: [4, 11], q: 'q_right_hand' },
    { cell: [5, 10], q: 'q_bus_stop' },
    { cell: [7, 10], q: 'q_no_overtaking' },
    { cell: [8, 9], q: 'q_uturn' },
    { cell: [8, 7], q: 'q_no_stopping' },
    { cell: [8, 6], q: 'q_left_position' },
    { cell: [7, 5], q: 'q_park_sidewalk' },
    { cell: [5, 5], q: 'q_stop' },
    { cell: [4, 3], q: 'q_left_oncoming' },
    { cell: [1, 4], q: 'q_children' },
    { cell: [1, 7], q: 'q_lights' },
  ],
  signs: [
    { cell: [4, 15], travel: 'N', type: 'D-42' },
    { cell: [4, 12], travel: 'N', type: 'D-6' },
    // A-5 перед перехрестям рівнозначних доріг
    { cell: [4, 11], travel: 'N', type: 'A-5' },
    { cell: [7, 10], travel: 'E', type: 'B-25' },
    { cell: [8, 9], travel: 'N', type: 'B-23' },
    { cell: [8, 7], travel: 'N', type: 'B-36' },
    { cell: [5, 5], travel: 'W', type: 'B-20' },
    { cell: [4, 3], travel: 'N', type: 'D-1' },
    { cell: [1, 4], travel: 'S', type: 'A-17' },
    { cell: [6, 10], travel: 'E', type: 'D-15' },
    // col 4 — головна (D-1), тож бічні в'їзди на перехрестя (4,2) поступаються
    { cell: [3, 2], travel: 'E', type: 'A-7' },
    { cell: [5, 2], travel: 'W', type: 'A-7' },
  ],
  crosswalks: [
    { cell: [4, 12], axis: 'v' },
    { cell: [4, 9], axis: 'v' },
    { cell: [2, 10], axis: 'h' },
    { cell: [4, 6], axis: 'v' },
    { cell: [5, 2], axis: 'h' },
    { cell: [1, 5], axis: 'v' },
  ],
  actors: [
    // Сценарні машини: рушають після відповіді
    { cell: [5, 10], kind: 'car', face: 'W', color: 0x4f8fe6, go: 'q_right_hand', travel: 66 },
    { cell: [6, 10], kind: 'bus', face: 'E', go: 'q_bus_stop', travel: 34, blink: 'left' },
    // пішохід, який ступає на «зебру» праворуч від тебе
    { cell: [4, 12], kind: 'pedestrian', face: 'W', go: 'q_crosswalk', adapt: ['wheelchair', 'cane'] },
    // на головній дорозі перед STOP — авто праворуч, яке ти мусиш пропустити
    { cell: [4, 4], kind: 'car', face: 'S', color: 0x3ccf7a, go: 'q_stop', travel: 60 },
    { cell: [4, 0], kind: 'car', face: 'S', color: 0xe66a4f, go: 'q_left_oncoming', travel: 110 },
    // Декорації: машини припарковані біля бордюру
    { cell: [4, 7], kind: 'police', face: 'S', lateral: BAY_LAT },
    { cell: [7, 2], kind: 'car', face: 'E', color: 0x9b6be6, lateral: BAY_LAT },
    { cell: [8, 3], kind: 'car', face: 'S', color: 0xf2f2f2, lateral: BAY_LAT },
    // пішоходи, які просто ходять
    { cell: [1, 5], kind: 'pedestrian', face: 'E' },
    { cell: [4, 9], kind: 'pedestrian', face: 'E' },
  ],
};
