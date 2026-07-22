#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  BUILTIN_OPERATORS,
  SPEC_VERSION,
  collectRulePaths,
  compareUtf16,
  exists,
  finish,
  loadProject,
  parseOptions,
  readJson,
  relative,
  walkFiles
} from './lib/project.mjs';

const options = parseOptions();
const root = path.resolve(process.cwd(), options.rootArg);
const errors = [];
const warnings = [];
const notes = [];
const project = loadProject(root, errors);

function hasTitle(catalog, section, id) {
  return typeof catalog?.[section]?.[id]?.title === 'string' && catalog[section][id].title.trim().length > 0;
}

function hasDescription(catalog, section, id) {
  return typeof catalog?.[section]?.[id]?.description === 'string' && catalog[section][id].description.trim().length > 0;
}

if (project) {
  const { manifest } = project;
  const catalog = manifest.catalog || {};
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

  if (manifest.specVersion !== SPEC_VERSION) {
    errors.push(`manifest.specVersion must be ${SPEC_VERSION}, got ${String(manifest.specVersion)}`);
  }
  if (typeof manifest.project?.version !== 'string' || !semver.test(manifest.project.version)) {
    errors.push('manifest.project.version must be an explicit semantic version');
  }
  if (typeof manifest.project?.id !== 'string' || manifest.project.id.trim().length === 0) {
    errors.push('manifest.project.id must be a non-empty string');
  }

  checkPackageCompatibility(root, errors, warnings);

  const exportsList = manifest.exports;
  if (!Array.isArray(exportsList) || exportsList.length === 0 || exportsList.some((id) => typeof id !== 'string' || id.length === 0)) {
    errors.push('manifest.exports must be a non-empty string array');
  } else {
    if (new Set(exportsList).size !== exportsList.length) errors.push('manifest.exports contains duplicates');
    const sorted = [...exportsList].sort(compareUtf16);
    if (exportsList.some((id, index) => id !== sorted[index])) {
      errors.push('manifest.exports must already be sorted by unsigned UTF-16 code units');
    }
  }

  for (const file of walkFiles(root, (candidate) => path.basename(candidate) === '.DS_Store', new Set(['.git', 'node_modules']))) {
    errors.push(`remove macOS metadata file: ${relative(root, file)}`);
  }

  const usedPayloadPaths = new Set();
  const usedContextPaths = new Set();
  const usedOperators = new Set();
  const customOperators = new Set();
  const issueCodes = new Map();
  const legacyKeys = new Set(['entrypoint', 'flow', 'role', 'strict', 'required_context', 'description']);

  for (const { id, artifact, file, rel } of project.records) {
    const repoRel = relative(root, file);
    if (rel.startsWith('library/') && !id.startsWith('library.')) {
      warnings.push(`${repoRel}: rules/library source usually uses a library.* id, got ${id}`);
    }
    if (rel.startsWith('entrypoints/') && !id.startsWith('entrypoints.')) {
      warnings.push(`${repoRel}: rules/entrypoints source usually uses an entrypoints.* id, got ${id}`);
    }
    if (id.startsWith('library.') && !rel.startsWith('library/')) {
      warnings.push(`${repoRel}: library.* id is outside rules/library`);
    }
    if (id.startsWith('entrypoints.') && !rel.startsWith('entrypoints/')) {
      warnings.push(`${repoRel}: entrypoints.* id is outside rules/entrypoints`);
    }
    if (rel.includes('/dictionaries/') && artifact.type !== 'dictionary') {
      warnings.push(`${repoRel}: file under a dictionaries directory is not a dictionary`);
    }

    for (const key of legacyKeys) {
      if (Object.prototype.hasOwnProperty.call(artifact, key)) errors.push(`${repoRel}: legacy/authoring field ${key} cannot enter an RC.7 artifact`);
    }
    for (const key of ['level', 'code', 'message', 'meta']) {
      if (Object.prototype.hasOwnProperty.call(artifact, key)) errors.push(`${repoRel}: move rule.${key} into rule.issue`);
    }
    if ((artifact.type === 'pipeline' || artifact.type === 'condition') &&
        (!Array.isArray(artifact.steps) || artifact.steps.length === 0 || artifact.steps.some((step) => typeof step !== 'string' || step.length === 0))) {
      errors.push(`${repoRel}: ${artifact.type}.steps must be a non-empty string array`);
    }

    if (artifact.type === 'rule') {
      if (typeof artifact.operator === 'string') {
        usedOperators.add(artifact.operator);
        if (!BUILTIN_OPERATORS.has(artifact.operator)) customOperators.add(artifact.operator);
      }
      for (const field of collectRulePaths(artifact)) {
        if (field.startsWith('$context.')) usedContextPaths.add(field);
        else usedPayloadPaths.add(field);
      }
      if (typeof artifact.value_field === 'string' && artifact.value_field.includes('[*]')) {
        errors.push(`${repoRel}: value_field cannot contain [*]; Spec 1.0.0-rc.7 does not define aligned wildcard comparison`);
      }
      for (const [name, input] of Object.entries(artifact.inputs || {})) {
        if (typeof input === 'string' && input.includes('[*]')) {
          errors.push(`${repoRel}: inputs.${name} cannot contain [*] in Spec 1.0.0-rc.7`);
        }
      }
      for (const field of collectRulePaths(artifact)) {
        if (field.startsWith('$context.') && field.includes('[*]')) {
          errors.push(`${repoRel}: $context paths cannot contain [*] in Spec 1.0.0-rc.7`);
        }
      }
      const code = artifact.issue?.code;
      if (typeof code === 'string' && code.length > 0) {
        if (issueCodes.has(code)) errors.push(`${repoRel}: duplicate issue code ${code}; first seen in ${issueCodes.get(code)}`);
        else issueCodes.set(code, repoRel);
      }
    }

    const visible = artifact.type !== 'dictionary';
    if (visible && !hasTitle(catalog, 'artifacts', id) && !hasTitle(catalog, 'entrypoints', id)) {
      warnings.push(`manifest.catalog.artifacts.${id}.title is missing`);
    }
  }

  for (const id of Array.isArray(exportsList) ? exportsList : []) {
    const record = project.artifacts.get(id);
    if (!record) errors.push(`manifest.exports references missing artifact ${id}`);
    else if (record.artifact.type !== 'pipeline') errors.push(`manifest.exports ${id} must reference a pipeline`);
    if (!hasTitle(catalog, 'entrypoints', id)) errors.push(`manifest.catalog.entrypoints.${id}.title is required`);
    else if (!hasDescription(catalog, 'entrypoints', id)) warnings.push(`manifest.catalog.entrypoints.${id}.description is missing`);
  }

  for (const field of [...usedPayloadPaths].sort(compareUtf16)) {
    if (!hasTitle(catalog, 'fields', field)) errors.push(`manifest.catalog.fields.${field}.title is required`);
    else if (!hasDescription(catalog, 'fields', field)) warnings.push(`manifest.catalog.fields.${field}.description is missing`);
  }
  for (const field of [...usedContextPaths].sort(compareUtf16)) {
    if (!hasTitle(catalog, 'fields', field)) warnings.push(`${field}: context path has no catalog title; document it outside the snapshot`);
  }
  for (const operator of [...customOperators].sort(compareUtf16)) {
    if (!hasDescription(catalog, 'operators', operator)) {
      warnings.push(`custom operator ${operator} needs business-facing authoring metadata`);
    }
  }
  const operatorPacks = manifest.operatorPacks?.node;
  if (operatorPacks !== undefined &&
      (!Array.isArray(operatorPacks) || operatorPacks.some((item) => typeof item !== 'string' || item.length === 0))) {
    errors.push('manifest.operatorPacks.node must be an array of non-empty module specifiers');
  } else if (Array.isArray(operatorPacks) && new Set(operatorPacks).size !== operatorPacks.length) {
    errors.push('manifest.operatorPacks.node contains duplicates');
  }
  if (customOperators.size > 0 && (!Array.isArray(operatorPacks) || operatorPacks.length === 0)) {
    errors.push('custom operators are used but manifest.operatorPacks.node declares no v4 operator pack');
  }

  const sampleFiles = walkFiles(project.samplesDir, (file) => file.endsWith('.json'));
  const sampledExports = new Set();
  for (const file of sampleFiles) {
    let sample;
    try {
      sample = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (typeof sample?.pipelineId === 'string') sampledExports.add(sample.pipelineId);
    if (sample?.context && typeof sample.context.pipelineId === 'string') {
      errors.push(`${relative(root, file)}: move legacy context.pipelineId to top-level pipelineId`);
    }
  }
  for (const id of Array.isArray(exportsList) ? exportsList : []) {
    if (!sampledExports.has(id)) warnings.push(`export ${id} has no sample with top-level pipelineId`);
  }

  const docs = [
    ...walkFiles(root, (file) => path.basename(file).toLowerCase() === 'readme.md', new Set(['.git', 'node_modules', 'dist'])),
    ...walkFiles(project.docsDir, (file) => file.endsWith('.md'))
  ];
  const stalePatterns = [
    [/formatVersion\s*[`:" ]+1\b/, 'formatVersion 1'],
    [/engine\.minVersion|"engine"\s*:/, 'snapshot engine metadata'],
    [/"required_context"\s*:/, 'required_context artifact field'],
    [/"control"\s*:/, 'runtime control field'],
    [/\bctx\.(?:get|has)\(/, 'legacy custom-operator ctx access']
  ];
  for (const file of new Set(docs)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const [pattern, label] of stalePatterns) {
      if (pattern.test(text)) warnings.push(`${relative(root, file)}: review stale Rules 2.x marker (${label})`);
    }
  }

  notes.push(`specVersion: ${manifest.specVersion}`);
  notes.push(`artifacts: ${project.records.length}`);
  notes.push(`exports: ${Array.isArray(exportsList) ? exportsList.length : 0}`);
  notes.push(`payload paths: ${usedPayloadPaths.size}`);
  notes.push(`context paths: ${usedContextPaths.size}`);
  notes.push(`custom operators: ${customOperators.size}`);
}

process.exitCode = finish({
  errors,
  warnings,
  notes,
  json: options.json,
  strict: options.strict,
  successMessage: 'manifest and authoring coverage audit OK'
});

function checkPackageCompatibility(projectRoot, targetErrors, targetWarnings) {
  const packageFile = path.join(projectRoot, 'package.json');
  if (!exists(packageFile)) {
    targetErrors.push('package.json is required for a Rules v4 authoring project');
    return;
  }
  const packageJson = readJson(packageFile, targetErrors, projectRoot);
  if (!packageJson) return;

  checkDeclaredMajor(packageJson.dependencies?.['@jsonspecs/rules'], '@jsonspecs/rules', 4, targetErrors, targetWarnings);
  const cliRange = packageJson.devDependencies?.['jsonspecs-cli'] ?? packageJson.dependencies?.['jsonspecs-cli'];
  checkDeclaredMajor(cliRange, 'jsonspecs-cli', 4, targetErrors, targetWarnings);
  if (typeof packageJson.engines?.node !== 'string' || packageJson.engines.node.length === 0) {
    targetWarnings.push('package.json engines.node should declare the Node.js 20+ runtime boundary');
  }

  const lockFile = path.join(projectRoot, 'package-lock.json');
  if (!exists(lockFile)) {
    targetErrors.push('package-lock.json is required to pin Rules v4 and CLI v4 exactly');
    return;
  }
  const lock = readJson(lockFile, targetErrors, projectRoot);
  if (!lock) return;
  for (const name of ['@jsonspecs/rules', 'jsonspecs-cli']) {
    const installed = lock.packages?.[`node_modules/${name}`]?.version ?? lock.dependencies?.[name]?.version;
    if (majorOf(installed) !== 4) {
      targetErrors.push(`package-lock.json must pin ${name} major 4, got ${String(installed)}`);
    }
  }
}

function checkDeclaredMajor(range, name, expected, targetErrors, targetWarnings) {
  if (typeof range !== 'string' || range.length === 0) {
    targetErrors.push(`package.json must declare ${name}`);
    return;
  }
  const major = majorOf(range);
  if (major === null) {
    targetWarnings.push(`cannot prove ${name} major ${expected} from dependency specifier ${range}`);
  } else if (major !== expected) {
    targetErrors.push(`package.json must target ${name} major ${expected}, got ${range}`);
  }
}

function majorOf(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/(?:^|[^0-9])(\d+)\.(?:\d+)\.(?:\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}
