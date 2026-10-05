import type { Level } from '../../../types';
import { FREE_COAST } from './coast';
import { FREE_DESERT } from './desert';
import { FREE_EURO } from './euro';
import { FREE_MOUNTAIN } from './mountain';
import { FREE_TAIGA } from './taiga';
import { FREE_VILLAGE } from './village';

/** Карти вільної їзди з різною місцевістю (порядок — як у меню). */
export const FREE_MAPS: Level[] = [FREE_EURO, FREE_VILLAGE, FREE_TAIGA, FREE_MOUNTAIN, FREE_DESERT, FREE_COAST];
