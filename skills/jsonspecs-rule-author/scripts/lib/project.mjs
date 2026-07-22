import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export const SPEC_VERSION = '1.0.0-rc.5';
export const BUILTIN_OPERATORS = new Set([
  'not_empty',
  'is_empty',
  'not_true',
  'any_filled',
  'is_boolean',
  'is_string',
  'is_number',
  'is_integer',
  'equals',
  'not_equals',
  'contains',
  'matches_regex',
  'not_matches_regex',
  'greater_than',
  'less_than',
  'length_equals',
  'length_max',
  'field_equals_field',
  'field_not_equals_field',
  'field_greater_than_field',
  'field_less_than_field',
  'field_greater_or_equal_than_field',
  'field_less_or_equal_than_field',
  'in_dictionary',
  'not_in_dictionary'
]);

export function parseOptions(argv = process.argv.slice(2)) {
  return {
    rootArg: argv.find((arg) => !arg.startsWith('--')) || '.',
    json: argv.includes('--json'),
    strict: argv.includes('--strict'),
    static: argv.includes('--static')
  };
}

export function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

export function compareUtf16(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

export function walkFiles(dir, predicate = () => true, ignoredNames = new Set(['.git', 'node_modules', 'dist'])) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, predicate, ignoredNames));
    else if (entry.isFile() && predicate(full)) out.push(full);
  }
  return out.sort(compareUtf16);
}

export function readJson(file, errors, root) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (cause) {
    errors.push(`${relative(root, file)}: cannot parse JSON: ${cause.message}`);
    return undefined;
  }
}

export function loadProject(root, errors) {
  const manifestFile = path.join(root, 'manifest.json');
  if (!exists(manifestFile)) {
    errors.push(`manifest.json not found in ${root}`);
    return null;
  }

  const manifest = readJson(manifestFile, errors, root);
  if (manifest === undefined) return null;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('manifest.json must contain one JSON object');
    return null;
  }

  const rulesDir = path.resolve(root, manifest.paths?.rules || './rules');
  const samplesDir = path.resolve(root, manifest.paths?.samples || './samples');
  const docsDir = path.resolve(root, manifest.paths?.docs || './docs');
  const distDir = path.resolve(root, manifest.paths?.dist || './dist');
  const records = [];
  const artifacts = new Map();

  if (!exists(rulesDir)) errors.push(`rules directory not found: ${relative(root, rulesDir)}`);

  for (const file of walkFiles(rulesDir, (candidate) => candidate.endsWith('.json'))) {
    const artifact = readJson(file, errors, root);
    if (artifact === undefined) continue;
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      errors.push(`${relative(root, file)}: source artifact must be one JSON object`);
      continue;
    }
    if (typeof artifact.id !== 'string' || artifact.id.length === 0) {
      errors.push(`${relative(root, file)}: source artifact id must be a non-empty string`);
      continue;
    }
    if (artifacts.has(artifact.id)) {
      errors.push(`${relative(root, file)}: duplicate artifact id ${artifact.id}; first seen in ${relative(root, artifacts.get(artifact.id).file)}`);
      continue;
    }
    const record = {
      id: artifact.id,
      artifact,
      file,
      rel: relative(rulesDir, file)
    };
    records.push(record);
    artifacts.set(artifact.id, record);
  }

  records.sort((left, right) => compareUtf16(left.id, right.id));
  return { root, manifestFile, manifest, rulesDir, samplesDir, docsDir, distDir, records, artifacts };
}

export function collectRulePaths(rule) {
  const paths = new Set();
  if (typeof rule?.field === 'string') paths.add(rule.field);
  if (typeof rule?.value_field === 'string') paths.add(rule.value_field);
  for (const field of Array.isArray(rule?.fields) ? rule.fields : []) {
    if (typeof field === 'string') paths.add(field);
  }
  for (const input of Object.values(rule?.inputs || {})) {
    if (typeof input === 'string') paths.add(input);
  }
  return paths;
}

export function whenRefs(when, out = new Set()) {
  if (typeof when === 'string') {
    out.add(when);
    return out;
  }
  if (!when || typeof when !== 'object' || Array.isArray(when)) return out;
  if (Object.prototype.hasOwnProperty.call(when, 'not')) whenRefs(when.not, out);
  for (const child of when.all || when.any || []) whenRefs(child, out);
  return out;
}

export function artifactRefs(artifact) {
  const refs = new Set();
  for (const step of Array.isArray(artifact?.steps) ? artifact.steps : []) {
    if (typeof step === 'string') refs.add(step);
  }
  for (const ref of whenRefs(artifact?.when)) refs.add(ref);
  if (typeof artifact?.dictionary === 'string') refs.add(artifact.dictionary);
  return refs;
}

export function reachableIds(project, rootId) {
  const reachable = new Set();
  const pending = [rootId];
  while (pending.length > 0) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    const artifact = project.artifacts.get(id)?.artifact;
    if (!artifact) continue;
    for (const ref of artifactRefs(artifact)) pending.push(ref);
  }
  return reachable;
}

export function sourceArtifactsObject(project) {
  const entries = project.records.map(({ id, artifact }) => {
    const { id: ignored, ...value } = artifact;
    return [id, value];
  });
  return Object.fromEntries(entries.sort(([left], [right]) => compareUtf16(left, right)));
}

export function createSnapshot(project, runtime) {
  const snapshot = {
    format: 'jsonspecs-snapshot',
    formatVersion: 2,
    specVersion: project.manifest.specVersion,
    exports: Array.isArray(project.manifest.exports) ? [...project.manifest.exports] : project.manifest.exports,
    artifacts: sourceArtifactsObject(project)
  };
  snapshot.sourceHash = runtime.computeSourceHash(snapshot);
  return snapshot;
}

export function loadRuntime(project) {
  const packageAnchor = exists(path.join(project.root, 'package.json'))
    ? path.join(project.root, 'package.json')
    : path.join(project.root, '__jsonspecs_rule_author__.js');
  const requireFromProject = createRequire(packageAnchor);
  let runtime;
  let runtimePackage;
  try {
    runtime = requireFromProject('@jsonspecs/rules');
    runtimePackage = requireFromProject('@jsonspecs/rules/package.json');
  } catch (cause) {
    throw new Error(`cannot resolve project @jsonspecs/rules: ${cause.message}`);
  }

  const major = Number.parseInt(String(runtimePackage.version || '').split('.')[0], 10);
  if (major !== 3) throw new Error(`@jsonspecs/rules ${runtimePackage.version || '<unknown>'} is not Rules v3`);
  for (const name of ['createEngine', 'computeSourceHash']) {
    if (typeof runtime[name] !== 'function') throw new Error(`@jsonspecs/rules v3 API is missing ${name}`);
  }

  return { ...runtime, version: runtimePackage.version, requireFromProject };
}

export function loadOperatorRegistry(project, runtime) {
  let specs = project.manifest.operatorPacks?.node;
  if (specs !== undefined && !Array.isArray(specs)) {
    throw new Error('manifest.operatorPacks.node must be an array when present');
  }
  if (specs === undefined) {
    const conventional = path.join(project.root, 'operators', 'node');
    specs = exists(conventional) ? [conventional] : [];
  }

  const registry = Object.create(null);
  for (const spec of specs) {
    if (typeof spec !== 'string' || spec.length === 0) throw new Error('operator pack path must be a non-empty string');
    const request = spec.startsWith('.') || path.isAbsolute(spec) ? path.resolve(project.root, spec) : spec;
    let loaded;
    try {
      loaded = runtime.requireFromProject(request);
    } catch (cause) {
      throw new Error(`cannot load operator pack ${spec}: ${cause.message}`);
    }
    if (loaded?.check || loaded?.predicate) {
      throw new Error(`operator pack ${spec} uses the legacy {check,predicate} contract`);
    }
    const candidate = loaded?.operators && typeof loaded.operators === 'object' ? loaded.operators : loaded;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error(`operator pack ${spec} must export name -> {schema,evaluate}`);
    }
    for (const [name, definition] of Object.entries(candidate)) {
      if (!name || !definition || typeof definition !== 'object' || typeof definition.evaluate !== 'function' || !definition.schema) {
        throw new Error(`operator pack ${spec}: ${name || '<empty>'} must be {schema,evaluate}`);
      }
      if (Object.prototype.hasOwnProperty.call(registry, name)) throw new Error(`duplicate custom operator ${name}`);
      registry[name] = definition;
    }
  }
  return registry;
}

export function finish({ errors, warnings, notes, json, strict, successMessage, extra = {} }) {
  const exitCode = errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0;
  if (json) {
    console.log(JSON.stringify({ ok: exitCode === 0, errors, warnings, notes, ...extra }, null, 2));
  } else {
    for (const message of notes) console.log(`info: ${message}`);
    for (const message of warnings) console.warn(`warning: ${message}`);
    for (const message of errors) console.error(`error: ${message}`);
    if (exitCode === 0) console.log(successMessage);
  }
  return exitCode;
}
