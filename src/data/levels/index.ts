import type { Level } from '../../types';
import { ACCIDENT } from './accident';
import { BACKROADS } from './backroads';
import { EXAM, TAXI } from './city';
import { FREE_MAPS } from './free';
import { COUNTRY } from './country';
import { DOWNTOWN } from './downtown';
import { HIGHWAY } from './highway';
import { NIGHT } from './night';
import { OLDTOWN } from './oldtown';
import { RAIL } from './rail';
import { RESIDENTIAL } from './residential';
import { RONDO } from './rondo';
import { SCHOOL } from './school';
import { SUBURB } from './suburb';
import { WINTER } from './winter';

/** Рівні по порядку проходження: місто → за містом → складні умови → іспит. */
export const LEVELS: Level[] = [
  OLDTOWN, SCHOOL, RONDO, RESIDENTIAL, DOWNTOWN, SUBURB,
  COUNTRY, BACKROADS, RAIL, HIGHWAY, NIGHT, WINTER, ACCIDENT,
  TAXI, EXAM,
];
export { FREE_MAPS };
/** Перша карта вільної їзди (для скриптів, що перевіряють одну карту). */
export const FREE = FREE_MAPS[0];
