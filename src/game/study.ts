import { QUESTIONS } from '../data/questions';
import { progress, shuffle } from './progress';

/** Навчання без їзди: пробний іспит, помилки й повторення, тренування за темою. */
export type StudyKind = 'exam' | 'review' | 'topic';

/**
 * Склад тесту на іспиті категорії B — § 19 ust. 4–5, 9–10 rozporządzenia MI z 24.11.2023 (Dz.U. 2023 poz. 2659):
 * 20 питань з базових знань (TAK/NIE): 10 × 3, 6 × 2, 4 × 1 бал;
 * 12 спеціалізованих (A/B/C): 6 × 3, 4 × 2, 2 × 1 бал. Разом 74, позитивний результат — щонайменше 68.
 */
const EXAM_PLAN = [
  { options: 2, points: 3, n: 10 },
  { options: 2, points: 2, n: 6 },
  { options: 2, points: 1, n: 4 },
  { options: 3, points: 3, n: 6 },
  { options: 3, points: 2, n: 4 },
  { options: 3, points: 1, n: 2 },
];
export const EXAM_MAX = 74;
export const EXAM_PASS = 68;
/** за скільки питань до кінця «Помилки й повторення» показує підсумок */
const REVIEW_SIZE = 20;

export const ALL_IDS = Object.keys(QUESTIONS);

/** Випадкові питання за планом іспиту: спершу 20 базових, потім 12 спеціалізованих. */
export function examSet(): string[] {
  const all = Object.values(QUESTIONS);
  const part = (options: number) =>
    shuffle(EXAM_PLAN.filter((p) => p.options === options).flatMap((p) =>
      shuffle(all.filter((q) => q.ua.options.length === p.options && q.points === p.points)).slice(0, p.n).map((q) => q.id),
    ));
  return [...part(2), ...part(3)];
}

export function reviewSet(): string[] {
  return progress.dueList(ALL_IDS).slice(0, REVIEW_SIZE);
}

/** Теми в порядку бази (вона згрупована за ситуаціями на дорозі). */
export function topics(): { tag: string; ids: string[] }[] {
  const by = new Map<string, string[]>();
  for (const q of Object.values(QUESTIONS)) {
    if (!by.has(q.tag)) by.set(q.tag, []);
    by.get(q.tag)!.push(q.id);
  }
  return [...by].map(([tag, ids]) => ({ tag, ids }));
}

export function topicSet(tag: string): string[] {
  return progress.order(topics().find((t) => t.tag === tag)?.ids ?? [], (id) => id);
}
