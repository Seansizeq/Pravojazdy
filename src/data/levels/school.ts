import type { Level } from '../../types';
import { path } from './util';

// Біля школи: незрячий пішохід на «зебрі», велосипедист попереду, поворот праворуч через перехід,
// шкільний автобус з аварійкою, переїзд для велосипедистів D-6b і наприкінці — strefa zamieszkania.
export const SCHOOL: Level = {
  id: 'school',
  name: 'Біля школи',
  icon: '🚸',
  description: 'Діти, пішоходи й велосипедисти: незрячий на переході, обгін велосипедиста, шкільний автобус, D-6b.',
  task: 'route',
  seed: 4242,
  traffic: 5,
  quiz: { gap: 100, chance: 0.85 },
  cols: 12,
  rows: 19,
  map: [
    '.........#..', // 0
    '.........#..', // 1
    '..########..', // 2
    '...#.....#..', // 3
    '...#.....#..', // 4
    '...#.....#..', // 5
    '...#.....#..', // 6
    '...#.....#..', // 7
    '...#######..', // 8
    '...#........', // 9
    '...#........', // 10
    '...#........', // 11
    '...#........', // 12
    '...#........', // 13
    '...#........', // 14
    '...#........', // 15
    '...#........', // 16
    '...#........', // 17
    '...#........', // 18
  ],
  start: { cell: [3, 18], dir: 'N' },
  route: path([3, 18], [3, 8], [9, 8], [9, 2], [4, 2]),
  zones: [{ from: [0, 0], to: [8, 2], limit: 20, name: 'Strefa zamieszkania' }],
  triggers: [
    { cell: [3, 16], q: 'q_children' },
    { cell: [3, 14], q: 'sch_white_cane' },
    { cell: [3, 11], q: 'sch_cyclist' },
    { cell: [3, 9], q: 'sch_turn_peds' },
    { cell: [6, 8], q: 'sch_school_bus' },
    { cell: [9, 7], q: 'sch_cyclist_xing' },
    { cell: [9, 4], q: 'sch_no_overtake_xing' },
    { cell: [7, 2], q: 'q_zone20' },
    { cell: [5, 2], q: 'sch_horn' },
  ],
  signs: [
    { cell: [3, 16], travel: 'N', type: 'A-17' },
    { cell: [3, 13], travel: 'N', type: 'D-6' },
    { cell: [4, 8], travel: 'E', type: 'D-6' },
    { cell: [7, 8], travel: 'E', type: 'D-15' },
    { cell: [9, 6], travel: 'N', type: 'D-6b', go: 'sch_cyclist_xing', alts: [{ type: 'D-6a' }] },
    { cell: [9, 3], travel: 'N', type: 'D-6' },
    // strefa zamieszkania: в'їзди й виїзди
    { cell: [8, 2], travel: 'W', type: 'D-40', along: -6 },
    { cell: [8, 2], travel: 'E', type: 'D-41', along: 6 },
    { cell: [3, 3], travel: 'N', type: 'D-40', along: 6 },
    { cell: [3, 2], travel: 'S', type: 'D-41', along: 6 },
  ],
  crosswalks: [
    { cell: [3, 13], axis: 'v' },
    { cell: [4, 8], axis: 'h' },
    { cell: [9, 5], axis: 'v' },
    { cell: [9, 3], axis: 'v' },
  ],
  actors: [
    // незряча людина з білою тростиною переходить дорогу поза «зеброю», коли під'їжджаєш
    // (якщо питання про людину з обмеженою рухливістю — вона на візку)
    { cell: [3, 12], kind: 'pedestrian', face: 'W', go: 'sch_white_cane', color: 0x2b2b2b, variant: 'cane', adapt: ['wheelchair'] },
    // велосипедист попереду в тому ж напрямку (або людина на електросамокаті — під питання)
    { cell: [3, 10], kind: 'cyclist', face: 'N', go: 'sch_cyclist', travel: 100, adapt: ['scooter'] },
    // пішохід переходить дорогу, на яку повертаєш праворуч (або людина на візку — під питання)
    { cell: [4, 8], kind: 'pedestrian', face: 'N', go: 'sch_turn_peds', adapt: ['wheelchair'] },
    // шкільний автобус (art. 2 pkt 41a PoRD) на зупинці з увімкненою аварійкою
    { cell: [7, 8], kind: 'bus', face: 'E', lateral: 5.6, blink: 'hazard', variant: 'school' },
    // велосипедист на переїзді D-6b
    { cell: [9, 5], kind: 'cyclist', face: 'W', go: 'sch_cyclist_xing', along: -8, lateral: 0, travel: 17 },
    { cell: [9, 3], kind: 'pedestrian', face: 'E' },
    // велосипедист попереду в житловій зоні
    { cell: [4, 2], kind: 'cyclist', face: 'W', go: 'sch_horn', travel: 60 },
  ],
};
