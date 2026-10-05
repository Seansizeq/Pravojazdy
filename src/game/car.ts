import * as THREE from 'three';
import type { RoadGrid } from '../world/build';
import { makeCar } from '../world/models';

const MAX_REV = 5;
const ACCEL = 3.4; // м/с² на старті; ~5 с до 50 км/год
const BRAKE = 10;
const COAST = 1.6;
const STEER_RATE = 1.7; // рад/с на повному кермі
const RADIUS = 1.2;

/** Керування: клавіатура/кнопки (Input) або автопілот. steer: +1 — ліворуч, -1 — праворуч. */
export interface Controls {
  enabled: boolean;
  gas: boolean;
  brake: boolean;
  readonly steer: number;
}

/** Аркадна модель авто. heading = 0 → рух у напрямку -Z (північ). */
export class Car {
  obj: THREE.Group;
  pos = new THREE.Vector3();
  heading = 0;
  speed = 0;
  /** максимальна швидкість, м/с (60 км/год у місті; на трасі рівень задає більшу) */
  maxFwd = 16.7;
  private steer = 0;
  private body: THREE.Object3D;

  constructor() {
    this.obj = new THREE.Group();
    this.body = makeCar(0xc8d43a, { rack: true });
    this.obj.add(this.body);
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
  }

  get kmh() {
    return Math.abs(this.speed) * 3.6;
  }

  place(pos: THREE.Vector3, heading: number) {
    this.pos.copy(pos);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.sync();
  }

  /** Повертає true, якщо авто вдарилося об бордюр. */
  update(dt: number, input: Controls, grid: RoadGrid) {
    const gas = input.enabled && input.gas;
    const brake = input.enabled && input.brake;

    if (gas) {
      if (this.speed < 0) this.speed += BRAKE * dt;
      // що вища швидкість, то повільніше розгін (як у справжнього авто)
      else this.speed += ACCEL * (1 - 0.75 * (this.speed / this.maxFwd) ** 2) * Math.max(1, this.maxFwd / 25) * dt;
    } else if (brake) {
      if (this.speed > 0.3) this.speed -= BRAKE * dt;
      else this.speed -= ACCEL * 0.5 * dt; // задній хід
    } else {
      const d = COAST * dt;
      this.speed = Math.abs(this.speed) <= d ? 0 : this.speed - Math.sign(this.speed) * d;
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -MAX_REV, this.maxFwd);

    // плавне кермо
    this.steer = THREE.MathUtils.damp(this.steer, input.steer, 10, dt);
    const grip = Math.min(1, Math.abs(this.speed) / 4);
    // на великій швидкості кермо м'якше, щоб на трасі можна було тримати смугу
    const soft = Math.min(1, Math.sqrt(20 / Math.max(Math.abs(this.speed), 1)));
    this.heading += this.steer * STEER_RATE * grip * soft * Math.sign(this.speed) * dt;

    const prev = this.pos.clone();
    this.pos.addScaledVector(this.forward, this.speed * dt);

    const res = grid.constrain(this.pos, RADIUS);
    let hit = false;
    if (res === 'blocked') {
      this.pos.copy(prev);
      this.speed *= -0.2;
      hit = true;
    } else if (res === 'pushed') {
      this.speed *= 1 - 2.5 * dt;
      hit = Math.abs(this.speed) > 4;
    }

    this.sync();
    // нахил кузова в поворотах
    this.body.rotation.z = -this.steer * grip * 0.06 * Math.sign(this.speed || 1);
    this.body.rotation.x = (gas ? -0.015 : 0) + (brake && this.speed > 1 ? 0.03 : 0);
    return hit;
  }

  sync() {
    this.obj.position.copy(this.pos);
    this.obj.rotation.y = this.heading;
  }
}
