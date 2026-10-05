import type { Level } from '../../types';
import { path } from './util';

// Два рондо: одне з A-7 (пропускаєш тих, хто на колі), друге лише з C-12 (правило правої руки).
export const RONDO: Level = {
  id: 'rondo',
  name: 'Рондо',
  icon: '🔄',
  description: 'Кільцеві розвилки: знак A-8, хто має перевагу на рондо з A-7, головна дорога D-1.',
  task: 'route',
  seed: 2024,
  traffic: 8,
  cols: 12,
  rows: 16,
  map: [
    '........#...', // 0
    '........#...', // 1
    '........#...', // 2
    '############', // 3
    '...#....#...', // 4
    '...#....#...', // 5
    '...#....#...', // 6
    '...#....#...', // 7
    '############', // 8
    '...#....#...', // 9
    '...#....#...', // 10
    '...#....#...', // 11
    '...#....#...', // 12
    '...#....#...', // 13
    '...#....#...', // 14
    '...#....#...', // 15
  ],
  roundabouts: [[3, 8], [8, 3]],
  start: { cell: [3, 15], dir: 'N' },
  route: path([3, 15], [3, 8], [8, 8], [8, 3], [1, 3]),
  triggers: [
    { cell: [3, 13], q: 'q_crosswalk' },
    { cell: [3, 10], q: 'q_rondo_warn' },
    { cell: [3, 9], q: 'q_rondo_priority' },
    { cell: [6, 8], q: 'q_priority_road' },
    { cell: [7, 8], q: 'q_left_oncoming' },
    { cell: [5, 3], q: 'q_lights' },
  ],
  signs: [
    { cell: [3, 12], travel: 'N', type: 'D-6' },
    // A-8 попереджає про рондо
    { cell: [3, 10], travel: 'N', type: 'A-8' },
    { cell: [8, 5], travel: 'N', type: 'A-8' },
    { cell: [3, 9], travel: 'N', type: 'C-12', below: 'A-7' },
    { cell: [6, 8], travel: 'E', type: 'D-1' },
    { cell: [8, 9], travel: 'N', type: 'A-7' },
    { cell: [8, 7], travel: 'S', type: 'A-7' },
    { cell: [8, 4], travel: 'N', type: 'C-12' },
    { cell: [7, 3], travel: 'E', type: 'C-12' },
    { cell: [9, 3], travel: 'W', type: 'C-12' },
    { cell: [2, 8], travel: 'E', type: 'C-12', below: 'A-7' },
    { cell: [4, 8], travel: 'W', type: 'C-12', below: 'A-7' },
    { cell: [3, 7], travel: 'S', type: 'C-12', below: 'A-7' },
    { cell: [8, 2], travel: 'S', type: 'C-12' },
  ],
  crosswalks: [
    { cell: [3, 12], axis: 'v' },
    { cell: [6, 8], axis: 'h' },
    { cell: [8, 10], axis: 'v' },
    { cell: [6, 3], axis: 'h' },
    { cell: [3, 5], axis: 'v' },
    { cell: [10, 8], axis: 'h' },
  ],
  actors: [
    // зустрічне авто на перехресті (8,8), коли ти повертаєш ліворуч
    { cell: [9, 8], kind: 'car', face: 'W', color: 0xe66a4f, go: 'q_left_oncoming', travel: 50 },
    { cell: [3, 12], kind: 'pedestrian', face: 'W', go: 'q_crosswalk', adapt: ['wheelchair', 'cane'] },
    // на другорядній (A-7) праворуч від головної чекає авто, поки ти проїдеш перехрестя
    { cell: [8, 9], kind: 'car', face: 'N', color: 0xf5a623, go: 'q_lights', travel: 45 },
    { cell: [6, 3], kind: 'pedestrian', face: 'N' },
    { cell: [8, 10], kind: 'pedestrian', face: 'W' },
  ],
};
