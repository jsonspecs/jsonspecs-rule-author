#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);
const skipBuild = args.includes('--skip-build');
const skipCli = args.includes('--skip-cli');
const strictAudit = args.includes('--strict');

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run(label, command, commandArgs, options = {}) {
  console.log(`\n> ${label}`);
  console.log(`$ ${[command, ...commandArgs].join(' ')}`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function jsonspecsCommandArgs(command) {
  const localBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'jsonspecs.cmd' : 'jsonspecs');
  if (exists(localBin)) return { command: localBin, args: [command] };
  return { command: 'npx', args: ['--yes', 'jsonspecs-cli@latest', command] };
}

function hasJsonSamples(samplesDir) {
  if (!exists(samplesDir)) return false;
  const stack = [samplesDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      if (entry.isFile() && entry.name.endsWith('.json')) return true;
    }
  }
  return false;
}

if (!exists(path.join(root, 'manifest.json'))) {
  console.error(`manifest.json not found in ${root}`);
  process.exit(1);
}

const manifest = readJson(path.join(root, 'manifest.json'));
const samplesDir = path.resolve(root, manifest.paths?.samples || './samples');

run(
  'skill audit',
  process.execPath,
  [
    path.join(scriptDir, 'audit-manifest-coverage.mjs'),
    root,
    ...(strictAudit ? ['--strict'] : [])
  ]
);

if (!skipCli) {
  for (const commandName of ['validate']) {
    const cli = jsonspecsCommandArgs(commandName);
    run(`jsonspecs ${commandName}`, cli.command, cli.args);
  }

  if (hasJsonSamples(samplesDir)) {
    const cli = jsonspecsCommandArgs('test');
    run('jsonspecs test', cli.command, cli.args);
  } else {
    console.warn('warning: no JSON samples found; skipping jsonspecs test');
  }

  if (!skipBuild) {
    const cli = jsonspecsCommandArgs('build');
    run('jsonspecs build', cli.command, cli.args);
  }
}

console.log('\njsonspecs package validation OK');
