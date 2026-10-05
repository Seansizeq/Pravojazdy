import type { Level } from '../../types';
import { path } from './util';

// Заміська дорога: виїзд із села (D-43, далі 90 км/год), рівнозначне перехрестя з A-5,
// повороти з A-1/A-2/A-3, дикі тварини, дорожні роботи, друге село з «лежачим поліцейським».
export const COUNTRY: Level = {
  id: 'country',
  name: 'Заміська дорога',
  icon: '🌾',
  description: 'Поза населеним пунктом — 90 км/год. Попереджувальні знаки, повороти, тварини, ремонт дороги.',
  task: 'route',
  seed: 8080,
  traffic: 3,
  limit: 90,
  maxSpeed: 100,
  scenery: 'country',
  quiz: { gap: 100, chance: 0.85 },
  cols: 14,
  rows: 24,
  map: [
    '...........#..', // 0
    '...........#..', // 1
    '...........#..', // 2
    '......######..', // 3
    '......#.......', // 4
    '......#.......', // 5
    '......#.......', // 6
    '..#####.......', // 7
    '..#...........', // 8
    '..#...........', // 9
    '..#...........', // 10
    '..#...........', // 11
    '..#######.....', // 12
    '........#.....', // 13
    '........#.....', // 14
    '##############', // 15
    '........#.....', // 16
    '........#.....', // 17
    '........#.....', // 18
    '........#.....', // 19
    '........#.....', // 20
    '........#.....', // 21
    '........#.....', // 22
    '........#.....', // 23
  ],
  start: { cell: [8, 23], dir: 'N' },
  route: path([8, 23], [8, 12], [2, 12], [2, 7], [6, 7], [6, 3], [11, 3], [11, 0]),
  zones: [
    { from: [0, 19], to: [13, 23], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' },
    { from: [6, 0], to: [13, 3], limit: 50, name: 'Obszar zabudowany', sign: 'D-42', end: 'D-43' },
  ],
  triggers: [
    { cell: [8, 21], q: 'q_speed50' },
    { cell: [8, 19], q: 'cty_exit_town' },
    { cell: [8, 17], q: 'cty_a5' },
    { cell: [8, 18], q: 'cty_speed90' },
    { cell: [8, 13], q: 'cty_curves' },
    { cell: [3, 12], q: 'cty_curve_r' },
    { cell: [2, 10], q: 'cty_animals' },
    { cell: [2, 8], q: 'cty_curves' },
    { cell: [4, 7], q: 'cty_overtake' },
    { cell: [6, 6], q: 'cty_works' },
    { cell: [7, 3], q: 'cty_curves' },
    { cell: [8, 3], q: 'cty_bump' },
    { cell: [10, 3], q: 'q_children' },
    { cell: [11, 1], q: 'cty_hill' },
  ],
  signs: [
    // село на старті
    { cell: [8, 22], travel: 'N', type: 'D-42' },
    { cell: [8, 19], travel: 'N', type: 'D-43', along: 6 },
    { cell: [8, 18], travel: 'S', type: 'D-42', along: 6 },
    // рівнозначне перехрестя попереду
    { cell: [8, 17], travel: 'N', type: 'A-5' },
    // назва місцевості (не кінець населеного пункту)
    { cell: [8, 20], travel: 'N', type: 'E-17a', along: 4 },
    // звивиста ділянка: ліворуч (8,12) → праворуч (2,12) → праворуч (2,7) → ліворуч (6,7) → праворуч (6,3)
    {
      cell: [8, 13], travel: 'N', type: 'A-4', plate: 'Droga kręta', go: 'cty_curves',
      alts: [{ type: 'A-4' }, { type: 'A-4', plate: '3' }],
    },
    { cell: [3, 12], travel: 'W', type: 'A-1' },
    { cell: [2, 10], travel: 'N', type: 'A-18b', plate: '3 km', go: 'cty_animals', alts: [{ type: 'A-18a' }] },
    { cell: [2, 8], travel: 'N', type: 'A-3', plate: '3' },
    { cell: [5, 7], travel: 'E', type: 'A-2' },
    // кінець звивистої ділянки
    { cell: [7, 3], travel: 'E', type: 'A-3', plate: 'Koniec' },
    // підйом / спуск на виїзді з села
    { cell: [11, 1], travel: 'N', type: 'A-23', plate: '10%', go: 'cty_hill', alts: [{ type: 'A-22' }] },
    // дорожні роботи
    { cell: [6, 6], travel: 'N', type: 'A-14' },
    // друге село
    { cell: [6, 4], travel: 'N', type: 'D-42', along: 6 },
    { cell: [6, 3], travel: 'S', type: 'D-43', along: 6 },
    {
      cell: [8, 3], travel: 'E', type: 'A-11a', plate: '25 m', go: 'cty_bump',
      alts: [{ type: 'A-11' }, { type: 'A-11', plate: '1,2 km' }],
    },
    { cell: [10, 3], travel: 'E', type: 'A-17' },
  ],
  crosswalks: [{ cell: [8, 20], axis: 'v' }],
  props: [
    // огородження робіт на зустрічній смузі
    { cell: [6, 5], kind: 'barrier', face: 'S', lateral: 3.3 },
    { cell: [6, 5], kind: 'cone', face: 'S', lateral: 1.2, along: -5 },
    { cell: [6, 5], kind: 'cone', face: 'S', lateral: 1.2, along: 5 },
  ],
  actors: [
    // авто праворуч на рівнозначному перехресті
    { cell: [9, 15], kind: 'car', face: 'W', color: 0xe66a4f, go: 'cty_a5', travel: 90 },
    { cell: [8, 20], kind: 'pedestrian', face: 'E' },
    // повільне авто попереду (під питання — вантажівка), яке хочеться обігнати перед поворотом
    { cell: [5, 7], kind: 'car', face: 'E', color: 0x9b6be6, go: 'cty_overtake', travel: 18, adapt: ['truck'] },
    // дорожній робітник біля огородження
    { cell: [6, 5], kind: 'pedestrian', face: 'S', variant: 'worker', along: 2 },
  ],
};
