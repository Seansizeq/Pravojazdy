/** Клавіатура + сенсорні кнопки → єдиний стан керування. */
export class Input {
  gas = false;
  brake = false;
  left = false;
  right = false;
  enabled = true;

  private keys = new Set<string>();
  private touch = { gas: false, brake: false, left: false, right: false };

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.keys.add(e.code);
      this.sync();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.sync();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touch = { gas: false, brake: false, left: false, right: false };
      this.sync();
    });

    this.bindButton('ctl-gas', 'gas');
    this.bindButton('ctl-brake', 'brake');
    this.bindButton('ctl-left', 'left');
    this.bindButton('ctl-right', 'right');
  }

  private bindButton(id: string, key: 'gas' | 'brake' | 'left' | 'right') {
    const el = document.getElementById(id)!;
    const set = (v: boolean) => (e: Event) => {
      e.preventDefault();
      this.touch[key] = v;
      el.classList.toggle('active', v);
      this.sync();
    };
    el.addEventListener('pointerdown', (e) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* деякі браузери не дають захопити дотик — кнопка все одно працює */
      }
      set(true)(e);
    });
    el.addEventListener('pointerup', set(false));
    el.addEventListener('pointercancel', set(false));
    el.addEventListener('lostpointercapture', set(false));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private sync() {
    const k = (...codes: string[]) => codes.some((c) => this.keys.has(c));
    this.gas = this.touch.gas || k('ArrowUp', 'KeyW');
    this.brake = this.touch.brake || k('ArrowDown', 'KeyS', 'Space');
    this.left = this.touch.left || k('ArrowLeft', 'KeyA');
    this.right = this.touch.right || k('ArrowRight', 'KeyD');
  }

  get steer() {
    if (!this.enabled) return 0;
    return (this.left ? 1 : 0) - (this.right ? 1 : 0);
  }
}
