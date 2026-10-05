// Повна перевірка рівнів (те саме, що й у dev-консолі). Запуск: node tools/scenes/audit.mjs
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { LEVELS, FREE_MAPS } = await vite.ssrLoadModule('/src/data/levels/index.ts');
const { auditLevel } = await vite.ssrLoadModule('/src/data/audit.ts');
await vite.close();
const issues = [...LEVELS, ...FREE_MAPS].flatMap((l) => auditLevel(l));
console.log(issues.length ? issues.join('\n') : 'Перевірка рівнів: усе гаразд ✅');
