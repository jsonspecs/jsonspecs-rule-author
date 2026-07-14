#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const options = {
  json: args.includes('--json'),
  strict: args.includes('--strict')
};
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);
const errors = [];
const warnings = [];
const notes = [];

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (cause) {
    errors.push(`${path.relative(root, file)}: cannot parse JSON: ${cause.message}`);
    return null;
  }
}

function walkFiles(dir, predicate = () => true, ignoredNames = new Set(['.git', 'node_modules', 'dist'])) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, predicate, ignoredNames));
    else if (entry.isFile() && predicate(full)) out.push(full);
  }
  return out;
}

function refsFromStep(step) {
  if (!step || typeof step !== 'object') return [];
  return [step.rule, step.condition, step.pipeline].filter((value) => typeof value === 'string');
}

function collectWhenRefs(when, out = new Set()) {
  if (typeof when === 'string') {
    out.add(when);
    return out;
  }
  if (Array.isArray(when)) {
    for (const item of when) collectWhenRefs(item, out);
    return out;
  }
  if (!when || typeof when !== 'object') return out;
  collectWhenRefs(when.all, out);
  collectWhenRefs(when.any, out);
  collectWhenRefs(when.none, out);
  return out;
}

function collectDictionaryRefs(dictionary, out = new Set()) {
  if (typeof dictionary === 'string') {
    out.add(dictionary);
    return out;
  }
  if (Array.isArray(dictionary)) {
    for (const item of dictionary) collectDictionaryRefs(item, out);
    return out;
  }
  if (!dictionary || typeof dictionary !== 'object') return out;
  if (typeof dictionary.id === 'string') out.add(dictionary.id);
  return out;
}

const manifest = readJson(path.join(root, 'manifest.json'));
const rulesDir = path.resolve(root, manifest?.paths?.rules || './rules');
const artifacts = new Map();
const filesById = new Map();
const references = new Map();
const entrypoints = new Set();

for (const file of walkFiles(rulesDir, (candidate) => candidate.endsWith('.json'))) {
  const parsed = readJson(file);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  for (const artifact of list) {
    if (!artifact || typeof artifact !== 'object' || typeof artifact.id !== 'string') continue;
    if (artifacts.has(artifact.id)) {
      errors.push(`duplicate artifact id ${artifact.id}: ${path.relative(root, filesById.get(artifact.id))} and ${path.relative(root, file)}`);
    }
    artifacts.set(artifact.id, artifact);
    filesById.set(artifact.id, file);
    if (artifact.type === 'pipeline' && artifact.entrypoint === true) entrypoints.add(artifact.id);
  }
}

for (const [id, artifact] of artifacts) {
  const refs = new Set();
  for (const step of artifact.flow || artifact.steps || []) {
    for (const ref of refsFromStep(step)) refs.add(ref);
  }
  for (const ref of collectWhenRefs(artifact.when)) refs.add(ref);
  for (const ref of collectDictionaryRefs(artifact.dictionary)) refs.add(ref);
  references.set(id, refs);
  if ((artifact.flow || artifact.steps || []).length > 25) {
    warnings.push(`${id}: large flow with ${(artifact.flow || artifact.steps).length} steps; consider scenario blocks`);
  }
}

for (const [id, refs] of references) {
  for (const ref of refs) {
    if (!artifacts.has(ref)) warnings.push(`${id}: references missing artifact ${ref}`);
  }
}

const reachable = new Set();
function visit(id, stack = []) {
  if (stack.includes(id)) {
    warnings.push(`cycle detected: ${[...stack, id].join(' -> ')}`);
    return;
  }
  if (reachable.has(id)) return;
  reachable.add(id);
  const refs = references.get(id) || new Set();
  for (const ref of refs) {
    if (artifacts.has(ref)) visit(ref, [...stack, id]);
  }
}
for (const entrypoint of entrypoints) visit(entrypoint);

for (const id of artifacts.keys()) {
  if (!reachable.has(id)) {
    warnings.push(`${id}: artifact is not reachable from any entrypoint`);
  }
}

notes.push(`artifacts: ${artifacts.size}`);
notes.push(`entrypoints: ${entrypoints.size}`);
notes.push(`reachable: ${reachable.size}`);
const exitCode = errors.length > 0 || (options.strict && warnings.length > 0) ? 1 : 0;
if (options.json) {
  console.log(JSON.stringify({ ok: exitCode === 0, errors, warnings, notes }, null, 2));
} else {
  for (const note of notes) console.log(`info: ${note}`);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (exitCode === 0) console.log('rule graph audit OK');
}
process.exit(exitCode);
