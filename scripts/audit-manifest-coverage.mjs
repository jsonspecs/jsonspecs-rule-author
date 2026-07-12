#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const BUILTIN_OPERATORS = new Set([
  'not_empty',
  'is_empty',
  'equals',
  'not_equals',
  'matches_regex',
  'length_equals',
  'length_max',
  'contains',
  'greater_than',
  'less_than',
  'in_dictionary',
  'any_filled',
  'field_equals_field',
  'field_not_equals_field',
  'field_less_than_field',
  'field_greater_than_field',
  'field_less_or_equal_than_field',
  'field_greater_or_equal_than_field'
]);

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

function error(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function note(message) {
  notes.push(message);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (cause) {
    error(`${path.relative(root, file)}: cannot parse JSON: ${cause.message}`);
    return null;
  }
}

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

function walkFiles(dir, predicate = () => true, ignoredNames = new Set(['.git', 'node_modules'])) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, predicate, ignoredNames));
    } else if (entry.isFile() && predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function catalogTitle(catalog, section, id) {
  const item = catalog?.[section]?.[id];
  return typeof item?.title === 'string' && item.title.trim().length > 0;
}

function catalogDescription(catalog, section, id) {
  const item = catalog?.[section]?.[id];
  return typeof item?.description === 'string' && item.description.trim().length > 0;
}

function collectRuleFields(artifact) {
  const fields = new Set();
  if (typeof artifact.field === 'string') fields.add(artifact.field);
  if (typeof artifact.value_field === 'string') fields.add(artifact.value_field);
  if (Array.isArray(artifact.fields)) {
    for (const field of artifact.fields) {
      if (typeof field === 'string') fields.add(field);
    }
  }
  return fields;
}

function isContextField(field) {
  return field === '$context' || field.startsWith('$context.');
}

function inspectOperatorPackText(projectRoot, manifest) {
  const specs = manifest?.operatorPacks?.node;
  if (!Array.isArray(specs)) return '';
  return specs
    .filter((spec) => typeof spec === 'string')
    .map((spec) => path.resolve(projectRoot, spec))
    .filter((fileOrDir) => exists(fileOrDir))
    .flatMap((fileOrDir) => {
      const stat = fs.statSync(fileOrDir);
      if (stat.isDirectory()) return walkFiles(fileOrDir, (file) => file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs'));
      return [fileOrDir];
    })
    .map((file) => {
      try {
        return fs.readFileSync(file, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
}

function samplePipelineIds(samplesDir) {
  const ids = new Set();
  const sampleFiles = walkFiles(samplesDir, (file) => file.endsWith('.json'));
  for (const file of sampleFiles) {
    const sample = readJson(file);
    const pipelineId = sample?.context?.pipelineId || sample?.pipelineId;
    if (typeof pipelineId === 'string' && pipelineId.length > 0) ids.add(pipelineId);
  }
  return { ids, count: sampleFiles.length };
}

function main() {
  const manifestFile = path.join(root, 'manifest.json');
  if (!exists(manifestFile)) {
    error(`manifest.json not found in ${root}`);
    return finish();
  }

  const manifest = readJson(manifestFile);
  if (!manifest) return finish();

  const catalog = manifest.catalog || {};
  const rulesDir = path.resolve(root, manifest.paths?.rules || './rules');
  const samplesDir = path.resolve(root, manifest.paths?.samples || './samples');
  const docsDir = path.resolve(root, manifest.paths?.docs || './docs');

  if (!exists(rulesDir)) error(`rules directory not found: ${path.relative(root, rulesDir)}`);

  for (const file of walkFiles(root, (candidate) => path.basename(candidate) === '.DS_Store')) {
    error(`remove macOS metadata file: ${path.relative(root, file)}`);
  }

  const artifactFiles = walkFiles(rulesDir, (file) => file.endsWith('.json'));
  const artifacts = [];

  for (const file of artifactFiles) {
    const rel = path.relative(rulesDir, file).split(path.sep).join('/');
    const parsed = readJson(file);
    for (const artifact of asArray(parsed)) {
      if (!artifact || typeof artifact !== 'object') continue;
      if (typeof artifact.id !== 'string' || artifact.id.length === 0) {
        error(`${path.relative(root, file)}: artifact id is required`);
        continue;
      }
      artifacts.push({ artifact, file, rel });
    }
  }

  const usedFields = new Set();
  const contextFields = new Set();
  const usedOperators = new Set();
  const customOperators = new Set();
  const entrypoints = [];

  for (const { artifact, file, rel } of artifacts) {
    const repoRel = path.relative(root, file).split(path.sep).join('/');

    if (rel.startsWith('library/') && !artifact.id.startsWith('library.')) {
      error(`${repoRel}: artifact in rules/library must use library.* id, got ${artifact.id}`);
    }
    if (rel.startsWith('entrypoints/') && !artifact.id.startsWith('entrypoints.')) {
      error(`${repoRel}: artifact in rules/entrypoints must use entrypoints.* id, got ${artifact.id}`);
    }
    if (artifact.id.startsWith('library.') && !rel.startsWith('library/')) {
      warn(`${repoRel}: library.* artifact is outside rules/library`);
    }
    if (artifact.id.startsWith('entrypoints.') && !rel.startsWith('entrypoints/')) {
      warn(`${repoRel}: entrypoints.* artifact is outside rules/entrypoints`);
    }
    if (rel.startsWith('dictionaries/') && artifact.type !== 'dictionary') {
      warn(`${repoRel}: file under rules/dictionaries is not a dictionary artifact`);
    }

    if (artifact.type === 'pipeline' && artifact.entrypoint === true) {
      entrypoints.push(artifact.id);
      if (!catalogTitle(catalog, 'entrypoints', artifact.id)) {
        error(`manifest.catalog.entrypoints.${artifact.id}.title is required`);
      }
    }

    if (artifact.type === 'rule') {
      if (typeof artifact.operator === 'string') {
        usedOperators.add(artifact.operator);
        if (!BUILTIN_OPERATORS.has(artifact.operator)) customOperators.add(artifact.operator);
      }
      for (const field of collectRuleFields(artifact)) {
        if (isContextField(field)) contextFields.add(field);
        else usedFields.add(field);
      }
    }

    if (artifact.type !== 'dictionary' && !catalogTitle(catalog, 'artifacts', artifact.id) && !catalogTitle(catalog, 'entrypoints', artifact.id)) {
      warn(`manifest.catalog.artifacts.${artifact.id}.title is missing; Studio may fall back to description or id`);
    }
  }

  for (const field of [...usedFields].sort()) {
    if (!catalogTitle(catalog, 'fields', field)) {
      error(`manifest.catalog.fields.${field}.title is required`);
    } else if (!catalogDescription(catalog, 'fields', field)) {
      warn(`manifest.catalog.fields.${field}.description is missing`);
    }
  }

  for (const field of [...contextFields].sort()) {
    warn(`${field}: context field used by rules; document it in entrypoint required_context or project docs`);
  }

  const operatorPackText = inspectOperatorPackText(root, manifest);
  for (const operator of [...customOperators].sort()) {
    const hasCatalogDescription = catalogDescription(catalog, 'operators', operator);
    const appearsInPack = operatorPackText.includes(operator);
    if (!hasCatalogDescription && !operatorPackText.includes(`${operator}:`) && !operatorPackText.includes(`${operator}(`)) {
      warn(`custom operator ${operator} has no manifest.catalog.operators description and was not found textually in operator packs`);
    } else if (!hasCatalogDescription) {
      warn(`custom operator ${operator} is used; ensure operator-pack meta.operators documents it`);
    }
    if (!appearsInPack) {
      warn(`custom operator ${operator} is used but was not found textually in configured operator pack files`);
    }
  }

  const samples = samplePipelineIds(samplesDir);
  if (entrypoints.length > 0 && samples.count === 0) {
    warn('no samples/*.json files found');
  }
  for (const entrypoint of entrypoints) {
    if (!samples.ids.has(entrypoint)) {
      warn(`entrypoint ${entrypoint} has no sample with context.pipelineId`);
    }
  }

  const docs = [
    ...walkFiles(root, (file) => path.basename(file).toLowerCase() === 'readme.md', new Set(['.git', 'node_modules', 'dist'])),
    ...walkFiles(docsDir, (file) => file.endsWith('.md'))
  ];
  for (const file of [...new Set(docs)]) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('expected: DEFECT')) {
      warn(`${path.relative(root, file)}: contains stale marker "expected: DEFECT"`);
    }
    if (/\b7009\b/.test(text)) {
      warn(`${path.relative(root, file)}: contains numeric example "7009"; verify it still matches current rules`);
    }
  }

  note(`artifacts: ${artifacts.length}`);
  note(`entrypoints: ${entrypoints.length}`);
  note(`used payload fields: ${usedFields.size}`);
  note(`custom operators used: ${customOperators.size}`);

  finish();
}

function finish() {
  const exitCode = errors.length > 0 || (options.strict && warnings.length > 0) ? 1 : 0;
  if (options.json) {
    console.log(JSON.stringify({ ok: exitCode === 0, errors, warnings, notes }, null, 2));
  } else {
    for (const message of notes) console.log(`info: ${message}`);
    for (const message of warnings) console.warn(`warning: ${message}`);
    for (const message of errors) console.error(`error: ${message}`);
    if (exitCode === 0) console.log('jsonspecs package audit OK');
  }
  process.exit(exitCode);
}

main();
