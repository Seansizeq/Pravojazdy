import type { Level } from '../../types';
import { BAY_LAT } from '../../world/build';
import { path } from './util';

// Центр міста: де можна й де не можна зупинитися та стати на стоянку. Наприкінці — паркування.
export const DOWNTOWN: Level = {
  id: 'downtown',
  name: 'Центр: зупинка і стоянка',
  icon: '🅿️',
  description: 'Знаки B-35 і B-36, зупинки біля перехресть, переходів і автобусних зупинок. Фінал — паркування.',
  task: 'park',
  seed: 5150,
  traffic: 10,
  quiz: { gap: 100, chance: 0.85 },
  cols: 14,
  rows: 14,
  map: [
    '......#.......', // 0
    '......#.......', // 1
    '.############.', // 2
    '.#....#.....#.', // 3
    '.#....#.....#.', // 4
    '.#....#.....#.', // 5
    '.############.', // 6
    '.#..........#.', // 7
    '.#..........#.', // 8
    '.#..........#.', // 9
    '.############.', // 10
    '......#.......', // 11
    '......#.......', // 12
    '......#.......', // 13
  ],
  start: { cell: [6, 13], dir: 'N' },
  route: path([6, 13], [6, 10], [12, 10], [12, 2], [1, 2], [1, 8]),
  park: { cell: [1, 8], travel: 'S' },
  triggers: [
    { cell: [6, 11], q: 'dt_bus_bay' },
    { cell: [8, 10], q: 'q_no_stopping' },
    { cell: [10, 10], q: 'q_park_sidewalk' },
    { cell: [12, 7], q: 'dt_junction' },
    { cell: [12, 4], q: 'q_park_crosswalk' },
    { cell: [10, 2], q: 'dt_engine' },
    { cell: [8, 2], q: 'dt_disabled' },
  ],
  signs: [
    { cell: [6, 11], travel: 'N', type: 'D-15' },
    { cell: [8, 10], travel: 'E', type: 'B-36' },
    { cell: [12, 8], travel: 'N', type: 'B-35' },
    { cell: [12, 3], travel: 'N', type: 'D-6' },
    { cell: [1, 8], travel: 'S', type: 'D-18', along: -8 },
    // стоянка для людей з інвалідністю
    { cell: [7, 2], travel: 'W', type: 'D-18', along: -4 },
  ],
  bays: [
    { cell: [7, 2], travel: 'W', disabled: true, along: 2 },
    { cell: [8, 2], travel: 'W', disabled: true, along: 0 },
  ],
  crosswalks: [
    { cell: [12, 3], axis: 'v' },
    { cell: [9, 6], axis: 'h' },
    { cell: [3, 2], axis: 'h' },
  ],
  actors: [
    // автобус на зупинці
    { cell: [6, 11], kind: 'bus', face: 'N', lateral: 5.6 },
    // авто, частково на тротуарі
    { cell: [10, 10], kind: 'car', face: 'E', color: 0x9b6be6, lateral: BAY_LAT + 1.2, along: 4 },
    { cell: [11, 10], kind: 'car', face: 'E', color: 0xf2f2f2, lateral: BAY_LAT + 1.2, along: -2 },
    // машини біля паркувального місця
    { cell: [1, 8], kind: 'car', face: 'S', color: 0x4f8fe6, lateral: BAY_LAT, along: -6.6 },
    { cell: [1, 8], kind: 'car', face: 'S', color: 0xe66a4f, lateral: BAY_LAT, along: 6.6 },
    { cell: [1, 9], kind: 'car', face: 'S', color: 0x3ccf7a, lateral: BAY_LAT, along: 2 },
    { cell: [12, 3], kind: 'pedestrian', face: 'E' },
    { cell: [9, 6], kind: 'pedestrian', face: 'S' },
    { cell: [3, 2], kind: 'pedestrian', face: 'N' },
  ],
};
