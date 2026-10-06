/** Рівень якості рендеру. */
export interface Tier {
  /** pixel ratio */
  ratio: number;
  /** розмір карти тіней; 0 — без тіней */
  shadows: number;
  /** обробка кадру: м'які контактні тіні (AO), згладжування MSAA, світіння ліхтарів уночі */
  post: boolean;
}

/** Налаштування графіки: auto — під силу пристрою, решта — фіксований рівень. */
export type Preset = 'auto' | 'ultra' | 'high' | 'medium' | 'low';
export const PRESETS: Preset[] = ['auto', 'ultra', 'high', 'medium', 'low'];
export const PRESET_NAME: Record<Preset, string> = { auto: 'Авто', ultra: 'Ультра', high: 'Висока', medium: 'Середня', low: 'Низька' };

/** Як назвати рівень, на якому зараз «Авто». */
export function tierName(t: Tier): Exclude<Preset, 'auto'> {
  if (t.post) return 'ultra';
  if (!t.shadows) return 'low';
  return t.shadows >= 2048 ? 'high' : 'medium';
}

/** Нижче цього FPS — знижуємо якість; від цього й вище кілька секунд поспіль — підвищуємо. */
const FPS_LOW = 45;
const FPS_OK = 55;
/** скільки секунд поспіль має бути плавно, щоб підняти якість */
const CALM_SECONDS = 4;

/**
 * Якість рендеру. «Авто» — динамічна під силу пристрою: щосекунди рахуємо FPS, кадри не встигають — крок униз
 * (без обробки кадру → менша роздільність → без тіней); кілька секунд стабільно плавно — крок угору.
 * Якщо щойно піднята якість знову просіла, вище вже не піднімаємось — без «гойдалки» туди-сюди.
 * На ПК «Авто» починає з «Ультра», на телефоні — з роздільності 1.5 (обробка кадру там завелика).
 */
export class AdaptiveQuality {
  private tiers: Tier[] = [];
  private fixed: Record<Exclude<Preset, 'auto'>, Tier>;
  private i = 0;
  /** найкращий і найгірший дозволені рівні (менший індекс — краща якість) */
  private best = 0;
  private worst = 0;
  /** рівень і FPS перед останнім кроком униз — щоб перевірити, чи він допоміг */
  private dropped: { from: number; fps: number } | null = null;
  private time = 0;
  private frames = 0;
  private calm = 0;
  private sinceUp = Infinity;
  private skip = 0;
  /** останній виміряний FPS (для паузи) */
  fps = 0;

  constructor(dpr: number, private phone: boolean, public preset: Preset) {
    const max = Math.min(dpr, 2);
    const shadows = phone ? 1024 : 2048;
    this.fixed = {
      // ультра малює в 1.5 раза більшій роздільності, ніж екран (суперсемплінг): чіткіші краї й написи на знаках
      ultra: { ratio: Math.min(2, Math.max(dpr, 1) * 1.5), shadows: 4096, post: true },
      high: { ratio: max, shadows: 2048, post: false },
      medium: { ratio: Math.min(max, 1.25), shadows: 1024, post: false },
      low: { ratio: 1, shadows: 0, post: false },
    };
    const ratios = [2, 1.75, 1.5, 1.25, 1].filter((r) => r <= max);
    if (!ratios.length || ratios[0] < max) ratios.unshift(max);
    this.tiers = [
      ...(phone ? [] : [this.fixed.ultra]),
      ...ratios.map((ratio) => ({ ratio, shadows, post: false })),
      { ratio: ratios[ratios.length - 1], shadows: 0, post: false },
    ];
    this.setPreset(preset);
  }

  get tier(): Tier {
    return this.preset === 'auto' ? this.tiers[this.i] : this.fixed[this.preset];
  }

  /** Змінити налаштування; повертає рівень, який треба застосувати. */
  setPreset(p: Preset): Tier {
    this.preset = p;
    this.best = 0;
    this.worst = this.tiers.length - 1;
    this.dropped = null;
    this.calm = 0;
    this.i = this.phone ? Math.max(0, this.tiers.findIndex((t) => t.ratio <= 1.5)) : 0;
    this.hold();
    return this.tier;
  }

  /** Не міряти найближчий час: завантаження рівня, компіляція шейдерів, щойно змінена якість. */
  hold(seconds = 2) {
    this.skip = seconds;
    this.time = this.frames = 0;
  }

  /** Викликати щокадру з реальним (не обрізаним) dt. Повертає новий рівень, якщо його треба застосувати. */
  update(dt: number): Tier | null {
    this.sinceUp += dt;
    // вкладку ховали або браузер підвис — цей проміжок не показовий
    if (dt > 0.25) {
      this.hold(1);
      return null;
    }
    if (this.skip > 0) {
      this.skip -= dt;
      return null;
    }
    this.time += dt;
    this.frames++;
    if (this.time < 1) return null;
    const fps = this.frames / this.time;
    this.fps = fps;
    this.time = this.frames = 0;
    // фіксований рівень — лише міряємо FPS
    if (this.preset !== 'auto') return null;

    const dropped = this.dropped;
    this.dropped = null;
    if (dropped && fps < dropped.fps * 1.05) {
      // менша якість не додала FPS — гальмує не відеокарта (напр., енергозбереження тримає 30 FPS):
      // повертаємо якість і нижче вже не йдемо
      this.worst = dropped.from;
      return this.go(dropped.from);
    }
    if (fps < FPS_LOW && this.i < this.worst) {
      // щойно підняли якість — і знову не тягне: цей рівень для пристрою заважкий
      if (this.sinceUp < 5) this.best = this.i + 1;
      this.calm = 0;
      this.dropped = { from: this.i, fps };
      return this.go(this.i + 1);
    }
    this.calm = fps >= FPS_OK ? this.calm + 1 : 0;
    if (this.calm >= CALM_SECONDS && this.i > this.best) {
      this.calm = 0;
      this.sinceUp = 0;
      return this.go(this.i - 1);
    }
    return null;
  }

  private go(i: number) {
    this.i = i;
    this.hold(1);
    return this.tiers[i];
  }
}
