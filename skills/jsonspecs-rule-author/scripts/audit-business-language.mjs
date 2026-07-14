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
const warnings = [];
const errors = [];
const notes = [];

const technicalTerms = [
  { pattern: /\benum\b/i, hint: 'use "supported value" or "allowed category"' },
  { pattern: /\bpayload\b/i, hint: 'use request/application/form wording' },
  { pattern: /\bboolean\b/i, hint: 'use yes/no flag or business flag wording' },
  { pattern: /\boperator\b/i, hint: 'use check wording' },
  { pattern: /\bpipeline\b/i, hint: 'use scenario or validation block wording' },
  { pattern: /\bregex\b/i, hint: 'use format wording' },
  { pattern: /\btrue\/false\b/i, hint: 'use yes/no or positive/negative wording' },
  { pattern: /\bPROCESS\b/, hint: 'avoid implementation layer names in business-facing text' }
];

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

function checkText(label, value) {
  if (typeof value !== 'string' || value.trim().length === 0) return;
  for (const term of technicalTerms) {
    if (term.pattern.test(value)) {
      warnings.push(`${label}: technical wording "${value}" (${term.hint})`);
    }
  }
  if (/\b[a-z]+(?:_[a-z0-9]+){2,}\b/.test(value)) {
    warnings.push(`${label}: looks like an artifact id leaks into UI text "${value}"`);
  }
}

const manifestFile = path.join(root, 'manifest.json');
if (!exists(manifestFile)) {
  errors.push(`manifest.json not found in ${root}`);
} else {
  const manifest = readJson(manifestFile);
  const catalog = manifest?.catalog || {};
  for (const [section, items] of Object.entries(catalog)) {
    if (!items || typeof items !== 'object') continue;
    for (const [id, item] of Object.entries(items)) {
      checkText(`manifest.catalog.${section}.${id}.title`, item?.title);
      checkText(`manifest.catalog.${section}.${id}.description`, item?.description);
    }
  }
  const rulesDir = path.resolve(root, manifest?.paths?.rules || './rules');
  for (const file of walkFiles(rulesDir, (candidate) => candidate.endsWith('.json'))) {
    const parsed = readJson(file);
    const artifacts = Array.isArray(parsed) ? parsed : [parsed];
    for (const artifact of artifacts) {
      if (!artifact || typeof artifact !== 'object') continue;
      const label = `${path.relative(root, file)}:${artifact.id || '<no id>'}`;
      checkText(`${label}.description`, artifact.description);
      checkText(`${label}.message`, artifact.message);
    }
  }
}

notes.push(`business language warnings: ${warnings.length}`);
const exitCode = errors.length > 0 || (options.strict && warnings.length > 0) ? 1 : 0;
if (options.json) {
  console.log(JSON.stringify({ ok: exitCode === 0, errors, warnings, notes }, null, 2));
} else {
  for (const note of notes) console.log(`info: ${note}`);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (exitCode === 0) console.log('business language audit OK');
}
process.exit(exitCode);

