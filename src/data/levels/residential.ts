import type { Level } from '../../types';
import { BAY_LAT } from '../../world/build';
import { path } from './util';

// Зона «Tempo 30» внизу, «strefa zamieszkania» (20 км/год) вгорі, паркування в кінці.
export const RESIDENTIAL: Level = {
  id: 'residential',
  name: 'Житловий район',
  icon: '🏘️',
  description: 'Зони Tempo 30 і «strefa zamieszkania», а наприкінці — паралельне паркування між машинами.',
  task: 'park',
  seed: 77,
  traffic: 7,
  cols: 12,
  rows: 14,
  map: [
    '............', // 0
    '.##########.', // 1
    '.#....#...#.', // 2
    '.#....#...#.', // 3
    '.#....#...#.', // 4
    '.###########', // 5
    '......#...#.', // 6
    '......#...#.', // 7
    '......#...#.', // 8
    '.######...#.', // 9
    '.#........#.', // 10
    '.#........#.', // 11
    '.##########.', // 12
    '......#.....', // 13
  ],
  start: { cell: [6, 13], dir: 'N' },
  route: path([6, 13], [6, 12], [1, 12], [1, 9], [6, 9], [6, 5], [10, 5], [10, 1], [1, 1], [1, 3]),
  park: { cell: [1, 3], travel: 'S' },
  zones: [
    { from: [0, 9], to: [11, 13], limit: 30, name: 'Strefa Tempo 30' },
    { from: [0, 0], to: [9, 4], limit: 20, name: 'Strefa zamieszkania' },
  ],
  triggers: [
    { cell: [4, 12], q: 'q_lights' },
    { cell: [1, 10], q: 'q_children' },
    { cell: [4, 9], q: 'q_park_sidewalk' },
    { cell: [6, 7], q: 'q_crosswalk' },
    { cell: [9, 5], q: 'q_yield_a7' },
    { cell: [10, 3], q: 'q_park_crosswalk' },
    { cell: [9, 1], q: 'q_zone20' },
    { cell: [4, 1], q: 'q_crosswalk' },
  ],
  signs: [
    { cell: [6, 13], travel: 'N', type: 'B-43' },
    { cell: [1, 10], travel: 'N', type: 'A-17' },
    { cell: [6, 6], travel: 'N', type: 'D-6' },
    { cell: [10, 3], travel: 'N', type: 'D-6' },
    { cell: [9, 5], travel: 'E', type: 'A-7' },
    { cell: [9, 1], travel: 'W', type: 'D-40' },
    { cell: [1, 3], travel: 'S', type: 'D-18', along: -8 },
    { cell: [6, 8], travel: 'S', type: 'B-43' },
    // межі зони Tempo 30
    { cell: [10, 9], travel: 'S', type: 'B-43', along: -6 },
    { cell: [6, 9], travel: 'N', type: 'B-44', along: 6 },
    { cell: [10, 9], travel: 'N', type: 'B-44', along: 6 },
    // межі «strefa zamieszkania»
    { cell: [1, 4], travel: 'N', type: 'D-40', along: -6 },
    { cell: [6, 4], travel: 'N', type: 'D-40', along: -6 },
    { cell: [9, 1], travel: 'E', type: 'D-41', along: 6 },
    { cell: [1, 4], travel: 'S', type: 'D-41', along: 6 },
    { cell: [6, 4], travel: 'S', type: 'D-41', along: 6 },
  ],
  crosswalks: [
    { cell: [3, 12], axis: 'h' },
    { cell: [6, 6], axis: 'v' },
    { cell: [8, 5], axis: 'h' },
    { cell: [10, 3], axis: 'v' },
    { cell: [4, 1], axis: 'h' },
    { cell: [1, 11], axis: 'v' },
  ],
  actors: [
    // машини, між якими треба припаркуватися
    { cell: [1, 3], kind: 'car', face: 'S', color: 0x4f8fe6, lateral: BAY_LAT, along: -6.6 },
    { cell: [1, 3], kind: 'car', face: 'S', color: 0xf2f2f2, lateral: BAY_LAT, along: 6.6 },
    { cell: [1, 4], kind: 'car', face: 'S', color: 0x9b6be6, lateral: BAY_LAT, along: 2 },
    { cell: [10, 8], kind: 'police', face: 'N', lateral: BAY_LAT },
    { cell: [6, 6], kind: 'pedestrian', face: 'W', go: 'q_crosswalk', adapt: ['wheelchair', 'cane'] },
    { cell: [4, 1], kind: 'pedestrian', face: 'S' },
    { cell: [1, 11], kind: 'pedestrian', face: 'E' },
  ],
};
