import type * as THREE from 'three';
import type { Cell, Dir } from '../types';
import { cellCenter, dirBetween, sameCell, type RoadGrid } from '../world/build';
import { relTurn, rondoExit, type Turn } from '../world/paths';

export type { Turn };

export type Maneuver =
  | { kind: 'turn'; turn: Turn; dist: number }
  | { kind: 'rondo'; exit: number; dist: number }
  | { kind: 'finish'; dist: number };

/** Маршрут: прогрес і підказки про наступний маневр (показуються вгорі екрана). */
export class Navigator {
  progress = 0;
  offRoute = false;
  route: Cell[] = [];
  dirs: Dir[] = [];
  constructor(private grid: RoadGrid) {}

  get active() {
    return this.route.length >= 2;
  }

  get finished() {
    return this.active && this.progress >= this.route.length - 1;
  }

  get ratio() {
    return this.active ? this.progress / (this.route.length - 1) : 0;
  }

  /** Довжина решти маршруту в метрах (приблизно, по клітинках). */
  get remaining() {
    return Math.max(0, this.route.length - 1 - this.progress) * 20;
  }

  setRoute(route: Cell[] | null) {
    this.route = route ?? [];
    this.progress = 0;
    this.offRoute = false;
    this.dirs = this.route.slice(0, -1).map((c, i) => dirBetween(c, this.route[i + 1]));
  }

  /** Оновити прогрес за клітинкою, де зараз авто. */
  update(cell: Cell) {
    if (!this.active) {
      this.offRoute = false;
      return;
    }
    for (let k = this.progress + 1; k <= Math.min(this.progress + 3, this.route.length - 1); k++) {
      if (sameCell(cell, this.route[k])) {
        this.progress = k;
        break;
      }
    }
    this.offRoute = !this.route
      .slice(Math.max(0, this.progress - 1), this.progress + 2)
      .some((c) => sameCell(c, cell));

  }

  /** Наступний маневр і відстань до нього в метрах. */
  nextManeuver(carPos: THREE.Vector3): Maneuver {
    const dist = (cell: Cell) => {
      const p = cellCenter(cell);
      return Math.abs(p.x - carPos.x) + Math.abs(p.z - carPos.z);
    };
    for (let j = this.progress; j < this.dirs.length; j++) {
      const cell = this.route[j];
      const inDir = j > 0 ? this.dirs[j - 1] : this.dirs[0];
      const outDir = this.dirs[j];
      if (this.grid.isRoundabout(cell[0], cell[1])) {
        return { kind: 'rondo', exit: rondoExit(this.grid, cell, inDir, outDir), dist: dist(cell) };
      }
      if (j > this.progress && inDir !== outDir) {
        return { kind: 'turn', turn: relTurn(inDir, outDir), dist: dist(cell) };
      }
    }
    return { kind: 'finish', dist: dist(this.route[this.route.length - 1]) };
  }
}
