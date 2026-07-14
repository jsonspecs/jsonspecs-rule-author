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
const dependentOperators = new Set([
  'matches_regex',
  'valid_inn',
  'in_dictionary',
  'field_equals_field',
  'field_not_equals_field',
  'field_less_than_field',
  'field_greater_than_field',
  'field_less_or_equal_than_field',
  'field_greater_or_equal_than_field'
]);

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

function ruleField(rule) {
  return rule?.field || (Array.isArray(rule?.fields) ? rule.fields.join('|') : null);
}

const manifest = readJson(path.join(root, 'manifest.json'));
const rulesDir = path.resolve(root, manifest?.paths?.rules || './rules');
const artifacts = new Map();

for (const file of walkFiles(rulesDir, (candidate) => candidate.endsWith('.json'))) {
  const parsed = readJson(file);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  for (const artifact of list) {
    if (artifact?.id) artifacts.set(artifact.id, artifact);
  }
}

for (const [id, artifact] of artifacts) {
  const steps = artifact.flow || artifact.steps;
  if (!Array.isArray(steps)) continue;
  const hasConditionGuard = artifact.when !== undefined && artifact.when !== null;
  const directRequiredFields = new Set();
  for (const step of steps) {
    if (step.condition || step.pipeline) continue;
    if (!step.rule) continue;
    const rule = artifacts.get(step.rule);
    if (!rule || rule.type !== 'rule') continue;
    const field = ruleField(rule);
    if (rule.operator === 'not_empty' && field) {
      directRequiredFields.add(field);
      continue;
    }
    if (!dependentOperators.has(rule.operator)) continue;
    if (!field) continue;
    if (directRequiredFields.has(field)) {
      warnings.push(`${id}: ${step.rule} runs directly after required check for ${field}; consider if_present/format guard condition`);
      continue;
    }
    if (rule.operator.startsWith('field_') && !hasConditionGuard) {
      warnings.push(`${id}: ${step.rule} is a direct cross-field comparison; consider format/presence guard predicates`);
    }
  }
}

notes.push(`artifacts inspected: ${artifacts.size}`);
notes.push(`guard-order warnings: ${warnings.length}`);
const exitCode = errors.length > 0 || (options.strict && warnings.length > 0) ? 1 : 0;
if (options.json) {
  console.log(JSON.stringify({ ok: exitCode === 0, errors, warnings, notes }, null, 2));
} else {
  for (const note of notes) console.log(`info: ${note}`);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (exitCode === 0) console.log('guard-order audit OK');
}
process.exit(exitCode);
