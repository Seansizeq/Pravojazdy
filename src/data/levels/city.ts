import type { Cell, Level } from '../../types';
import { path } from './util';

// Велике місто 16×16: рондо в центрі, головна вулиця з D-1, зона Tempo 30, тупик.
const CITY_MAP = [
  '.............#..', // 0
  '.............#..', // 1
  '...###########..', // 2
  '...#....#..#.#..', // 3
  '...#....#..#.#..', // 4
  '...#....#..#.#..', // 5
  '...#....#....#..', // 6
  '################', // 7
  '...#..#.#....#..', // 8
  '...#..#.#....#..', // 9
  '...####.#....#..', // 10
  '...#....#....#..', // 11
  '...###########..', // 12
  '...#............', // 13
  '...#............', // 14
  '...#............', // 15
];

type CityBase = Omit<Level, 'id' | 'name' | 'icon' | 'description' | 'task'>;

const CITY: CityBase = {
  seed: 909,
  cols: 16,
  rows: 16,
  map: CITY_MAP,
  roundabouts: [[8, 7]],
  start: { cell: [3, 15], dir: 'N' },
  zones: [{ from: [2, 8], to: [7, 11], limit: 30, name: 'Strefa Tempo 30' }],
  triggers: [
    { cell: [8, 6], q: 'q_rondo_priority', dir: 'S' },
    { cell: [8, 8], q: 'q_rondo_priority', dir: 'N' },
    { cell: [4, 7], q: 'sch_trust', dir: 'E' },
    { cell: [9, 7], q: 'taxi_phone', dir: 'W' },
    { cell: [3, 6], q: 'q_yield_a7', dir: 'S' },
    { cell: [13, 8], q: 'q_yield_a7', dir: 'N' },
    { cell: [2, 7], q: 'q_priority_road', dir: 'E' },
    { cell: [12, 7], q: 'q_priority_road', dir: 'W' },
    { cell: [12, 2], q: 'q_stop', dir: 'E' },
    { cell: [8, 11], q: 'q_stop', dir: 'S' },
    { cell: [5, 7], q: 'q_crosswalk' },
    { cell: [8, 4], q: 'q_crosswalk' },
    { cell: [13, 9], q: 'q_crosswalk' },
    { cell: [13, 4], q: 'q_no_overtaking', dir: 'S' },
    { cell: [8, 9], q: 'q_no_stopping', dir: 'N' },
    { cell: [13, 10], q: 'q_uturn', dir: 'S' },
    { cell: [4, 10], q: 'q_children', dir: 'E' },
    { cell: [3, 8], q: 'taxi_kids', dir: 'S' },
    { cell: [6, 8], q: 'taxi_belts', dir: 'S' },
    { cell: [11, 2], q: 'taxi_capacity' },
    { cell: [11, 4], q: 'q_park_sidewalk' },
    { cell: [9, 12], q: 'q_park_crosswalk', dir: 'E' },
    { cell: [11, 12], q: 'q_lights' },
    { cell: [3, 13], q: 'q_speed50', dir: 'N' },
    { cell: [12, 7], q: 'q_left_position', dir: 'E' },
  ],
  signs: [
    { cell: [8, 6], travel: 'S', type: 'C-12', below: 'A-7' },
    { cell: [7, 7], travel: 'E', type: 'C-12', below: 'A-7' },
    { cell: [9, 7], travel: 'W', type: 'C-12', below: 'A-7' },
    { cell: [8, 8], travel: 'N', type: 'C-12', below: 'A-7' },
    { cell: [2, 7], travel: 'E', type: 'D-1' },
    { cell: [12, 7], travel: 'W', type: 'D-1' },
    { cell: [3, 6], travel: 'S', type: 'A-7' },
    { cell: [3, 8], travel: 'N', type: 'A-7' },
    { cell: [13, 6], travel: 'S', type: 'A-7' },
    { cell: [13, 8], travel: 'N', type: 'A-7' },
    { cell: [12, 2], travel: 'E', type: 'B-20' },
    { cell: [8, 11], travel: 'S', type: 'B-20' },
    { cell: [13, 4], travel: 'S', type: 'B-25' },
    { cell: [8, 9], travel: 'N', type: 'B-36' },
    { cell: [13, 10], travel: 'S', type: 'B-23' },
    { cell: [10, 7], travel: 'E', type: 'D-15' },
    { cell: [4, 10], travel: 'E', type: 'A-17' },
    { cell: [3, 8], travel: 'S', type: 'B-43' },
    { cell: [6, 8], travel: 'S', type: 'B-43' },
    { cell: [5, 7], travel: 'E', type: 'D-6' },
    { cell: [8, 4], travel: 'S', type: 'D-6' },
    { cell: [13, 9], travel: 'N', type: 'D-6' },
    { cell: [10, 12], travel: 'E', type: 'D-6' },
    { cell: [3, 14], travel: 'N', type: 'D-42' },
    // T-перехрестя (6,7): бічний в'їзд з зони поступається головній
    { cell: [6, 8], travel: 'N', type: 'A-7' },
    // межі зони Tempo 30
    { cell: [3, 11], travel: 'N', type: 'B-43', along: -6 },
    { cell: [3, 8], travel: 'N', type: 'B-44', along: 6 },
    { cell: [6, 8], travel: 'N', type: 'B-44', along: 6 },
    { cell: [3, 11], travel: 'S', type: 'B-44', along: 6 },
  ],
  crosswalks: [
    { cell: [5, 7], axis: 'h' },
    { cell: [8, 4], axis: 'v' },
    { cell: [13, 9], axis: 'v' },
    { cell: [10, 12], axis: 'h' },
    { cell: [3, 4], axis: 'v' },
    { cell: [3, 13], axis: 'v' },
    { cell: [5, 10], axis: 'h' },
  ],
  actors: [
    // пішоходи постійно ходять через «зебри»
    { cell: [5, 7], kind: 'pedestrian', face: 'S' },
    // незряча людина з білою тростиною і людина на візку
    { cell: [8, 4], kind: 'pedestrian', face: 'E', variant: 'cane' },
    { cell: [13, 9], kind: 'pedestrian', face: 'W', variant: 'wheelchair' },
    { cell: [3, 13], kind: 'pedestrian', face: 'E' },
    { cell: [10, 12], kind: 'pedestrian', face: 'N' },
  ],
};

export const TAXI: Level = {
  ...CITY,
  id: 'taxi',
  name: 'Таксі',
  icon: '🚕',
  description: 'Велике місто з трафіком. Забери трьох пасажирів і довези за адресою — маршрут прокладається сам.',
  task: 'taxi',
  traffic: 20,
  stops: [
    { cell: [10, 2], kind: 'pickup' },
    { cell: [4, 10], kind: 'dropoff' },
    { cell: [13, 10], kind: 'pickup' },
    { cell: [1, 7], kind: 'dropoff' },
    { cell: [8, 10], kind: 'pickup' },
    { cell: [11, 4], kind: 'dropoff' },
  ],
};

// Міні-іспит: довгий маршрут містом через рондо; питання — випадкові з усієї офіційної бази,
// підсумок у балах за іспитовою шкалою (1–3 бали за питання).
const EXAM_ROUTE = path([3, 15], [3, 7], [13, 7], [13, 2], [3, 2], [3, 5]);

export const EXAM: Level = {
  ...CITY,
  id: 'exam',
  name: 'Міні-іспит',
  icon: '🎓',
  description: 'Маршрут містом і випадкові питання з усієї бази. Підсумок у балах, як на іспиті у WORD.',
  task: 'route',
  traffic: 12,
  exam: true,
  quiz: { gap: 100, chance: 1 },
  route: EXAM_ROUTE,
  // точка з питанням — кожна друга клітинка маршруту, крім старту
  triggers: EXAM_ROUTE.filter((_, i) => i >= 2 && i % 2 === 0 && i < EXAM_ROUTE.length - 1).map((cell: Cell) => ({ cell, q: 'exam' })),
};
