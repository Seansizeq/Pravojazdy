import type { Level } from '../../types';
import { BAY_LAT } from '../../world/build';

// Пряма траса: спершу дорога ekspresowa (D-7, 120 км/год), далі autostrada (D-9, 140 км/год),
// наприкінці — кінець автостради (D-10) і звичайна двостороння дорога (90 км/год), про яку
// заздалегідь попереджає A-20. На S і на A — по зламаному авто з трикутником за 100 м.
const ROWS = 112;

export const HIGHWAY: Level = {
  id: 'highway',
  name: 'Траса: S і A',
  icon: '🛣️',
  description: 'Дорога ekspresowa (120) і autostrada (140): дистанція, аварійна зупинка, задній хід, кінець автостради.',
  task: 'route',
  seed: 1400,
  traffic: 0,
  // поза зонами S і A — звичайна дорога поза населеним пунктом
  limit: 90,
  maxSpeed: 150,
  scenery: 'highway',
  quiz: { gap: 150, chance: 0.9 },
  cols: 5,
  rows: ROWS,
  map: Array.from({ length: ROWS }, () => '..#..'),
  start: { cell: [2, ROWS - 1], dir: 'N' },
  route: Array.from({ length: ROWS }, (_, i) => [2, ROWS - 1 - i] as [number, number]),
  zones: [
    { from: [0, 69], to: [4, ROWS - 1], limit: 120, name: 'Droga ekspresowa', sign: 'D-7' },
    { from: [0, 10], to: [4, 68], limit: 140, name: 'Autostrada', sign: 'D-9', end: 'D-10' },
  ],
  triggers: [
    // дорога ekspresowa
    { cell: [2, 108], q: 'hw_express' },
    { cell: [2, 100], q: 'hw_distance' },
    { cell: [2, 92], q: 'hw_reverse' },
    { cell: [2, 84], q: 'hw_breakdown' },
    { cell: [2, 76], q: 'acc_triangle' },
    // autostrada
    { cell: [2, 68], q: 'hw_motorway' },
    { cell: [2, 60], q: 'hw_distance' },
    { cell: [2, 52], q: 'hw_breakdown' },
    { cell: [2, 44], q: 'hw_reverse' },
    { cell: [2, 36], q: 'cty_twoway' },
    { cell: [2, 28], q: 'hw_towing' },
    { cell: [2, 20], q: 'cty_wind' },
    // за автострадою — звичайна двостороння дорога
    { cell: [2, 7], q: 'dt_left_edge' },
  ],
  signs: [
    { cell: [2, 109], travel: 'N', type: 'D-7' },
    { cell: [2, 69], travel: 'N', type: 'D-9', along: 6 },
    { cell: [2, 68], travel: 'S', type: 'D-7', along: 6 },
    // за 480 м до кінця автостради: далі рух в обидва боки на одній проїжджій частині
    { cell: [2, 34], travel: 'N', type: 'A-20' },
    // відкрита ділянка — бічний вітер
    { cell: [2, 20], travel: 'N', type: 'A-19' },
    { cell: [2, 10], travel: 'N', type: 'D-10', along: 6 },
    { cell: [2, 9], travel: 'S', type: 'D-9', along: 6 },
  ],
  crosswalks: [],
  props: [
    // трикутники за 100 м до зламаних авто (art. 50 ust. 2)
    { cell: [2, 82], kind: 'triangle', face: 'N', lateral: 3.6 },
    { cell: [2, 50], kind: 'triangle', face: 'N', lateral: 3.6 },
  ],
  actors: [
    // зламані авто на узбіччі з увімкненою аварійкою
    { cell: [2, 77], kind: 'car', face: 'N', color: 0xf2f2f2, lateral: BAY_LAT + 0.6, blink: 'hazard' },
    { cell: [2, 45], kind: 'car', face: 'N', color: 0x4f8fe6, lateral: BAY_LAT + 0.6, blink: 'hazard' },
  ],
};
