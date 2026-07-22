#!/usr/bin/env node
import path from 'node:path';
import {
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
const statuses = ['OK', 'OK_WITH_WARNINGS', 'ERROR', 'EXCEPTION', 'ABORT'];
const matrix = {};

if (project) {
  const exportsList = Array.isArray(project.manifest.exports) ? project.manifest.exports : [];
  for (const id of exportsList) {
    matrix[id] = { total: 0, OK: 0, OK_WITH_WARNINGS: 0, ERROR: 0, EXCEPTION: 0, ABORT: 0 };
  }

  let sampleCount = 0;
  for (const file of walkFiles(project.samplesDir, (candidate) => candidate.endsWith('.json'))) {
    sampleCount += 1;
    const sample = readJson(file, errors, root);
    const label = relative(root, file);
    if (sample === undefined) continue;
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
      errors.push(`${label}: sample must be one JSON object`);
      continue;
    }
    if (sample.context && Object.prototype.hasOwnProperty.call(sample.context, 'pipelineId')) {
      errors.push(`${label}: context.pipelineId is legacy; use top-level pipelineId`);
    }
    if (typeof sample.pipelineId !== 'string' || sample.pipelineId.length === 0) {
      errors.push(`${label}: sample.pipelineId must be a non-empty string`);
      continue;
    }
    const status = sample.expect?.status;
    if (!statuses.includes(status)) {
      errors.push(`${label}: expect.status must be one of ${statuses.join(', ')}`);
      continue;
    }
    if (!Array.isArray(sample.expect?.issues)) errors.push(`${label}: expect.issues must be an array`);

    const row = matrix[sample.pipelineId];
    if (!row) {
      if (status !== 'ABORT') warnings.push(`${label}: sample references non-exported pipeline ${sample.pipelineId}`);
      continue;
    }
    row.total += 1;
    row[status] += 1;
  }

  for (const [id, row] of Object.entries(matrix)) {
    if (row.total === 0) warnings.push(`${id}: no samples`);
    if (row.OK === 0) warnings.push(`${id}: no OK sample`);
    if (row.OK_WITH_WARNINGS + row.ERROR + row.EXCEPTION === 0) {
      warnings.push(`${id}: no business failure, warning, or exception sample`);
    }
  }

  notes.push(`exports: ${exportsList.length}`);
  notes.push(`sample files: ${sampleCount}`);
}

process.exitCode = finish({
  errors,
  warnings,
  notes,
  json: options.json,
  strict: options.strict,
  successMessage: 'Rules v3 sample matrix audit OK',
  extra: { matrix }
});
