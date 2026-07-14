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

const manifest = readJson(path.join(root, 'manifest.json'));
const rulesDir = path.resolve(root, manifest?.paths?.rules || './rules');
const samplesDir = path.resolve(root, manifest?.paths?.samples || './samples');
const entrypoints = new Set();

for (const file of walkFiles(rulesDir, (candidate) => candidate.endsWith('.json'))) {
  const parsed = readJson(file);
  const artifacts = Array.isArray(parsed) ? parsed : [parsed];
  for (const artifact of artifacts) {
    if (artifact?.type === 'pipeline' && artifact.entrypoint === true) entrypoints.add(artifact.id);
  }
}

const matrix = {};
for (const entrypoint of entrypoints) {
  matrix[entrypoint] = { total: 0, OK: 0, OK_WITH_WARNINGS: 0, ERROR: 0, EXCEPTION: 0, ABORT: 0, unknown: 0 };
}

for (const file of walkFiles(samplesDir, (candidate) => candidate.endsWith('.json'))) {
  const sample = readJson(file);
  const pipelineId = sample?.context?.pipelineId || sample?.pipelineId;
  if (!pipelineId) {
    warnings.push(`${path.relative(root, file)}: sample has no context.pipelineId`);
    continue;
  }
  if (!matrix[pipelineId]) {
    warnings.push(`${path.relative(root, file)}: sample references unknown entrypoint ${pipelineId}`);
    continue;
  }
  const status = sample?.expect?.status || 'unknown';
  matrix[pipelineId].total += 1;
  if (Object.prototype.hasOwnProperty.call(matrix[pipelineId], status)) matrix[pipelineId][status] += 1;
  else matrix[pipelineId].unknown += 1;
}

for (const [entrypoint, row] of Object.entries(matrix)) {
  if (row.total === 0) warnings.push(`${entrypoint}: no samples`);
  if (row.OK === 0) warnings.push(`${entrypoint}: no OK sample`);
  if (row.OK_WITH_WARNINGS === 0 && row.ERROR === 0 && row.EXCEPTION === 0 && row.ABORT === 0) {
    warnings.push(`${entrypoint}: no failing or warning sample`);
  }
}

notes.push(`entrypoints: ${entrypoints.size}`);
notes.push(`samples: ${Object.values(matrix).reduce((sum, row) => sum + row.total, 0)}`);
const exitCode = errors.length > 0 || (options.strict && warnings.length > 0) ? 1 : 0;
if (options.json) {
  console.log(JSON.stringify({ ok: exitCode === 0, errors, warnings, notes, matrix }, null, 2));
} else {
  for (const note of notes) console.log(`info: ${note}`);
  for (const [entrypoint, row] of Object.entries(matrix)) {
    console.log(`info: ${entrypoint}: total=${row.total}, OK=${row.OK}, OK_WITH_WARNINGS=${row.OK_WITH_WARNINGS}, ERROR=${row.ERROR}, EXCEPTION=${row.EXCEPTION}, ABORT=${row.ABORT}`);
  }
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (exitCode === 0) console.log('sample matrix audit OK');
}
process.exit(exitCode);
