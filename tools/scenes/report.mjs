// Звіт «що бачить водій ↔ які питання можуть випасти» для кожної точки-питання на всіх рівнях.
// Запуск: node tools/scenes/report.mjs > tools/scenes/report.md
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { LEVELS, FREE_MAPS } = await vite.ssrLoadModule('/src/data/levels/index.ts');
const { QUESTIONS, POOLS } = await vite.ssrLoadModule('/src/data/questions.ts');
await vite.close();

const V = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' };
const LEFT = { N: 'W', W: 'S', S: 'E', E: 'N' };
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const step = (c, d, n = 1) => [c[0] + V[d][0] * n, c[1] + V[d][1] * n];
const dirBetween = (a, b) => (b[0] > a[0] ? 'E' : b[0] < a[0] ? 'W' : b[1] > a[1] ? 'S' : 'N');

const out = [];
for (const lvl of [...LEVELS, ...FREE_MAPS]) {
  const road = (c) => {
    const [x, y] = c;
    if (y < 0 || y >= lvl.rows || x < 0 || x >= lvl.cols) return false;
    return lvl.map[y][x] === '#';
  };
  const exits = (c) => ['N', 'E', 'S', 'W'].filter((d) => road(step(c, d)));
  const route = lvl.route ?? [];
  const rdir = (c) => {
    const i = route.findIndex((x) => same(x, c));
    if (i < 0) return null;
    return i > 0 ? dirBetween(route[i - 1], c) : dirBetween(c, route[1]);
  };
  const nextTurn = (c) => {
    const i = route.findIndex((x) => same(x, c));
    if (i < 0) return '';
    for (let j = Math.max(1, i); j < route.length - 1 && j <= i + 3; j++) {
      const a = dirBetween(route[j - 1], route[j]);
      const b = dirBetween(route[j], route[j + 1]);
      if ((lvl.roundabouts ?? []).some((r) => same(r, route[j]))) return `рондо через ${j - i} кл.`;
      if (a !== b) return `${b === RIGHT[a] ? 'праворуч' : b === LEFT[a] ? 'ліворуч' : 'розворот'} через ${j - i} кл.`;
    }
    return 'прямо';
  };

  out.push(`\n## ${lvl.icon} ${lvl.name} (\`${lvl.id}\`, ${lvl.scenery ?? 'city'}, ${lvl.weather ?? 'clear'}, ліміт ${lvl.limit ?? 50})\n`);
  for (const t of lvl.triggers) {
    // без напрямку (вільна їзда) — показуємо для першого можливого напрямку
    const d = t.dir ?? rdir(t.cell) ?? OPP[exits(t.cell)[0]] ?? 'N';
    const look = [0, 1, 2].map((k) => step(t.cell, d, k));
    const signs = lvl.signs
      .filter((s) => s.travel === d && look.some((c) => same(c, s.cell)))
      .map((s) => `${s.type}${s.below ? '+' + s.below : ''}@${look.findIndex((c) => same(c, s.cell))}`);
    const feat = [];
    look.forEach((c, k) => {
      if (k && exits(c).length >= 3) feat.push(`перехрестя(${exits(c).length})@${k}`);
      if ((lvl.roundabouts ?? []).some((r) => same(r, c))) feat.push(`рондо@${k}`);
      if (lvl.crosswalks.some((cw) => same(cw.cell, c))) feat.push(`зебра@${k}`);
      if ((lvl.rails ?? []).some((r) => same(r.cell, c))) feat.push(`переїзд@${k}`);
    });
    const actors = lvl.actors
      .filter((a) => look.some((c) => same(c, a.cell)) || (a.go && a.go === t.q))
      .map((a) => `${a.kind}${a.go === t.q ? '*' : ''}→${a.face}${a.blink ? ' blink:' + a.blink : ''}`);
    const zone = (lvl.zones ?? []).find((z) => t.cell[0] >= z.from[0] && t.cell[0] <= z.to[0] && t.cell[1] >= z.from[1] && t.cell[1] <= z.to[1]);
    out.push(`### \`${t.q}\` ${t.cell} рух ${d} — маневр: ${nextTurn(t.cell) || '—'}`);
    out.push(`Сцена: знаки [${signs.join(', ')}] · ${feat.join(', ') || 'пряма'} · учасники [${actors.join(', ')}]${zone ? ' · зона ' + zone.limit : ''}`);
    const pool = POOLS[t.q]?.ids ?? [];
    for (const id of pool) {
      const q = QUESTIONS[id];
      if (!q) continue;
      const ans = q.ua.options[q.correct];
      out.push(`- **${id}**${q.image ? ' 📷' : ''}: ${q.ua.text} — ✔ ${ans}`);
    }
    out.push('');
  }
}
console.log(out.join('\n'));
