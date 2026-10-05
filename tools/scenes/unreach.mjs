// Список недоступних питань: id, пули, вимога сцени, текст.
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { LEVELS, FREE_MAPS } = await vite.ssrLoadModule('/src/data/levels/index.ts');
const { QUESTIONS, POOLS } = await vite.ssrLoadModule('/src/data/questions.ts');
const { matchingQuestions } = await vite.ssrLoadModule('/src/data/sceneMatch.ts');
const { sceneSpec } = await vite.ssrLoadModule('/src/data/scenes.ts');
await vite.close();
const V = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const dirBetween = (a, b) => (b[0] > a[0] ? 'E' : b[0] < a[0] ? 'W' : b[1] > a[1] ? 'S' : 'N');
const reach = new Set();
const usedPools = new Set();
for (const lvl of [...LEVELS, ...FREE_MAPS]) {
  const road = (c) => c[1] >= 0 && c[1] < lvl.rows && c[0] >= 0 && c[0] < lvl.cols && lvl.map[c[1]][c[0]] === '#';
  const route = lvl.route ?? [];
  for (const t of lvl.triggers) {
    usedPools.add(t.q);
    const i = route.findIndex((c) => same(c, t.cell));
    const rd = i < 0 ? null : i > 0 ? dirBetween(route[i - 1], t.cell) : dirBetween(t.cell, route[1]);
    const dirs = t.dir ? [t.dir] : rd ? [rd] : ['N', 'E', 'S', 'W'].filter((d) => road([t.cell[0] - V[d][0], t.cell[1] - V[d][1]]) && road([t.cell[0] + V[d][0], t.cell[1] + V[d][1]]));
    for (const d of dirs) for (const o of matchingQuestions(lvl, t.cell, d, t.q, lvl.exam ? Object.keys(QUESTIONS) : null, route.length > 0)) reach.add(o.id);
  }
}
const poolsOf = (id) => Object.entries(POOLS).filter(([, p]) => p.ids.includes(id)).map(([k]) => k + (usedPools.has(k) ? '' : '*'));
for (const id of Object.keys(QUESTIONS).filter((id) => !reach.has(id))) {
  console.log(`${id}\t[${poolsOf(id).join(',')}]\t${sceneSpec(id, null, POOLS)}\t${QUESTIONS[id].ua.text.slice(0, 110)}`);
}
console.log('\nНевикористані пули: ' + Object.keys(POOLS).filter((k) => !usedPools.has(k)).join(' '));
