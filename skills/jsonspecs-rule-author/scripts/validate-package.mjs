#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  createSnapshot,
  exists,
  finish,
  loadOperatorRegistry,
  loadProject,
  loadRuntime,
  parseOptions,
  readJson,
  relative,
  walkFiles
} from './lib/project.mjs';

const options = parseOptions();
const root = path.resolve(process.cwd(), options.rootArg);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const errors = [];
const warnings = [];
const notes = [];
const auditScripts = [
  'audit-manifest-coverage.mjs',
  'audit-rule-graph.mjs',
  'audit-guard-order.mjs',
  'audit-business-language.mjs',
  'audit-sample-matrix.mjs'
];

for (const script of auditScripts) {
  const result = spawnSync(process.execPath, [path.join(scriptDir, script), root, '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    errors.push(`${script}: audit did not return JSON${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
    continue;
  }
  appendAuditMessages(errors, script, report.errors || []);
  appendAuditMessages(warnings, script, report.warnings || []);
  notes.push(`${script}: ${report.ok ? 'OK' : 'issues found'}`);
}

if (options.static) {
  notes.push('static mode: project JavaScript was not loaded and samples were not executed');
} else {
  runDynamicValidation();
}

function runDynamicValidation() {
  notes.push('dynamic mode: installed runtime and project operator modules are loaded and executed as trusted code');
  const projectErrors = [];
  const project = loadProject(root, projectErrors);
  errors.push(...projectErrors.map((message) => `runtime build: ${message}`));

if (project && projectErrors.length === 0) {
  try {
    const runtime = loadRuntime(project);
    const operators = loadOperatorRegistry(project, runtime);
    const snapshot = createSnapshot(project, runtime);
    const engine = runtime.createEngine({ operators });
    const prepared = engine.compileSnapshot(snapshot);
    const inspector = engine.inspect(prepared);

    notes.push(`@jsonspecs/rules: ${runtime.version}`);
    notes.push(`specVersion: ${snapshot.specVersion}`);
    notes.push(`sourceHash: ${snapshot.sourceHash}`);
    notes.push(`compiled artifacts: ${inspector.stats().artifacts}`);
    notes.push(`custom operators loaded: ${Object.keys(operators).length}`);

    let sampleCount = 0;
    for (const file of walkFiles(project.samplesDir, (candidate) => candidate.endsWith('.json'))) {
      const sampleErrors = [];
      const sample = readJson(file, sampleErrors, root);
      errors.push(...sampleErrors.map((message) => `sample: ${message}`));
      if (sample === undefined) continue;
      if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
        errors.push(`${relative(root, file)}: sample must be one JSON object`);
        continue;
      }
      if (!sample.expect) {
        errors.push(`${relative(root, file)}: sample.expect is required`);
        continue;
      }
      sampleCount += 1;
      const input = {
        pipelineId: sample.pipelineId,
        payload: sample.payload
      };
      if (Object.prototype.hasOwnProperty.call(sample, 'context')) input.context = sample.context;
      const actual = engine.runPipeline(prepared, input);
      const label = relative(root, file);

      if (sample.expect.status !== actual.status) {
        errors.push(`${label}: expected status ${String(sample.expect.status)}, got ${actual.status}`);
      }
      const expectedIssues = Array.isArray(sample.expect.issues) ? sample.expect.issues : [];
      if (expectedIssues.length !== actual.issues.length) {
        errors.push(`${label}: expected ${expectedIssues.length} issues, got ${actual.issues.length}`);
      }
      for (let index = 0; index < Math.min(expectedIssues.length, actual.issues.length); index += 1) {
        const expected = expectedIssues[index];
        const got = actual.issues[index];
        if (!isObjectSubset(expected, got)) {
          errors.push(`${label}: issue ${index} does not match expected projection ${JSON.stringify(expected)}; got ${JSON.stringify(got)}`);
        }
      }
      if (sample.expect.error !== undefined && !isObjectSubset(sample.expect.error, actual.error)) {
        errors.push(`${label}: runtime error does not match expected projection`);
      }
      if (sample.expect.ruleset !== undefined && !isObjectSubset(sample.expect.ruleset, actual.ruleset)) {
        errors.push(`${label}: ruleset does not match expected projection`);
      }
    }
    notes.push(`samples executed: ${sampleCount}`);

    const snapshotName = project.manifest.build?.snapshotFile || 'snapshot.json';
    const distSnapshotFile = path.join(project.distDir, snapshotName);
    if (exists(distSnapshotFile)) {
      const distErrors = [];
      const checkedIn = readJson(distSnapshotFile, distErrors, root);
      errors.push(...distErrors.map((message) => `dist: ${message}`));
      if (checkedIn && !isDeepStrictEqual(checkedIn, snapshot)) {
        errors.push(`${relative(root, distSnapshotFile)} is stale or differs from the in-memory Rules v3 build`);
      } else if (checkedIn) {
        notes.push(`${relative(root, distSnapshotFile)} matches the in-memory build`);
      }
    } else {
      warnings.push(`${relative(root, distSnapshotFile)} is missing; no distribution snapshot was compared`);
    }

    const buildInfoName = project.manifest.build?.buildInfoFile || 'build-info.json';
    const buildInfoFile = path.join(project.distDir, buildInfoName);
    if (exists(buildInfoFile)) {
      const infoErrors = [];
      const info = readJson(buildInfoFile, infoErrors, root);
      errors.push(...infoErrors.map((message) => `build info: ${message}`));
      if (info) {
        const label = relative(root, buildInfoFile);
        checkBuildInfo(errors, label, 'project.id', info.project?.id, project.manifest.project?.id);
        checkBuildInfo(errors, label, 'project.version', info.project?.version, project.manifest.project?.version);
        checkBuildInfo(errors, label, 'runtime.package', info.runtime?.package, '@jsonspecs/rules');
        checkBuildInfo(errors, label, 'runtime.version', info.runtime?.version, runtime.version);
        checkBuildInfo(errors, label, 'specVersion', info.specVersion, snapshot.specVersion);
        checkBuildInfo(errors, label, 'sourceHash', info.sourceHash, snapshot.sourceHash);
        checkBuildInfo(errors, label, 'exports', info.exports, snapshot.exports);
        checkBuildInfo(errors, label, 'artifactCount', info.artifactCount, Object.keys(snapshot.artifacts).length);
        checkBuildInfo(errors, label, 'operators', info.operators, Object.keys(operators).sort());
      }
    } else {
      warnings.push(`${relative(root, buildInfoFile)} is missing; build identity was not verified`);
    }
  } catch (cause) {
    const diagnostics = Array.isArray(cause?.diagnostics)
      ? `: ${cause.diagnostics.map((item) => `${item.code}${item.artifactId ? `(${item.artifactId})` : ''}`).join(', ')}`
      : '';
    errors.push(`Rules v3 compilation failed: ${cause.message}${diagnostics}`);
  }
}
}

const uniqueErrors = [...new Set(errors)];
const uniqueWarnings = [...new Set(warnings)];
process.exitCode = finish({
  errors: uniqueErrors,
  warnings: uniqueWarnings,
  notes,
  json: options.json,
  strict: options.strict,
  successMessage: 'jsonspecs Rules v3 package validation OK'
});

function isObjectSubset(expected, actual) {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) return isDeepStrictEqual(expected, actual);
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  return Object.entries(expected).every(([key, value]) => isDeepStrictEqual(actual[key], value));
}

function appendAuditMessages(target, script, messages, limit = 100) {
  for (const message of messages.slice(0, limit)) target.push(`${script}: ${message}`);
  if (messages.length > limit) target.push(`${script}: ${messages.length - limit} additional messages omitted`);
}

function checkBuildInfo(target, label, field, actual, expected) {
  if (actual === undefined) {
    target.push(`${label}: required derived field ${field} is missing`);
  } else if (!isDeepStrictEqual(actual, expected)) {
    target.push(`${label}: ${field} does not match the current project build`);
  }
}
