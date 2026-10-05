import type { Level, Question } from '../types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type Lang = 'ua' | 'pl';
const LANG_KEY = 'pdrpl.lang';

function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'pl' ? 'pl' : 'ua';
  } catch {
    return 'ua';
  }
}

function saveLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* приватний режим */
  }
}

/** 1 бал, 2 бали, 5 балів */
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export interface Mistake {
  q: Question;
  picked: number;
}

export interface NavView {
  icon: string;
  dist: string;
  label: string;
  color?: string;
  clickable?: boolean;
}

export interface Best {
  score: number;
  pct: number;
}

let audio: AudioContext | null = null;
export function beep(ok: boolean) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    const notes = ok ? [660, 880] : [300, 220];
    notes.forEach((f, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = ok ? 'triangle' : 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.18);
      o.connect(g).connect(audio!.destination);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 0.2);
    });
  } catch {
    /* звук не критичний */
  }
}

export class UI {
  private toastTimer = 0;

  show(id: string, on = true) {
    $(id).classList.toggle('hidden', !on);
  }

  hideScreens() {
    for (const id of ['screen-menu', 'screen-finish', 'screen-pause', 'screen-quiz']) this.show(id, false);
  }

  setScore(score: number) {
    $('hud-score').textContent = `⭐ ${score}`;
  }

  setSpeed(kmh: number, limit: number) {
    $('speed').textContent = String(Math.round(kmh));
    $('speed-limit').textContent = String(limit);
    $('speed').parentElement!.classList.toggle('over', kmh > limit + 2);
  }

  setProgress(r: number | null) {
    this.show('progress', r !== null);
    if (r !== null) $('progress-bar').style.width = `${Math.round(r * 100)}%`;
  }

  setNav(v: NavView) {
    $('nav-arrow').textContent = v.icon;
    $('nav-dist').textContent = v.dist;
    $('nav-label').textContent = v.label;
    const nav = $('nav');
    nav.style.background = v.color ?? '';
    nav.classList.toggle('clickable', !!v.clickable);
  }

  onNavClick(fn: () => void) {
    $('nav').addEventListener('click', fn);
  }

  toast(msg: string, ms = 2200) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add('hidden'), ms);
  }

  /** Меню: рівні по порядку, нижче — карти вільної їзди (сітка карток). */
  menu(levels: Level[], free: Level[], best: Record<string, Best>, onPick: (l: Level) => void) {
    const box = $('levels');
    box.innerHTML = '';
    levels.forEach((l, i) => {
      const b = document.createElement('button');
      b.className = 'level';
      const res = best[l.id];
      b.innerHTML = `
        <div class="level-icon"></div>
        <div class="level-body"><div class="level-name"></div><div class="level-desc"></div></div>
        <div class="level-best ${res ? 'done' : ''}">${res ? `✓ ${res.pct}%<br>⭐ ${res.score}` : 'Новий'}</div>`;
      b.querySelector('.level-icon')!.textContent = l.icon;
      b.querySelector('.level-name')!.textContent = `${i + 1}. ${l.name}`;
      b.querySelector('.level-desc')!.textContent = l.description;
      b.onclick = () => onPick(l);
      box.appendChild(b);
    });
    const head = document.createElement('div');
    head.className = 'free-head';
    head.innerHTML = '<b>🚗 Вільна їзда</b><span>Катайся без маршруту — обери місцевість</span>';
    box.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'free-grid';
    for (const l of free) {
      const b = document.createElement('button');
      b.className = 'free-map';
      b.innerHTML = '<div class="free-icon"></div><div class="free-name"></div><div class="free-desc"></div>';
      b.querySelector('.free-icon')!.textContent = l.icon;
      b.querySelector('.free-name')!.textContent = l.name;
      b.querySelector('.free-desc')!.textContent = l.description;
      b.onclick = () => onPick(l);
      grid.appendChild(b);
    }
    box.appendChild(grid);
    this.show('screen-menu');
  }

  setPause(stats: string, questionsOn: boolean, showToggle: boolean) {
    $('pause-stats').innerHTML = stats;
    const t = $('btn-questions');
    t.textContent = `Питання: ${questionsOn ? 'увімкнені' : 'вимкнені'}`;
    t.classList.toggle('hidden', !showToggle);
  }

  /** Мова тексту питання: офіційний переклад UA або оригінал PL. */
  private lang: Lang = loadLang();

  /** Стан перемикачів «Автопілот» і «Час на відповідь» у меню, на паузі й у HUD. */
  setOptions(autoOn: boolean, timerOn: boolean) {
    $('opt-auto').textContent = `🤖 Автопілот: ${autoOn ? 'увімк.' : 'вимк.'}`;
    $('opt-timer').textContent = `⏱ Час на відповідь: ${timerOn ? 'як на іспиті' : 'без обмежень'}`;
    $('btn-auto-pause').textContent = `🤖 Автопілот: ${autoOn ? 'увімкнений' : 'вимкнений'}`;
    $('btn-timer-pause').textContent = `⏱ Час на відповідь: ${timerOn ? 'як на іспиті' : 'без обмежень'}`;
    for (const id of ['opt-auto', 'btn-auto', 'btn-auto-pause']) $(id).classList.toggle('on', autoOn);
    $('opt-timer').classList.toggle('on', timerOn);
    $('btn-timer-pause').classList.toggle('on', timerOn);
    $('controls').classList.toggle('auto', autoOn);
  }

  private quizTimer = 0;

  /**
   * Показує офіційне питання. Варіанти — у тому ж порядку, що й на іспиті (A, B, C або Tak/Nie).
   * time — обмеження часу (читання + відповідь, с) або null. Без відповіді за відведений час — 0 балів.
   * onAnswer викликається один раз (picked = -1, якщо час вийшов), onContinue — після «Їхати далі».
   */
  quiz(
    q: Question,
    reward: number,
    time: { read: number; answer: number } | null,
    onAnswer: (correct: boolean, picked: number) => void,
    onContinue: () => void,
  ) {
    $('quiz-tag').textContent = q.tag;
    $('quiz-meta').textContent = `№ ${q.num} · ${q.points} ${plural(q.points, 'бал', 'бали', 'балів')}`;

    const img = $<HTMLImageElement>('quiz-img');
    img.classList.toggle('hidden', !q.image);
    if (q.image) img.src = q.image;
    else img.removeAttribute('src');

    const box = $('quiz-options');
    box.innerHTML = '';
    const fb = $('quiz-feedback');
    fb.classList.add('hidden');
    const yesNo = q.ua.options.length === 2;
    let picked: number | null = null;
    let ok = false;

    const finish = (i: number) => {
      if (picked !== null) return;
      picked = i;
      clearInterval(this.quizTimer);
      $('quiz-timer').classList.add('hidden');
      ok = i === q.correct;
      buttons.forEach((x, j) => {
        x.disabled = true;
        if (j === q.correct) x.classList.add('correct');
        else if (j === i) x.classList.add('wrong');
      });
      render();
      $('fb-law').textContent = `📖 ${q.law}`;
      $('fb-src').textContent = `Офіційна база питань Ministerstwa Infrastruktury, питання № ${q.num}`;
      fb.classList.remove('hidden');
      beep(ok);
      onAnswer(ok, i);
      $('btn-continue').focus();
    };

    const buttons = q.ua.options.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'option';
      // так/ні — як кнопки TAK/NIE на іспиті, без літер; інакше — A, B, C
      b.innerHTML = yesNo ? '<span></span>' : `<span class="letter">${'ABC'[i]}</span><span></span>`;
      b.onclick = () => finish(i);
      box.appendChild(b);
      return b;
    });

    const render = () => {
      const pl = this.lang === 'pl';
      const t = pl ? q.pl : q.ua;
      $('quiz-text').textContent = t.text;
      buttons.forEach((b, i) => ((b.lastElementChild as HTMLElement).textContent = t.options[i]));
      $('quiz-lang').textContent = pl ? 'UA' : 'PL';
      $('btn-continue').textContent = pl ? 'Jedź dalej →' : 'Їхати далі →';
      if (picked === null) return;
      const title = $('fb-title');
      title.className = `fb-title ${ok ? 'good' : 'bad'}`;
      if (picked < 0) title.textContent = pl ? '⏱ Koniec czasu — 0 pkt' : '⏱ Час вийшов — 0 балів';
      else if (ok) title.textContent = pl ? `✅ Dobrze! +${reward}` : `✅ Правильно! +${reward}`;
      else title.textContent = pl ? '❌ Źle' : '❌ Неправильно';
      $('fb-text').textContent = `${pl ? 'Poprawna odpowiedź' : 'Правильна відповідь'}: ${t.options[q.correct]}`;
    };
    $('quiz-lang').onclick = () => {
      this.lang = this.lang === 'pl' ? 'ua' : 'pl';
      saveLang(this.lang);
      render();
      tick();
    };

    // таймер: спершу час на читання, далі — на відповідь (як на іспиті)
    clearInterval(this.quizTimer);
    const timerEl = $('quiz-timer');
    timerEl.classList.toggle('hidden', !time);
    const started = performance.now();
    const tick = () => {
      if (!time || picked !== null) return;
      const pl = this.lang === 'pl';
      const el = (performance.now() - started) / 1000;
      const reading = el < time.read;
      const total = reading ? time.read : time.answer;
      const left = Math.max(0, reading ? time.read - el : time.read + time.answer - el);
      $('quiz-timer-bar').style.width = `${(left / total) * 100}%`;
      $('quiz-timer-text').textContent = `${reading ? (pl ? 'Czytanie pytania' : 'Читання питання') : (pl ? 'Czas na odpowiedź' : 'Час на відповідь')}: ${Math.ceil(left)} ${pl ? 's' : 'с'}`;
      timerEl.classList.toggle('reading', reading);
      timerEl.classList.toggle('urgent', !reading && left <= 5);
      if (!reading && left <= 0) finish(-1);
    };
    if (time) this.quizTimer = window.setInterval(tick, 100);
    render();
    tick();

    $('btn-continue').onclick = () => {
      clearInterval(this.quizTimer);
      this.show('screen-quiz', false);
      onContinue();
    };
    this.show('screen-quiz');
  }

  finish(o: {
    icon: string;
    title: string;
    score: number;
    correct: number;
    total: number;
    extra?: string;
    mistakes: Mistake[];
    violations: string[];
    hasNext: boolean;
    /** бали за іспитовою шкалою (1–3 за питання) */
    exam?: { got: number; max: number };
  }) {
    $('finish-icon').textContent = o.icon;
    $('finish-title').textContent = o.title;
    const pct = o.total ? Math.round((o.correct / o.total) * 100) : 100;
    let verdict = pct >= 90 ? 'Готовий до іспиту! 🎉' : pct >= 70 ? 'Непогано, але є що підтягнути' : 'Варто проїхати ще раз';
    if (o.exam && o.exam.max) {
      // на іспиті WORD: 32 питання, максимум 74 бали, щоб скласти — щонайменше 68 (≈ 92 %)
      const ep = o.exam.got / o.exam.max;
      verdict = `Іспитові бали: ${o.exam.got} з ${o.exam.max} (${Math.round(ep * 100)}%). `
        + (ep >= 68 / 74 ? 'Такий результат на WORD — «zdany» 🎉' : 'На WORD потрібно ≥ 68 з 74 (≈ 92%) — ще потренуйся');
    }
    $('result').innerHTML = `<b>${o.score} ⭐</b>Правильних відповідей: ${o.correct} з ${o.total} (${pct}%)<br>${o.extra ? `${o.extra}<br>` : ''}${verdict}`;

    const list = $('mistakes');
    list.innerHTML = '';
    const add = (title: string, body: string) => {
      const d = document.createElement('div');
      d.className = 'mistake';
      const b = document.createElement('b');
      b.textContent = title;
      d.append(b, body);
      list.appendChild(d);
    };
    for (const m of o.mistakes) {
      const yours = m.picked < 0 ? 'час вийшов без відповіді' : `а не «${m.q.ua.options[m.picked]}»`;
      add(`№ ${m.q.num}: ${m.q.ua.text}`, `Правильно: «${m.q.ua.options[m.q.correct]}», ${yours}. 📖 ${m.q.law}`);
    }
    for (const v of o.violations) add('Порушення під час руху', v);
    const hint = document.createElement('p');
    hint.className = 'sub';
    hint.textContent = !o.mistakes.length && !o.violations.length
      ? 'Жодної помилки й порушення! Наступна поїздка буде з іншими питаннями.'
      : 'Наступна поїздка буде з іншими питаннями.';
    list.appendChild(hint);
    this.show('btn-next', o.hasNext);
    this.show('screen-finish');
  }
}
