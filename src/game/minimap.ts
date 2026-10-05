import type { Cell } from '../types';
import { TILE, type RoadGrid } from '../world/build';

/** Міні-карта в кутку: дороги, маршрут, ціль, своє авто й машини трафіку. */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private scale = 1;
  private ox = 0;
  private oy = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setGrid(grid: RoadGrid) {
    const { cols, rows } = grid.level;
    const size = this.canvas.width;
    this.scale = (size - 8) / Math.max(cols, rows);
    this.ox = (size - cols * this.scale) / 2;
    this.oy = (size - rows * this.scale) / 2;
    this.base.width = this.base.height = size;
    const b = this.base.getContext('2d')!;
    b.clearRect(0, 0, size, size);
    b.fillStyle = 'rgba(255, 250, 242, 0.92)';
    b.beginPath();
    b.roundRect(0, 0, size, size, 14);
    b.fill();
    b.fillStyle = '#6b5e57';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid.isRoad(c, r)) continue;
        b.fillRect(this.ox + c * this.scale - 0.3, this.oy + r * this.scale - 0.3, this.scale + 0.6, this.scale + 0.6);
        if (grid.isRoundabout(c, r)) {
          b.fillStyle = '#86b86a';
          b.beginPath();
          b.arc(this.ox + (c + 0.5) * this.scale, this.oy + (r + 0.5) * this.scale, this.scale * 0.22, 0, Math.PI * 2);
          b.fill();
          b.fillStyle = '#6b5e57';
        }
      }
    }
  }

  private px(x: number) {
    return this.ox + (x / TILE) * this.scale;
  }
  private py(z: number) {
    return this.oy + (z / TILE) * this.scale;
  }

  draw(
    car: { x: number; z: number; heading: number },
    route: Cell[],
    progress: number,
    target: Cell | null,
    others: { x: number; z: number }[],
    t: number,
  ) {
    const { ctx } = this;
    const size = this.canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this.base, 0, 0);

    if (route.length > 1) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = Math.max(2, this.scale * 0.35);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      route.slice(progress).forEach(([c, r], i) => {
        const x = this.ox + (c + 0.5) * this.scale, y = this.oy + (r + 0.5) * this.scale;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }

    ctx.fillStyle = '#f2f2f2';
    for (const o of others) {
      ctx.beginPath();
      ctx.arc(this.px(o.x), this.py(o.z), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (target) {
      const pulse = 3 + Math.sin(t * 6) * 1.2;
      ctx.fillStyle = '#e5484d';
      ctx.beginPath();
      ctx.arc(this.ox + (target[0] + 0.5) * this.scale, this.oy + (target[1] + 0.5) * this.scale, pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // своє авто — трикутник у напрямку руху
    ctx.save();
    ctx.translate(this.px(car.x), this.py(car.z));
    ctx.rotate(-car.heading);
    ctx.fillStyle = '#ffc83d';
    ctx.strokeStyle = '#2b2420';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
