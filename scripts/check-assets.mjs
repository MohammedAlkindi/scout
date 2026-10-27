import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve('public');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const entry = html.match(/<script type="module" src="([^"]+)"/);
if (!entry) throw new Error('Frontend module entrypoint is missing');
const visited = new Set();
async function check(file) {
  if (visited.has(file)) return;
  visited.add(file);
  await access(file);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
    await check(resolve(dirname(file), match[1]));
  }
}
await check(resolve(root, entry[1].replace(/^\//, '')));
console.log(`Verified ${visited.size} frontend modules`);
// The native backend builder inventories public files before the custom build.
// Keep the deployable modules in Git, and reject stale outputs in CI.
if (process.env.CI) execFileSync('git', ['diff', '--exit-code', '--', 'public/assets'], { stdio: 'inherit' });
