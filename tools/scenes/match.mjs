// Звіт відповідності «сцена ↔ питання» для всіх точок усіх рівнів.
// Запуск: node tools/scenes/match.mjs [--brief] > tools/scenes/match.md
import { createServer } from 'vite';

const brief = process.argv.includes('--brief');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { LEVELS, FREE_MAPS } = await vite.ssrLoadModule('/src/data/levels/index.ts');
const { QUESTIONS, POOLS } = await vite.ssrLoadModule('/src/data/questions.ts');
const { sceneOptions, missing } = await vite.ssrLoadModule('/src/data/sceneMatch.ts');
const { sceneSpec } = await vite.ssrLoadModule('/src/data/scenes.ts');
await vite.close();

const V = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const dirBetween = (a, b) => (b[0] > a[0] ? 'E' : b[0] < a[0] ? 'W' : b[1] > a[1] ? 'S' : 'N');

const out = [];
let total = 0, ok = 0, dead = 0;
const missCount = {};
for (const lvl of [...LEVELS, ...FREE_MAPS]) {
  const road = (c) => c[1] >= 0 && c[1] < lvl.rows && c[0] >= 0 && c[0] < lvl.cols && lvl.map[c[1]][c[0]] === '#';
  const route = lvl.route ?? [];
  out.push(`\n## ${lvl.icon} ${lvl.name} (\`${lvl.id}\`)${lvl.exam ? ' — іспит: уся база' : ''}`);
  for (const t of lvl.triggers) {
    const i = route.findIndex((c) => same(c, t.cell));
    const rd = i < 0 ? null : i > 0 ? dirBetween(route[i - 1], t.cell) : dirBetween(t.cell, route[1]);
    const dirs = t.dir ? [t.dir] : rd ? [rd] : ['N', 'E', 'S', 'W'].filter((d) => road([t.cell[0] - V[d][0], t.cell[1] - V[d][1]]) && road([t.cell[0] + V[d][0], t.cell[1] + V[d][1]]));
    const ids = lvl.exam ? Object.keys(QUESTIONS) : POOLS[t.q]?.ids ?? [];
    for (const d of dirs) {
      const options = sceneOptions(lvl, t.cell, d, t.q, route.length > 0);
      const facts = options[0].facts;
      const good = [], bad = [];
      for (const id of ids) {
        const spec = sceneSpec(id, lvl.exam ? null : t.q, POOLS);
        const miss = options.some((o) => !missing(spec, o.facts).length) ? [] : missing(spec, facts);
        (miss.length ? bad : good).push([id, miss]);
        if (!lvl.exam) {
          total++;
          if (!miss.length) ok++;
          for (const m of miss) missCount[m] = (missCount[m] ?? 0) + 1;
        }
      }
      if (!good.length) dead++;
      const mark = good.length === ids.length ? '✅' : good.length ? '🟡' : '❌';
      out.push(`${mark} \`${t.q}\` ${t.cell} ${d}: ${good.length}/${ids.length}  · сцена: ${[...facts].filter((x) => x !== 'gen').join(' ')}`);
      if (!brief && !lvl.exam) for (const [id, miss] of bad) out.push(`    ✗ ${id} бракує: ${miss.join(' ')} — ${QUESTIONS[id].ua.text.slice(0, 70)}`);
    }
  }
}
const top = Object.entries(missCount).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k}:${v}`).join('  ');
out.unshift(`Пари «точка↔питання»: ${ok} з ${total} відповідають сцені; точок без жодного питання: ${dead}\nНайчастіше бракує: ${top}`);
console.log(out.join('\n'));
