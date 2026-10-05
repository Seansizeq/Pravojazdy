/**
 * Прогрес гравця по кожному офіційному питанню (зберігається в браузері між сесіями)
 * та інтервальне повторення за «коробками» Лейтнера:
 * помилка — питання повертається одразу; правильна відповідь у строк — наступне повторення
 * через 1, 3, 7, 14, 30 днів.
 */

const KEY = 'pdrpl.progress';
const DAY = 24 * 3600 * 1000;
/** через скільки днів повторити питання з коробки N */
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
/** з цієї коробки питання засвоєне: правильно щонайменше 3 рази з перервами в 1 і 3 дні */
const MASTERED_BOX = 3;

export interface QStat {
  ok: number;
  bad: number;
  box: number;
  /** коли повторити (мс) */
  due: number;
  /** коли востаннє відповідав (мс) */
  last: number;
}

/** new — ще не відповідав; mistake — остання відповідь неправильна; learning — вивчаю; mastered — засвоєно */
export type QStatus = 'new' | 'mistake' | 'learning' | 'mastered';

export interface Summary {
  new: number;
  mistake: number;
  learning: number;
  mastered: number;
  /** помилки й питання, яким настав строк повторення */
  due: number;
}

function load(): Record<string, QStat> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

class Progress {
  private stats = load();

  record(id: string, ok: boolean, now = Date.now()) {
    const s = this.stats[id] ?? { ok: 0, bad: 0, box: 0, due: 0, last: 0 };
    if (!ok) {
      s.bad++;
      s.box = 0;
      s.due = now;
    } else {
      s.ok++;
      // коробка росте, лише коли настав строк (або питання нове): кілька правильних відповідей за один день — як одна
      if (s.due <= now) {
        s.box = Math.min(s.box + 1, INTERVAL_DAYS.length - 1);
        s.due = now + INTERVAL_DAYS[s.box] * DAY;
      }
    }
    s.last = now;
    this.stats[id] = s;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.stats));
    } catch {
      /* приватний режим — прогрес живе до перезавантаження */
    }
  }

  status(id: string): QStatus {
    const s = this.stats[id];
    if (!s) return 'new';
    if (s.box === 0) return 'mistake';
    return s.box >= MASTERED_BOX ? 'mastered' : 'learning';
  }

  /** Помилка або настав строк повторення. */
  isDue(id: string, now = Date.now()) {
    const s = this.stats[id];
    return !!s && s.due <= now;
  }

  /** Черговість: 0 — помилки, 1 — настав строк повторення, 2 — нові, 3 — решта (давніші — раніше). */
  private rank(id: string, now: number) {
    const st = this.status(id);
    if (st === 'mistake') return 0;
    if (st === 'new') return 2;
    return this.isDue(id, now) ? 1 : 3;
  }

  /** Питання в порядку, в якому їх варто ставити; в межах однієї групи — випадково. */
  order<T>(items: T[], idOf: (t: T) => string): T[] {
    const now = Date.now();
    return items
      .map((t) => ({ t, r: this.rank(idOf(t), now), last: this.stats[idOf(t)]?.last ?? 0, rnd: Math.random() }))
      .sort((a, b) => a.r - b.r || (a.r === 3 ? a.last - b.last : 0) || a.rnd - b.rnd)
      .map((x) => x.t);
  }

  /** Помилки (випадково) і питання, яким настав строк повторення (найпростроченіші — першими). */
  dueList(ids: string[]) {
    const now = Date.now();
    const mistakes = ids.filter((id) => this.status(id) === 'mistake');
    const due = ids
      .filter((id) => this.status(id) !== 'mistake' && this.isDue(id, now))
      .sort((a, b) => this.stats[a].due - this.stats[b].due);
    return [...shuffle(mistakes), ...due];
  }

  summary(ids: string[]): Summary {
    const now = Date.now();
    const out: Summary = { new: 0, mistake: 0, learning: 0, mastered: 0, due: 0 };
    for (const id of ids) {
      out[this.status(id)]++;
      if (this.isDue(id, now)) out.due++;
    }
    return out;
  }
}

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export const progress = new Progress();
