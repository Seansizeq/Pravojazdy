import type { Level } from '../../types';
import { BAY_LAT } from '../../world/build';
import { path } from './util';

// Нічна заміська дорога в тумані: протитуманні фари, дальнє світло, зустрічне авто, авто на узбіччі.
export const NIGHT: Level = {
  id: 'night',
  name: 'Ніч і туман',
  icon: '🌫️',
  description: 'Темно й туман: коли вмикати протитуманні, коли перемикати дальнє, як їхати безпечно.',
  task: 'route',
  seed: 2323,
  traffic: 3,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  weather: 'night',
  quiz: { gap: 100, chance: 0.85 },
  cols: 12,
  rows: 20,
  map: [
    '.........#..', // 0
    '.........#..', // 1
    '.....#####..', // 2
    '.....#......', // 3
    '.....#......', // 4
    '.....#......', // 5
    '.....#......', // 6
    '.....#......', // 7
    '..####......', // 8
    '..#.........', // 9
    '..#.........', // 10
    '..#.........', // 11
    '..#.........', // 12
    '..#######...', // 13
    '........#...', // 14
    '........#...', // 15
    '........#...', // 16
    '........#...', // 17
    '........#...', // 18
    '........#...', // 19
  ],
  start: { cell: [8, 19], dir: 'N' },
  // туман у низині: на поворотах після села і біля виїзду на північ
  weatherZones: [
    { from: [2, 9], to: [7, 13], weather: 'fog' },
    { from: [6, 0], to: [9, 3], weather: 'fog' },
  ],
  route: path([8, 19], [8, 13], [2, 13], [2, 8], [5, 8], [5, 2], [9, 2], [9, 0]),
  triggers: [
    { cell: [8, 17], q: 'q_lights' },
    { cell: [8, 15], q: 'night_beams' },
    { cell: [6, 13], q: 'fog_lights' },
    { cell: [3, 13], q: 'cty_curve_r' },
    { cell: [2, 11], q: 'fog_drive' },
    { cell: [2, 9], q: 'cty_curves' },
    { cell: [4, 8], q: 'night_parked' },
    { cell: [5, 6], q: 'dash_lamps' },
    { cell: [7, 2], q: 'fog_lights' },
    { cell: [9, 1], q: 'cty_curves' },
  ],
  signs: [
    { cell: [3, 13], travel: 'W', type: 'A-1' },
    // звивиста ділянка: праворуч (2,8) → ліворуч (5,8) → праворуч (5,2) → ліворуч (9,2)
    { cell: [2, 9], travel: 'N', type: 'A-3', plate: '3', go: 'cty_curves', alts: [{ type: 'A-3' }] },
    { cell: [9, 1], travel: 'N', type: 'A-3', plate: 'Koniec' },
  ],
  crosswalks: [],
  actors: [
    // зустрічне авто з увімкненими фарами
    { cell: [8, 14], kind: 'car', face: 'S', color: 0x4f8fe6, go: 'night_beams', travel: 120 },
    // авто на узбіччі (стоянка вночі)
    { cell: [5, 7], kind: 'car', face: 'N', color: 0x9b6be6, lateral: BAY_LAT, along: 4 },
  ],
};
