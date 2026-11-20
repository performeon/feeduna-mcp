import { builtinModules } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [metafilePath, noticesPath, inventoryPath] = process.argv.slice(2);
const metafile = JSON.parse(readFileSync(metafilePath, 'utf8'));
const lockfile = JSON.parse(readFileSync('npm-shrinkwrap.json', 'utf8'));
const outputs = Object.values(metafile.outputs);
if (outputs.length !== 1) throw new Error('Expected one standalone bundle');

const builtins = new Set(builtinModules.map(name => name.replace(/^node:/u, '')));
const external = new Set();
for (const item of outputs[0].imports) {
  if (!item.external || !builtins.has(item.path.replace(/^node:/u, ''))) {
    throw new Error(`Unexpected runtime import ${item.path}`);
  }
  external.add(item.path);
}

const packagePaths = new Set();
const vendorsByPackage = new Map();
for (const path of Object.keys(outputs[0].inputs)) {
  if (!path.startsWith('node_modules/')) continue;
  const match = path.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//u);
  if (!match) throw new Error(`Cannot identify bundled package in ${path}`);
  packagePaths.add(match[1]);
  if (!match[1].startsWith('node_modules/@modelcontextprotocol/') || !existsSync(`${path}.map`)) continue;
  const map = JSON.parse(readFileSync(`${path}.map`, 'utf8'));
  for (const source of map.sources) {
    const vendored = source.match(/\/\.pnpm\/([a-z0-9-]+@\d+\.\d+\.\d+)(?:[_/])/u)?.[1];
    if (!vendored) continue;
    const parents = vendorsByPackage.get(vendored) ?? new Set();
    parents.add(match[1].replace(/^node_modules\//u, ''));
    vendorsByPackage.set(vendored, parents);
  }
}

const notices = ['Third-party notices for the Feeduna MCP stdio bundle.'];
const dependencies = [];
for (const path of [...packagePaths].sort()) {
  const metadata = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  const pinned = lockfile.packages[path];
  if (!pinned || metadata.version !== pinned.version || metadata.license !== pinned.license) {
    throw new Error(`Bundled package differs from the release lock: ${path}`);
  }
  const noticeNames = readdirSync(path, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^(?:licen[sc]e|notice|copying|copyright)(?:[._-].+)?$/iu.test(entry.name))
    .map(entry => entry.name).sort();
  if (!noticeNames.some(name => /^(?:licen[sc]e|copying)/iu.test(name))) {
    throw new Error(`No license text found for ${metadata.name}`);
  }
  dependencies.push({
    name: metadata.name, version: metadata.version, license: metadata.license,
    resolved: pinned.resolved, integrity: pinned.integrity, noticeFiles: noticeNames,
  });
  for (const name of noticeNames) {
    notices.push(`===== ${metadata.name} ${metadata.version} — ${name} (${metadata.license}) =====`);
    notices.push(readFileSync(join(path, name), 'utf8'));
  }
}
if (!dependencies.length) throw new Error('No bundled dependencies detected');

const vendoredPins = JSON.parse(readFileSync(new URL('./sdk-vendored-licenses.json', import.meta.url), 'utf8'));
const vendorKeys = vendoredPins.map(pin => `${pin.name}@${pin.version}`);
if (JSON.stringify(vendorKeys.sort()) !== JSON.stringify([...vendorsByPackage.keys()].sort())) {
  throw new Error('The SDK source maps and vendored license inventory differ');
}
const vendoredDependencies = await Promise.all(vendoredPins.map(async pin => {
  const resolved = `https://registry.npmjs.org/${pin.name}/-/${pin.name}-${pin.version}.tgz`;
  const downloaded = await fetch(resolved, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!downloaded.ok) throw new Error(`Could not read pinned license archive for ${pin.name}`);
  const archive = Buffer.from(await downloaded.arrayBuffer());
  if (createHash('sha256').update(archive).digest('hex') !== pin.sha256) {
    throw new Error(`Unexpected vendored archive digest for ${pin.name}`);
  }
  const license = spawnSync('tar', ['-xzOf', '-', 'package/LICENSE'], { input: archive, encoding: 'utf8' });
  if (license.status !== 0 || !license.stdout.trim()) throw new Error(`Missing license text for ${pin.name}`);
  const bundledIn = [...vendorsByPackage.get(`${pin.name}@${pin.version}`)].sort();
  return { pin: { ...pin, resolved, bundledIn, noticeFiles: ['LICENSE'] }, text: license.stdout };
}));
for (const { pin, text } of vendoredDependencies) {
  notices.push(`===== ${pin.name} ${pin.version} — LICENSE (${pin.license}), bundled by ${pin.bundledIn.join(', ')} =====`, text);
}
writeFileSync(noticesPath, `${notices.join('\n\n')}\n`);
writeFileSync(inventoryPath, `${JSON.stringify({
  dependencies, vendoredDependencies: vendoredDependencies.map(({ pin }) => pin), runtimeBuiltins: [...external].sort(),
}, null, 2)}\n`);
