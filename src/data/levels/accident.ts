import type { Level } from '../../types';
import { BAY_LAT } from '../../world/build';
import { path } from './util';

// Аварія на заміській дорозі: розбиті авто з аварійкою, трикутник за 40 м, поліція.
// Далі в селі — зламане авто з аварійкою. Питання про обов'язки учасника ДТП і першу допомогу.
export const ACCIDENT: Level = {
  id: 'accident',
  name: 'Аварія на трасі',
  icon: '🚑',
  description: 'ДТП попереду: трикутник, аварійка, обов’язки учасника й свідка, перша допомога, номер 112.',
  task: 'route',
  seed: 9119,
  traffic: 2,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  quiz: { gap: 100, chance: 0.9 },
  cols: 12,
  rows: 18,
  map: [
    '.......#....', // 0
    '.......#....', // 1
    '.......#....', // 2
    '.......#....', // 3
    '..######....', // 4
    '..#.........', // 5
    '..#.........', // 6
    '..#.........', // 7
    '..#.........', // 8
    '..########..', // 9
    '.........#..', // 10
    '.........#..', // 11
    '.........#..', // 12
    '.........#..', // 13
    '.........#..', // 14
    '.........#..', // 15
    '.........#..', // 16
    '.........#..', // 17
  ],
  start: { cell: [9, 17], dir: 'N' },
  route: path([9, 17], [9, 9], [2, 9], [2, 4], [7, 4], [7, 0]),
  zones: [{ from: [0, 5], to: [6, 8], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' }],
  triggers: [
    { cell: [9, 15], q: 'acc_triangle' },
    { cell: [9, 13], q: 'acc_witness' },
    { cell: [9, 10], q: 'acc_firstaid' },
    { cell: [6, 9], q: 'acc_112' },
    { cell: [3, 9], q: 'acc_firstaid' },
    { cell: [2, 8], q: 'acc_duties' },
    { cell: [3, 4], q: 'acc_112' },
    { cell: [6, 4], q: 'acc_firstaid' },
  ],
  signs: [
    { cell: [2, 8], travel: 'N', type: 'D-42', along: -6 },
    { cell: [2, 5], travel: 'N', type: 'D-43', along: 6 },
    { cell: [2, 5], travel: 'S', type: 'D-42', along: -6 },
    { cell: [2, 8], travel: 'S', type: 'D-43', along: 6 },
  ],
  crosswalks: [],
  props: [
    // поза населеним пунктом трикутник — за 30–50 м до авто (art. 50)
    { cell: [9, 14], kind: 'triangle', face: 'N', lateral: 3.3 },
  ],
  actors: [
    // розбиті авто з аварійкою
    { cell: [9, 12], kind: 'car', face: 'N', color: 0xe66a4f, lateral: 3.8, along: -2, yaw: 28, blink: 'hazard' },
    { cell: [9, 12], kind: 'car', face: 'S', color: 0x3ccf7a, lateral: 5.6, along: -3, yaw: -35, blink: 'hazard' },
    // поліція на узбіччі
    { cell: [9, 11], kind: 'police', face: 'S', lateral: BAY_LAT + 0.4 },
    // у селі — зламане авто з аварійкою біля бордюру
    { cell: [2, 6], kind: 'car', face: 'N', color: 0xf5a623, lateral: BAY_LAT, blink: 'hazard' },
  ],
};
