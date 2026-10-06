import * as THREE from 'three';
import type { SignType } from '../types';
import { mat } from './models';

const RED = '#d0262c';
const BLUE = '#1f5fbf';
const YELLOW = '#ffc61a';
const INK = '#1b1b1b';

type Ctx = CanvasRenderingContext2D;

function circle(ctx: Ctx, s: number, fill: string, ring: string | null) {
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2);
  ctx.fillStyle = ring ?? fill;
  ctx.fill();
  if (ring) {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function triangle(ctx: Ctx, s: number, inverted: boolean, fill = '#fff') {
  const pts = inverted
    ? [[0.04, 0.12], [0.96, 0.12], [0.5, 0.92]]
    : [[0.5, 0.06], [0.96, 0.86], [0.04, 0.86]];
  const inner = inverted
    ? [[0.2, 0.21], [0.8, 0.21], [0.5, 0.73]]
    : [[0.5, 0.25], [0.8, 0.77], [0.2, 0.77]];
  const poly = (p: number[][], color: string) => {
    ctx.beginPath();
    p.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = s * 0.04;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  };
  poly(pts, RED);
  poly(inner, fill);
}

function text(ctx: Ctx, s: number, t: string, size: number, color: string, y = 0.5) {
  ctx.fillStyle = color;
  ctx.font = `900 ${size * s}px Nunito, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, s / 2, s * y);
}

function person(ctx: Ctx, x: number, y: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.42, h * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = h * 0.12;
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.28);
  ctx.lineTo(x, y + h * 0.05);
  ctx.moveTo(x, y + h * 0.05);
  ctx.lineTo(x - h * 0.15, y + h * 0.4);
  ctx.moveTo(x, y + h * 0.05);
  ctx.lineTo(x + h * 0.15, y + h * 0.4);
  ctx.moveTo(x - h * 0.17, y - h * 0.08);
  ctx.lineTo(x, y - h * 0.22);
  ctx.lineTo(x + h * 0.17, y - h * 0.08);
  ctx.stroke();
}

function carIcon(ctx: Ctx, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - w * 0.18, w, w * 0.36, w * 0.08);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - w * 0.3, y - w * 0.42, w * 0.6, w * 0.3, w * 0.1);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x - w * 0.28, y + w * 0.2, w * 0.1, 0, Math.PI * 2);
  ctx.arc(x + w * 0.28, y + w * 0.2, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

/** Жовтий трикутник із червоною облямівкою (польські знаки ostrzegawcze) + чорний олівець для піктограми. */
function warn(ctx: Ctx, s: number) {
  triangle(ctx, s, false, YELLOW);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Товста лінія через точки (одиничні координати) з плавними вигинами і вістрям у кінці. */
function arrow(ctx: Ctx, s: number, pts: number[][], w = 0.06) {
  ctx.lineWidth = s * w;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    ctx.quadraticCurveTo(x * s, y * s, ((x + nx) / 2) * s, ((y + ny) / 2) * s);
  }
  const [lx, ly] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2];
  const a = Math.atan2(ly - py, lx - px);
  // лінія закінчується трохи раніше, далі — вістря
  ctx.lineTo((lx - Math.cos(a) * 0.04) * s, (ly - Math.sin(a) * 0.04) * s);
  ctx.stroke();
  const L = 0.11, W = 0.075;
  ctx.beginPath();
  ctx.moveTo((lx + Math.cos(a) * L * 0.5) * s, (ly + Math.sin(a) * L * 0.5) * s);
  ctx.lineTo((lx - Math.cos(a) * L * 0.5 + Math.cos(a + Math.PI / 2) * W) * s, (ly - Math.sin(a) * L * 0.5 + Math.sin(a + Math.PI / 2) * W) * s);
  ctx.lineTo((lx - Math.cos(a) * L * 0.5 - Math.cos(a + Math.PI / 2) * W) * s, (ly - Math.sin(a) * L * 0.5 - Math.sin(a + Math.PI / 2) * W) * s);
  ctx.closePath();
  ctx.fill();
}

/** Три стрілки по колу проти годинникової стрілки (C-12, A-8). */
function rondoArrows(ctx: Ctx, s: number, cx: number, cy: number, R: number, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.07 * (R / (s * 0.24));
  for (let i = 0; i < 3; i++) {
    const a0 = (i * 2 * Math.PI) / 3 + 0.35;
    const a1 = a0 + 1.45;
    ctx.beginPath();
    ctx.arc(cx, cy, R, -a0, -a1, true);
    ctx.stroke();
    const ex = cx + Math.cos(-a1) * R, ey = cy + Math.sin(-a1) * R;
    const tx = Math.sin(-a1), ty = -Math.cos(-a1);
    const nx = Math.cos(-a1), ny = Math.sin(-a1);
    const L = R * 0.37, Wd = R * 0.33;
    ctx.beginPath();
    ctx.moveTo(ex + tx * L, ey + ty * L);
    ctx.lineTo(ex + nx * Wd, ey + ny * Wd);
    ctx.lineTo(ex - nx * Wd, ey - ny * Wd);
    ctx.closePath();
    ctx.fill();
  }
}

/** Синій прямокутний знак (informacyjny). */
function blueSquare(ctx: Ctx, s: number) {
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.roundRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.06);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.roundRect(s * 0.09, s * 0.09, s * 0.82, s * 0.82, s * 0.05);
  ctx.stroke();
}

function bicycle(ctx: Ctx, cx: number, cy: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w * 0.07;
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(cx + dx * w, cy + w * 0.12, w * 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.3, cy + w * 0.12);
  ctx.lineTo(cx - w * 0.05, cy - w * 0.12);
  ctx.lineTo(cx + w * 0.22, cy - w * 0.12);
  ctx.lineTo(cx + w * 0.3, cy + w * 0.12);
  ctx.moveTo(cx - w * 0.05, cy - w * 0.12);
  ctx.lineTo(cx + w * 0.02, cy + w * 0.12);
  ctx.lineTo(cx + w * 0.22, cy - w * 0.12);
  ctx.stroke();
  // велосипедист
  ctx.beginPath();
  ctx.arc(cx + w * 0.08, cy - w * 0.5, w * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.05, cy - w * 0.38);
  ctx.lineTo(cx - w * 0.05, cy - w * 0.14);
  ctx.moveTo(cx + w * 0.04, cy - w * 0.32);
  ctx.lineTo(cx + w * 0.2, cy - w * 0.18);
  ctx.stroke();
}

/** Стовпчик G-1: біла смуга з червоними скісними кресками (3, 2 або 1). */
function railPost(ctx: Ctx, s: number, n: number) {
  const x = s * 0.36, w = s * 0.28, y = s * 0.04, h = s * 0.92;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = s * 0.012;
  ctx.strokeRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = RED;
  for (let i = 0; i < n; i++) {
    const cy = y + h * (0.2 + i * 0.28);
    ctx.beginPath();
    ctx.moveTo(x, cy + w * 0.35);
    ctx.lineTo(x + w, cy - w * 0.35);
    ctx.lineTo(x + w, cy - w * 0.35 + h * 0.11);
    ctx.lineTo(x, cy + w * 0.35 + h * 0.11);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Малює знак на canvas 2D (прозорий фон). */
export function drawSign(ctx: Ctx, s: number, type: SignType) {
  ctx.clearRect(0, 0, s, s);
  switch (type) {
    case 'A-1':
    case 'A-2': {
      warn(ctx, s);
      const m = (x: number) => (type === 'A-2' ? 1 - x : x);
      arrow(ctx, s, [[m(0.44), 0.76], [m(0.44), 0.5], [m(0.64), 0.47]]);
      break;
    }
    case 'A-3':
    case 'A-4': {
      warn(ctx, s);
      const m = (x: number) => (type === 'A-4' ? 1 - x : x);
      arrow(ctx, s, [[m(0.44), 0.77], [m(0.44), 0.66], [m(0.58), 0.6], [m(0.58), 0.46], [m(0.46), 0.4]], 0.05);
      break;
    }
    case 'A-5':
      warn(ctx, s);
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(s * 0.38, s * 0.46);
      ctx.lineTo(s * 0.62, s * 0.72);
      ctx.moveTo(s * 0.62, s * 0.46);
      ctx.lineTo(s * 0.38, s * 0.72);
      ctx.stroke();
      break;
    case 'A-6a':
      warn(ctx, s);
      ctx.fillRect(s * 0.455, s * 0.4, s * 0.09, s * 0.36);
      ctx.fillRect(s * 0.33, s * 0.565, s * 0.34, s * 0.045);
      break;
    case 'A-6b':
    case 'A-6c': {
      // skrzyżowanie z drogą podporządkowaną po prawej (b) / po lewej (c) stronie
      warn(ctx, s);
      ctx.fillRect(s * 0.455, s * 0.4, s * 0.09, s * 0.36);
      const right = type === 'A-6b';
      ctx.fillRect(right ? s * 0.5 : s * 0.33, s * 0.565, s * 0.17, s * 0.045);
      break;
    }
    case 'A-6d': {
      // wlot drogi jednokierunkowej z prawej strony — тонка дорога вливається навскоси
      warn(ctx, s);
      ctx.fillRect(s * 0.43, s * 0.4, s * 0.09, s * 0.36);
      ctx.lineWidth = s * 0.045;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(s * 0.66, s * 0.74);
      ctx.lineTo(s * 0.52, s * 0.54);
      ctx.stroke();
      break;
    }
    case 'A-7':
      triangle(ctx, s, true, YELLOW);
      break;
    case 'A-8':
      warn(ctx, s);
      rondoArrows(ctx, s, s * 0.5, s * 0.6, s * 0.13, INK);
      break;
    case 'A-9': {
      // przejazd kolejowy z zaporami — «паркан»
      warn(ctx, s);
      ctx.fillRect(s * 0.33, s * 0.52, s * 0.34, s * 0.04);
      ctx.fillRect(s * 0.33, s * 0.64, s * 0.34, s * 0.04);
      for (let i = 0; i < 5; i++) ctx.fillRect(s * (0.34 + i * 0.07), s * 0.45, s * 0.035, s * 0.3);
      break;
    }
    case 'A-10': {
      // przejazd kolejowy bez zapór — паротяг
      warn(ctx, s);
      ctx.fillRect(s * 0.32, s * 0.56, s * 0.36, s * 0.12); // котел
      ctx.fillRect(s * 0.54, s * 0.45, s * 0.14, s * 0.13); // будка
      ctx.fillRect(s * 0.36, s * 0.47, s * 0.05, s * 0.09); // труба
      for (const x of [0.38, 0.5, 0.62]) {
        ctx.beginPath();
        ctx.arc(s * x, s * 0.71, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'A-11':
    case 'A-11a': {
      warn(ctx, s);
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.72);
      if (type === 'A-11') {
        ctx.quadraticCurveTo(s * 0.38, s * 0.56, s * 0.46, s * 0.72);
        ctx.quadraticCurveTo(s * 0.54, s * 0.56, s * 0.62, s * 0.72);
        ctx.lineTo(s * 0.7, s * 0.72);
      } else {
        ctx.lineTo(s * 0.38, s * 0.72);
        ctx.quadraticCurveTo(s * 0.5, s * 0.52, s * 0.62, s * 0.72);
        ctx.lineTo(s * 0.7, s * 0.72);
      }
      ctx.lineTo(s * 0.7, s * 0.76);
      ctx.lineTo(s * 0.3, s * 0.76);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'A-12a':
      warn(ctx, s);
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(s * 0.38, s * 0.76);
      ctx.lineTo(s * 0.38, s * 0.66);
      ctx.lineTo(s * 0.45, s * 0.56);
      ctx.lineTo(s * 0.45, s * 0.42);
      ctx.moveTo(s * 0.62, s * 0.76);
      ctx.lineTo(s * 0.62, s * 0.66);
      ctx.lineTo(s * 0.55, s * 0.56);
      ctx.lineTo(s * 0.55, s * 0.42);
      ctx.stroke();
      break;
    case 'A-14':
      // roboty na drodze — робітник з лопатою і купа
      warn(ctx, s);
      person(ctx, s * 0.44, s * 0.6, s * 0.26, INK);
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.55);
      ctx.lineTo(s * 0.6, s * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.56, s * 0.76);
      ctx.quadraticCurveTo(s * 0.64, s * 0.62, s * 0.72, s * 0.76);
      ctx.fill();
      break;
    case 'A-16':
      warn(ctx, s);
      person(ctx, s * 0.5, s * 0.62, s * 0.3, INK);
      break;
    case 'A-18b': {
      // zwierzęta dzikie — силует оленя в стрибку
      warn(ctx, s);
      const P = (pts: number[][]) => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
        ctx.closePath();
        ctx.fill();
      };
      // тулуб, шия й голова
      P([[0.36, 0.62], [0.42, 0.57], [0.56, 0.55], [0.6, 0.5], [0.62, 0.44], [0.66, 0.43], [0.68, 0.46],
        [0.64, 0.49], [0.62, 0.57], [0.58, 0.62], [0.44, 0.65]]);
      ctx.lineWidth = s * 0.028;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // передні ноги вперед, задні — назад (стрибок)
      ctx.moveTo(s * 0.57, s * 0.6); ctx.lineTo(s * 0.66, s * 0.66);
      ctx.moveTo(s * 0.55, s * 0.61); ctx.lineTo(s * 0.62, s * 0.7);
      ctx.moveTo(s * 0.4, s * 0.62); ctx.lineTo(s * 0.32, s * 0.7);
      ctx.moveTo(s * 0.43, s * 0.63); ctx.lineTo(s * 0.37, s * 0.73);
      // роги
      ctx.moveTo(s * 0.63, s * 0.44); ctx.lineTo(s * 0.6, s * 0.38);
      ctx.moveTo(s * 0.61, s * 0.4); ctx.lineTo(s * 0.57, s * 0.39);
      ctx.moveTo(s * 0.65, s * 0.43); ctx.lineTo(s * 0.66, s * 0.37);
      ctx.stroke();
      break;
    }
    case 'A-18a': {
      // zwierzęta gospodarskie — корова
      warn(ctx, s);
      ctx.beginPath();
      ctx.roundRect(s * 0.34, s * 0.55, s * 0.28, s * 0.12, s * 0.03);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(s * 0.6, s * 0.52, s * 0.09, s * 0.08, s * 0.02);
      ctx.fill();
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      for (const x of [0.37, 0.42, 0.54, 0.59]) {
        ctx.moveTo(s * x, s * 0.66);
        ctx.lineTo(s * x, s * 0.75);
      }
      ctx.moveTo(s * 0.62, s * 0.52);
      ctx.lineTo(s * 0.61, s * 0.48);
      ctx.moveTo(s * 0.67, s * 0.52);
      ctx.lineTo(s * 0.69, s * 0.48);
      ctx.moveTo(s * 0.34, s * 0.57);
      ctx.lineTo(s * 0.3, s * 0.66);
      ctx.stroke();
      break;
    }
    case 'A-20':
      // odcinek jezdni o ruchu dwukierunkowym — стрілки вгору й униз
      warn(ctx, s);
      arrow(ctx, s, [[0.43, 0.76], [0.43, 0.6], [0.43, 0.44]], 0.05);
      arrow(ctx, s, [[0.57, 0.42], [0.57, 0.58], [0.57, 0.74]], 0.05);
      break;
    case 'A-22':
    case 'A-23': {
      // niebezpieczny spadek (22) / stromy podjazd (23) — схил з авто
      warn(ctx, s);
      const up = type === 'A-23';
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.76);
      ctx.lineTo(s * 0.7, s * 0.76);
      ctx.lineTo(up ? s * 0.7 : s * 0.3, s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.translate(s * 0.5, s * 0.58);
      ctx.rotate(up ? -0.58 : 0.58);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-s * 0.09, -s * 0.06, s * 0.18, s * 0.05);
      ctx.restore();
      break;
    }
    case 'A-25': {
      // spadające odłamki skalne — скеля праворуч і каміння, що падає
      warn(ctx, s);
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.4);
      ctx.lineTo(s * 0.72, s * 0.76);
      ctx.lineTo(s * 0.5, s * 0.76);
      ctx.closePath();
      ctx.fill();
      for (const [x, y, r] of [[0.4, 0.5, 0.035], [0.34, 0.62, 0.03], [0.42, 0.7, 0.04]]) {
        ctx.beginPath();
        ctx.arc(s * x, s * y, s * r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'A-28': {
      // sypki żwir — авто й камінці з-під коліс
      warn(ctx, s);
      carIcon(ctx, s * 0.44, s * 0.66, s * 0.22, INK);
      for (const [x, y] of [[0.6, 0.6], [0.66, 0.66], [0.62, 0.72], [0.7, 0.58], [0.68, 0.74]]) {
        ctx.beginPath();
        ctx.arc(s * x, s * y, s * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'A-19': {
      // boczny wiatr — рукав на щоглі
      warn(ctx, s);
      ctx.fillRect(s * 0.36, s * 0.46, s * 0.025, s * 0.3);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : INK;
        ctx.beginPath();
        const x0 = 0.39 + i * 0.065;
        ctx.moveTo(s * x0, s * (0.47 + i * 0.008));
        ctx.lineTo(s * (x0 + 0.065), s * (0.475 + (i + 1) * 0.008));
        ctx.lineTo(s * (x0 + 0.065), s * (0.555 - (i + 1) * 0.008));
        ctx.lineTo(s * x0, s * (0.56 - i * 0.008));
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'A-24':
      warn(ctx, s);
      bicycle(ctx, s * 0.5, s * 0.64, s * 0.36, INK);
      break;
    case 'A-29':
      // sygnały świetlne — світлофор
      warn(ctx, s);
      ctx.fillRect(s * 0.43, s * 0.41, s * 0.14, s * 0.35);
      for (const [y, c] of [[0.47, RED], [0.585, YELLOW], [0.7, '#2fb36b']] as const) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * y, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'A-32': {
      // oszronienie jezdni — сніжинка
      warn(ctx, s);
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 2;
        ctx.moveTo(s * 0.5 + Math.cos(a) * s * 0.14, s * 0.61 + Math.sin(a) * s * 0.14);
        ctx.lineTo(s * 0.5 - Math.cos(a) * s * 0.14, s * 0.61 - Math.sin(a) * s * 0.14);
      }
      ctx.stroke();
      break;
    }
    case 'B-36':
      circle(ctx, s, BLUE, RED);
      ctx.strokeStyle = RED;
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(s * 0.25, s * 0.25);
      ctx.lineTo(s * 0.75, s * 0.75);
      ctx.moveTo(s * 0.75, s * 0.25);
      ctx.lineTo(s * 0.25, s * 0.75);
      ctx.stroke();
      break;
    case 'B-33-40':
    case 'B-33-70':
      circle(ctx, s, '#fff', RED);
      text(ctx, s, type.slice(5), 0.36, INK, 0.53);
      break;
    case 'D-2':
      drawSign(ctx, s, 'D-1');
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-s * 0.33, -s * 0.33, s * 0.66, s * 0.66);
      ctx.clip();
      ctx.rotate(-Math.PI / 4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.035;
      for (const o of [-0.1, 0, 0.1]) {
        ctx.beginPath();
        ctx.moveTo(s * (-0.4 + o), s * 0.4);
        ctx.lineTo(s * (0.4 + o), s * -0.4);
        ctx.stroke();
      }
      ctx.restore();
      break;
    case 'D-6a':
      // przejazd dla rowerzystów
      blueSquare(ctx, s);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.14);
      ctx.lineTo(s * 0.88, s * 0.84);
      ctx.lineTo(s * 0.12, s * 0.84);
      ctx.closePath();
      ctx.fill();
      bicycle(ctx, s * 0.5, s * 0.66, s * 0.3, INK);
      ctx.fillStyle = INK;
      ctx.fillRect(s * 0.24, s * 0.78, s * 0.52, s * 0.025);
      break;
    case 'D-47':
      // koniec drogi wewnętrznej — біла табличка з написом і червоною смугою
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(s * 0.04, s * 0.26, s * 0.92, s * 0.48, s * 0.04);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.02;
      ctx.stroke();
      text(ctx, s, 'Droga', 0.13, INK, 0.42);
      text(ctx, s, 'wewnętrzna', 0.11, INK, 0.58);
      ctx.strokeStyle = RED;
      ctx.lineWidth = s * 0.045;
      ctx.beginPath();
      ctx.moveTo(s * 0.08, s * 0.7);
      ctx.lineTo(s * 0.92, s * 0.3);
      ctx.stroke();
      break;
    case 'E-17a':
      // зелена табличка з назвою місцевості (не означає кінця населеного пункту)
      ctx.fillStyle = '#1f7a3d';
      ctx.beginPath();
      ctx.roundRect(s * 0.04, s * 0.32, s * 0.92, s * 0.36, s * 0.04);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = s * 0.015;
      ctx.beginPath();
      ctx.roundRect(s * 0.07, s * 0.35, s * 0.86, s * 0.3, s * 0.03);
      ctx.stroke();
      text(ctx, s, 'Bartniki', 0.16, '#fff', 0.51);
      break;
    case 'D-6b':
      blueSquare(ctx, s);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.14);
      ctx.lineTo(s * 0.88, s * 0.84);
      ctx.lineTo(s * 0.12, s * 0.84);
      ctx.closePath();
      ctx.fill();
      bicycle(ctx, s * 0.38, s * 0.68, s * 0.24, INK);
      person(ctx, s * 0.62, s * 0.6, s * 0.26, INK);
      ctx.fillStyle = INK;
      ctx.fillRect(s * 0.2, s * 0.78, s * 0.6, s * 0.025);
      break;
    case 'D-7':
      blueSquare(ctx, s);
      // przód samochodu
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(s * 0.26, s * 0.44, s * 0.48, s * 0.2, s * 0.03);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.32, s * 0.44);
      ctx.lineTo(s * 0.37, s * 0.3);
      ctx.lineTo(s * 0.63, s * 0.3);
      ctx.lineTo(s * 0.68, s * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(s * 0.29, s * 0.64, s * 0.08, s * 0.08);
      ctx.fillRect(s * 0.63, s * 0.64, s * 0.08, s * 0.08);
      ctx.fillStyle = BLUE;
      ctx.fillRect(s * 0.4, s * 0.33, s * 0.2, s * 0.08);
      for (const x of [0.33, 0.67]) {
        ctx.beginPath();
        ctx.arc(s * x, s * 0.52, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(s * 0.27, s * 0.585, s * 0.46, s * 0.018);
      break;
    case 'D-9':
      blueSquare(ctx, s);
      // autostrada — дві смуги, що сходяться, і міст
      ctx.fillStyle = '#fff';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * (0.5 + side * 0.04), s * 0.16);
        ctx.lineTo(s * (0.5 + side * 0.1), s * 0.16);
        ctx.lineTo(s * (0.5 + side * 0.3), s * 0.84);
        ctx.lineTo(s * (0.5 + side * 0.1), s * 0.84);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillRect(s * 0.18, s * 0.44, s * 0.64, s * 0.05);
      ctx.fillRect(s * 0.27, s * 0.49, s * 0.46, s * 0.025);
      break;
    case 'D-10':
      // «koniec autostrady»: D-9 з червоною діагоналлю
      drawSign(ctx, s, 'D-9');
      ctx.strokeStyle = RED;
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(s * 0.12, s * 0.88);
      ctx.lineTo(s * 0.88, s * 0.12);
      ctx.stroke();
      break;
    case 'D-43':
      drawSign(ctx, s, 'D-42');
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(s * 0.04, s * 0.14, s * 0.92, s * 0.72, s * 0.05);
      ctx.clip();
      ctx.strokeStyle = RED;
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(s * 0.04, s * 0.86);
      ctx.lineTo(s * 0.96, s * 0.14);
      ctx.stroke();
      ctx.restore();
      break;
    case 'G-1a':
      railPost(ctx, s, 3);
      break;
    case 'G-1b':
      railPost(ctx, s, 2);
      break;
    case 'G-1c':
      railPost(ctx, s, 1);
      break;
    case 'G-3':
      // krzyż św. Andrzeja — дві білі дошки з червоною облямівкою навхрест
      for (const a of [Math.PI / 5, -Math.PI / 5]) {
        ctx.save();
        ctx.translate(s / 2, s / 2);
        ctx.rotate(a);
        ctx.fillStyle = RED;
        ctx.fillRect(-s * 0.47, -s * 0.085, s * 0.94, s * 0.17);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-s * 0.45, -s * 0.06, s * 0.9, s * 0.12);
        ctx.fillStyle = RED;
        for (const x of [-0.27, 0.27]) ctx.fillRect(s * (x - 0.05), -s * 0.06, s * 0.1, s * 0.12);
        ctx.restore();
      }
      break;
    case 'A-17':
      triangle(ctx, s, false, YELLOW);
      person(ctx, s * 0.42, s * 0.6, s * 0.28, INK);
      person(ctx, s * 0.58, s * 0.63, s * 0.22, INK);
      break;
    case 'B-20': {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i * Math.PI) / 4;
        const x = s / 2 + Math.cos(a) * s * 0.48;
        const y = s / 2 + Math.sin(a) * s * 0.48;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = RED;
      ctx.fill();
      ctx.lineWidth = s * 0.03;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      text(ctx, s, 'STOP', 0.26, '#fff', 0.53);
      break;
    }
    case 'B-23':
      circle(ctx, s, '#fff', RED);
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 0.6, s * 0.68);
      ctx.lineTo(s * 0.6, s * 0.42);
      ctx.arc(s * 0.5, s * 0.42, s * 0.1, 0, Math.PI, true);
      ctx.lineTo(s * 0.4, s * 0.6);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(s * 0.31, s * 0.58);
      ctx.lineTo(s * 0.49, s * 0.58);
      ctx.lineTo(s * 0.4, s * 0.72);
      ctx.fill();
      ctx.strokeStyle = RED;
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(s * 0.25, s * 0.25);
      ctx.lineTo(s * 0.75, s * 0.75);
      ctx.stroke();
      break;
    case 'B-25':
      circle(ctx, s, '#fff', RED);
      carIcon(ctx, s * 0.35, s * 0.55, s * 0.24, RED);
      carIcon(ctx, s * 0.65, s * 0.55, s * 0.24, INK);
      break;
    case 'B-35':
      circle(ctx, s, BLUE, RED);
      ctx.strokeStyle = RED;
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(s * 0.25, s * 0.25);
      ctx.lineTo(s * 0.75, s * 0.75);
      ctx.stroke();
      break;
    case 'B-33-50':
    case 'B-33-30':
      circle(ctx, s, '#fff', RED);
      text(ctx, s, type === 'B-33-50' ? '50' : '30', 0.36, INK, 0.53);
      break;
    case 'B-44':
      // «koniec strefy»: та сама табличка, перекреслена чорними смугами
      drawSign(ctx, s, 'B-43');
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s * 0.08, s * 0.04, s * 0.84, s * 0.92);
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.025;
      for (const o of [-0.12, 0, 0.12]) {
        ctx.beginPath();
        ctx.moveTo(s * (0.12 + o), s * 0.9);
        ctx.lineTo(s * (0.88 + o), s * 0.1);
        ctx.stroke();
      }
      break;
    case 'D-41':
      // «koniec strefy zamieszkania»: D-40 з червоною діагоналлю
      drawSign(ctx, s, 'D-40');
      ctx.strokeStyle = RED;
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(s * 0.12, s * 0.88);
      ctx.lineTo(s * 0.88, s * 0.12);
      ctx.stroke();
      break;
    case 'B-43': {
      // «strefa ograniczonej prędkości»: біла табличка з написом і кругом 30
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(s * 0.08, s * 0.04, s * 0.84, s * 0.92, s * 0.05);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.02;
      ctx.stroke();
      text(ctx, s, 'STREFA', 0.15, INK, 0.17);
      ctx.save();
      ctx.translate(s * 0.2, s * 0.3);
      ctx.scale(0.6, 0.6);
      circle(ctx, s, '#fff', RED);
      text(ctx, s, '30', 0.36, INK, 0.53);
      ctx.restore();
      break;
    }
    case 'C-12':
      circle(ctx, s, BLUE, null);
      // три стрілки по колу проти годинникової стрілки
      rondoArrows(ctx, s, s / 2, s / 2, s * 0.24, '#fff');
      break;
    case 'D-18':
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.roundRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.06);
      ctx.fill();
      text(ctx, s, 'P', 0.62, '#fff', 0.54);
      break;
    case 'D-40': {
      // «strefa zamieszkania» (як на офіційному зразку): пішохід, авто, будинок, дитина з м'ячем
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.roundRect(s * 0.04, s * 0.18, s * 0.92, s * 0.64, s * 0.05);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = s * 0.015;
      ctx.beginPath();
      ctx.roundRect(s * 0.065, s * 0.2, s * 0.87, s * 0.6, s * 0.04);
      ctx.stroke();
      person(ctx, s * 0.24, s * 0.55, s * 0.36, '#fff');
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(s * 0.4, s * 0.31, s * 0.18, s * 0.08, s * 0.02);
      ctx.fill();
      ctx.fillRect(s * 0.43, s * 0.27, s * 0.12, s * 0.05);
      // будинок
      ctx.beginPath();
      ctx.moveTo(s * 0.74, s * 0.28);
      ctx.lineTo(s * 0.82, s * 0.36);
      ctx.lineTo(s * 0.82, s * 0.5);
      ctx.lineTo(s * 0.66, s * 0.5);
      ctx.lineTo(s * 0.66, s * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = BLUE;
      ctx.fillRect(s * 0.72, s * 0.42, s * 0.04, s * 0.08);
      ctx.fillStyle = '#fff';
      // лінія тротуару й дитина з м'ячем
      ctx.fillRect(s * 0.5, s * 0.55, s * 0.34, s * 0.025);
      ctx.fillRect(s * 0.5, s * 0.5, s * 0.025, s * 0.075);
      person(ctx, s * 0.6, s * 0.67, s * 0.16, '#fff');
      ctx.beginPath();
      ctx.arc(s * 0.52, s * 0.73, s * 0.022, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'D-1':
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-s * 0.33, -s * 0.33, s * 0.66, s * 0.66);
      ctx.fillStyle = YELLOW;
      ctx.fillRect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.015;
      ctx.strokeRect(-s * 0.33, -s * 0.33, s * 0.66, s * 0.66);
      ctx.restore();
      break;
    case 'D-6':
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.roundRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.06);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.14);
      ctx.lineTo(s * 0.88, s * 0.84);
      ctx.lineTo(s * 0.12, s * 0.84);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = INK;
        ctx.fillRect(s * (0.26 + i * 0.13), s * 0.74, s * 0.08, s * 0.06);
      }
      person(ctx, s * 0.5, s * 0.55, s * 0.3, INK);
      break;
    case 'D-15':
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.roundRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.06);
      ctx.fill();
      ctx.fillStyle = YELLOW;
      ctx.fillRect(s * 0.16, s * 0.16, s * 0.68, s * 0.68);
      // піктограма автобуса (вид спереду), як на знаку D-15
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(s * 0.3, s * 0.24, s * 0.4, s * 0.46, s * 0.05);
      ctx.fill();
      ctx.fillRect(s * 0.33, s * 0.68, s * 0.07, s * 0.07);
      ctx.fillRect(s * 0.6, s * 0.68, s * 0.07, s * 0.07);
      ctx.fillStyle = YELLOW;
      ctx.fillRect(s * 0.34, s * 0.3, s * 0.32, s * 0.2);
      ctx.fillRect(s * 0.42, s * 0.26, s * 0.16, s * 0.025);
      for (const x of [0.37, 0.63]) {
        ctx.beginPath();
        ctx.arc(s * x, s * 0.6, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'D-42':
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(s * 0.04, s * 0.14, s * 0.92, s * 0.72, s * 0.05);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.025;
      ctx.stroke();
      ctx.fillStyle = INK;
      // силует міста
      ctx.beginPath();
      ctx.moveTo(s * 0.14, s * 0.76);
      [[0.14, 0.52], [0.24, 0.52], [0.24, 0.42], [0.32, 0.36], [0.4, 0.42], [0.4, 0.58],
        [0.48, 0.58], [0.48, 0.28], [0.52, 0.22], [0.56, 0.28], [0.56, 0.55], [0.66, 0.55],
        [0.66, 0.45], [0.76, 0.45], [0.76, 0.6], [0.86, 0.6], [0.86, 0.76]]
        .forEach(([x, y]) => ctx.lineTo(x * s, y * s));
      ctx.closePath();
      ctx.fill();
      break;
  }
}

const texCache = new Map<SignType, THREE.CanvasTexture>();
/** анізотропна фільтрація текстур знаків і табличок: що більша, то чіткіші написи під кутом */
let anisotropy = 4;

/** Якість текстур знаків під налаштування графіки (вже створені теж оновлюються). */
export function setSignAnisotropy(n: number) {
  if (n === anisotropy) return;
  anisotropy = n;
  const all = [...texCache.values(), ...[...tabMats.values()].map((m) => m.map!)];
  for (const t of all) {
    t.anisotropy = n;
    t.needsUpdate = true;
  }
}

function signTexture(type: SignType) {
  let t = texCache.get(type);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    drawSign(c.getContext('2d')!, 256, type);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    texCache.set(type, t);
  }
  return t;
}

const plateGeo = new THREE.PlaneGeometry(2.6, 2.6);
const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 6);
const plateMats = new Map<SignType, THREE.MeshBasicMaterial>();

function plate(type: SignType, y: number) {
  let m = plateMats.get(type);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: signTexture(type), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    plateMats.set(type, m);
  }
  const face = new THREE.Mesh(plateGeo, m);
  face.position.set(0, y, 0.1);
  // трохи нахиляємо назад, щоб знак було видно з камери зверху
  face.rotation.x = -0.55;
  return face;
}

const tabGeo = new THREE.PlaneGeometry(1.9, 0.62);
const tabMats = new Map<string, THREE.MeshBasicMaterial>();

/** Табличка під знаком (T-1 «80 m», T-5 «3», «Koniec» …): жовта під попереджувальними, біла під іншими. */
function tablet(textValue: string, yellow: boolean, y: number) {
  const key = `${yellow}|${textValue}`;
  let m = tabMats.get(key);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 84;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = yellow ? YELLOW : '#fff';
    ctx.beginPath();
    ctx.roundRect(3, 3, 250, 78, 8);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `900 ${textValue.length > 8 ? 34 : 46}px Nunito, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(textValue, 128, 44);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    m = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    tabMats.set(key, m);
  }
  const face = new THREE.Mesh(tabGeo, m);
  face.position.set(0, y, 0.12);
  face.rotation.x = -0.55;
  return face;
}

/**
 * Стовпчик зі знаком (і, можливо, другим знаком під ним та табличкою з текстом).
 * Лицьова сторона дивиться в +Z.
 */
export function makeSign(type: SignType, below?: SignType, plateText?: string) {
  const g = new THREE.Group();
  const extra = plateText ? 0.8 : 0;
  const h = (below ? 5.4 : 3.2) + extra;
  const pole = new THREE.Mesh(poleGeo, mat(0x8a8f99));
  pole.scale.y = h;
  pole.position.y = h / 2;
  pole.castShadow = true;
  g.add(pole);
  if (below) {
    g.add(plate(type, 5.6 + extra));
    g.add(plate(below, 3.4 + extra));
  } else {
    g.add(plate(type, 3.6 + extra));
  }
  if (plateText) g.add(tablet(plateText, type.startsWith('A-'), 2.05));
  return g;
}
