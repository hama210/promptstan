import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const app = read('src/App.jsx');
const library = read('src/services/liveApiLibrary.js');
const main = read('src/main.jsx');
const dashboard = read('src/admin/AdminDashboard.jsx');
const worker = read('worker/entry-v6.js');
const wrangler = read('wrangler.jsonc');
const packageJson = JSON.parse(read('package.json'));
const migration = read('database/migrations/004_stabilization_schema.sql');
const initialMigration = read('database/migrations/001_initial_schema.sql');
const workflows = [
  '.github/workflows/deploy-cloudflare.yml',
  '.github/workflows/diagnose-images.yml',
  '.github/workflows/verify-referrals.yml',
  '.github/workflows/verify-phase7.yml'
].map(read).join('\n');

for (const removedPublicCategory of [
  'categoryDrawer',
  'categoryGrid',
  'openCategories',
  'closeCategories',
  '<Layers',
  'collectionRow'
]) {
  assert.equal(app.includes(removedPublicCategory), false, `${removedPublicCategory} must not render publicly`);
}

assert.match(app, /data-prompt-slug=\{item\.slug\}/);
assert.match(app, /publicUrl\(`\/prompt\//);
assert.match(app, /library\.source === 'fallback' \? initialStaticPrompts\[0\] : null/);
assert.equal(main.includes('promptIdentityMap'), false);
assert.equal(main.includes('no-categories.css'), false);

assert.match(library, /source: 'live'/);
assert.equal(library.includes('mergePromptLibraries'), false);
assert.equal(library.includes('/api/categories'), false);
assert.equal(library.includes("source: 'hybrid'"), false);

for (const file of ['AdminPanelV5.jsx', 'AdminPanelV6.jsx', 'AdminPanelV7.jsx', 'AdminPanelV8.jsx', 'AdminPanelV9.jsx']) {
  const content = read(`src/admin/${file}`);
  assert.equal(/import AdminPanelV\d/.test(content), false, `${file} must not chain another panel`);
  assert.equal(/<AdminPanelV\d/.test(content), false, `${file} must render only its own section`);
}
assert.match(dashboard, /<AdminPanelV4 \/>/);
assert.match(dashboard, /<AdminPanelV8 \/>/);
assert.match(dashboard, /<AdminPanelV9 \/>/);

assert.match(worker, /isAdminRequest/);
assert.match(worker, /stabilization: 'single-source-v1'/);
assert.match(worker, /url\.pathname === '\/api\/bootstrap'.*adminOnly/s);
assert.equal(workflows.includes('x-promptstan-bootstrap'), false);
assert.equal(workflows.includes('run: npm install'), false);

assert.match(wrangler, /"main": "worker\/entry-v6\.js"/);
assert.match(wrangler, /"compatibility_date": "2026-07-15"/);
assert.match(wrangler, /"observability"/);
assert.equal(existsSync(new URL('../worker/entry-fixed.js', import.meta.url)), false);

for (const version of [
  ...Object.values(packageJson.dependencies || {}),
  ...Object.values(packageJson.devDependencies || {})
]) {
  assert.notEqual(version, 'latest', 'Dependencies must be pinned');
}
assert.equal(existsSync(new URL('../package-lock.json', import.meta.url)), true);

for (const table of ['prompt_events', 'content_scale_events', 'automation_settings', 'automation_runs']) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
for (const table of ['categories', 'prompts', 'tags', 'prompt_tags']) {
  assert.match(initialMigration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}

console.log(JSON.stringify({
  ok: true,
  phase: '8A',
  stabilization: 'single-source-v1',
  public_categories_removed: true,
  d1_single_source: true,
  admin_chain_flattened: true,
  bootstrap_requires_admin: true,
  dependencies_pinned: true,
  formal_migration_added: true
}, null, 2));
