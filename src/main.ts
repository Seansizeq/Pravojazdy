import { Game } from './game/game';

const game = new Game(document.getElementById('scene') as HTMLCanvasElement);

// доступ з консолі браузера для налагодження (лише в dev-режимі)
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;

// у dev-режимі перевіряємо рівні на логічні помилки (знаки, питання, зони)
if (import.meta.env.DEV) {
  Promise.all([import('./data/audit'), import('./data/levels')]).then(([a, l]) => a.auditAll([...l.LEVELS, ...l.FREE_MAPS]));
}
