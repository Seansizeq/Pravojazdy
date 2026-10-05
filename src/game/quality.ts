/** Рівень якості рендеру: роздільність (pixel ratio) і чи малювати тіні. */
export interface Tier {
  ratio: number;
  shadows: boolean;
}

/** Нижче цього FPS — знижуємо якість; від цього й вище кілька секунд поспіль — підвищуємо. */
const FPS_LOW = 45;
const FPS_OK = 55;
/** скільки секунд поспіль має бути плавно, щоб підняти якість */
const CALM_SECONDS = 4;

/**
 * Динамічна якість під силу пристрою. Щосекунди рахуємо FPS: кадри не встигають — крок униз
 * (менша роздільність, а в крайньому разі ще й без тіней); кілька секунд стабільно плавно — крок угору.
 * Якщо щойно піднята якість знову просіла, вище вже не піднімаємось — без «гойдалки» туди-сюди.
 */
export class AdaptiveQuality {
  readonly tiers: Tier[];
  private i: number;
  /** найкращий і найгірший дозволені рівні (менший індекс — краща якість) */
  private best = 0;
  private worst: number;
  /** рівень і FPS перед останнім кроком униз — щоб перевірити, чи він допоміг */
  private dropped: { from: number; fps: number } | null = null;
  private time = 0;
  private frames = 0;
  private calm = 0;
  private sinceUp = Infinity;
  private skip = 0;

  constructor(dpr: number, phone: boolean) {
    const max = Math.min(dpr, 2);
    const ratios = [2, 1.75, 1.5, 1.25, 1].filter((r) => r <= max);
    if (!ratios.length || ratios[0] < max) ratios.unshift(max);
    this.tiers = [...ratios.map((ratio) => ({ ratio, shadows: true })), { ratio: ratios[ratios.length - 1], shadows: false }];
    this.worst = this.tiers.length - 1;
    // телефон починає з 1.5 (як і раніше), а далі сам підлаштовується вгору чи вниз
    this.i = phone ? Math.max(0, this.tiers.findIndex((t) => t.ratio <= 1.5)) : 0;
  }

  get tier() {
    return this.tiers[this.i];
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
    this.time = this.frames = 0;

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
