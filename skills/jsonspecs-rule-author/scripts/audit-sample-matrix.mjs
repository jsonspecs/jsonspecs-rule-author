#!/usr/bin/env node
import path from 'node:path';
import {
  finish,
  loadProject,
  parseOptions,
  reachableIds,
  readJson,
  relative,
  resolveSamplePath,
  walkFiles,
  whenRefs
} from './lib/project.mjs';

const options = parseOptions();
const root = path.resolve(process.cwd(), options.rootArg);
const errors = [];
const warnings = [];
const notes = [];
const project = loadProject(root, errors);
const statuses = ['OK', 'OK_WITH_WARNINGS', 'ERROR', 'EXCEPTION', 'ABORT'];
const coverageClasses = new Set([
  'absence',
  'null',
  'empty_string',
  'wrong_type',
  'unsupported_dictionary',
  'empty_collection',
  'missing_collection_member',
  'mixed_collection',
  'unsupported_branch'
]);
const presenceOperators = new Set(['not_empty', 'any_filled']);
const typeOperators = new Set(['is_boolean', 'is_string', 'is_number', 'is_integer']);
const matrix = {};

if (project) {
  const exportsList = Array.isArray(project.manifest.exports) ? project.manifest.exports : [];
  const coverageByExport = new Map();

  for (const id of exportsList) {
    const executableRules = executableRuleIds(project, id);
    const rules = [...executableRules]
      .map((ruleId) => project.artifacts.get(ruleId)?.artifact)
      .filter(Boolean);
    const reachableCodes = new Set(rules
      .map((rule) => rule.issue?.code)
      .filter((code) => typeof code === 'string' && code.length > 0));
    const unsupportedBranches = unsupportedBranchCases(project, id, rules);
    const applicableClasses = applicableCoverageClasses(rules, unsupportedBranches);
    coverageByExport.set(id, {
      rules,
      reachableCodes,
      coveredCodes: new Set(),
      excludedCodes: new Set(),
      applicableClasses,
      coveredClasses: new Set(),
      unsupportedBranches
    });
    matrix[id] = {
      total: 0,
      OK: 0,
      OK_WITH_WARNINGS: 0,
      ERROR: 0,
      EXCEPTION: 0,
      ABORT: 0,
      issueCodes: {},
      boundaryClasses: {}
    };
  }

  validateExclusions(project, coverageByExport, errors, warnings);

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
    const coverage = coverageByExport.get(sample.pipelineId);
    if (!row || !coverage) {
      if (status !== 'ABORT') warnings.push(`${label}: sample references non-exported pipeline ${sample.pipelineId}`);
      continue;
    }
    row.total += 1;
    row[status] += 1;

    const expectedIssues = Array.isArray(sample.expect?.issues) ? sample.expect.issues : [];
    const expectedCodeCounts = new Map();
    for (const issue of expectedIssues) {
      if (typeof issue?.code !== 'string' || issue.code.length === 0) continue;
      expectedCodeCounts.set(issue.code, (expectedCodeCounts.get(issue.code) || 0) + 1);
      if (!coverage.reachableCodes.has(issue.code)) {
        errors.push(`${label}: expected issue code ${issue.code} is not reachable as an issue-producing rule from ${sample.pipelineId}`);
      } else {
        coverage.coveredCodes.add(issue.code);
      }
    }

    inferRuleCoverage(sample, coverage, expectedCodeCounts);
    inferCollectionCoverage(sample, coverage);

    if (sample.coverage !== undefined && !Array.isArray(sample.coverage)) {
      errors.push(`${label}: sample.coverage must be an array of coverage class names`);
    }
    for (const name of Array.isArray(sample.coverage) ? sample.coverage : []) {
      if (typeof name !== 'string' || !coverageClasses.has(name)) {
        errors.push(`${label}: unknown sample coverage class ${JSON.stringify(name)}`);
      } else if (!coverage.applicableClasses.has(name)) {
        warnings.push(`${label}: coverage class ${name} is not applicable to ${sample.pipelineId}`);
      } else {
        coverage.coveredClasses.add(name);
      }
    }
  }

  const globallyReachableCodes = union(...[...coverageByExport.values()].map((coverage) => coverage.reachableCodes));
  const globallyCoveredCodes = union(...[...coverageByExport.values()].map((coverage) => coverage.coveredCodes));
  const globallyExcludedCodes = union(...[...coverageByExport.values()].map((coverage) => coverage.excludedCodes));
  const globallyApplicableClasses = union(...[...coverageByExport.values()].map((coverage) => coverage.applicableClasses));
  const globallyCoveredClasses = union(...[...coverageByExport.values()].map((coverage) => coverage.coveredClasses));

  for (const [id, row] of Object.entries(matrix)) {
    const coverage = coverageByExport.get(id);
    if (row.total === 0) warnings.push(`${id}: no samples`);
    if (row.OK === 0) warnings.push(`${id}: no OK sample`);
    if (row.OK_WITH_WARNINGS + row.ERROR + row.EXCEPTION === 0) {
      warnings.push(`${id}: no business failure, warning, or exception sample`);
    }

    for (const code of coverage.excludedCodes) {
      if (globallyCoveredCodes.has(code)) warnings.push(`${id}: issue code exclusion ${code} is stale because a sample covers it`);
    }

    row.issueCodes = summarizeCoverage(coverage.reachableCodes, globallyCoveredCodes, globallyExcludedCodes);
    row.issueCodes.coveredByOwnSamples = [...coverage.coveredCodes].sort();
    row.boundaryClasses = summarizeCoverage(coverage.applicableClasses, globallyCoveredClasses, new Set());
  }

  const missingCodes = difference(globallyReachableCodes, globallyCoveredCodes, globallyExcludedCodes);
  if (missingCodes.length > 0) {
    warnings.push(`reachable issue codes without sample coverage or a documented exclusion: ${missingCodes.join(', ')}`);
  }
  const missingClasses = difference(globallyApplicableClasses, globallyCoveredClasses);
  if (missingClasses.length > 0) warnings.push(`boundary coverage classes without evidence: ${missingClasses.join(', ')}`);

  notes.push(`exports: ${exportsList.length}`);
  notes.push(`sample files: ${sampleCount}`);
}

process.exitCode = finish({
  errors,
  warnings,
  notes,
  json: options.json,
  strict: options.strict,
  successMessage: 'Rules v4 sample matrix audit OK',
  extra: { matrix }
});

function executableRuleIds(currentProject, rootId) {
  const rules = new Set();
  const visited = new Set();
  const pending = [rootId];
  while (pending.length > 0) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const artifact = currentProject.artifacts.get(id)?.artifact;
    if (!artifact) continue;
    if (artifact.type === 'rule') {
      if (artifact.issue) rules.add(id);
      continue;
    }
    if (artifact.type === 'pipeline' || artifact.type === 'condition') {
      for (const step of artifact.steps || []) pending.push(step);
    }
  }
  return rules;
}

function applicableCoverageClasses(rules, unsupportedBranches) {
  const applicable = new Set();
  for (const rule of rules) {
    if (presenceOperators.has(rule.operator)) {
      applicable.add('absence');
      applicable.add('null');
      applicable.add('empty_string');
    }
    if (typeOperators.has(rule.operator)) applicable.add('wrong_type');
    if (rule.operator === 'in_dictionary') applicable.add('unsupported_dictionary');
    if (typeof rule.field === 'string' && rule.field.includes('[*]')) {
      applicable.add('empty_collection');
      if (rule.operator === 'not_empty') applicable.add('missing_collection_member');
      if (rule.aggregate?.issueMode === 'EACH') applicable.add('mixed_collection');
    }
  }
  if (unsupportedBranches.length > 0) applicable.add('unsupported_branch');
  return applicable;
}

function unsupportedBranchCases(currentProject, exportId, executableRules) {
  const cases = [];
  for (const id of reachableIds(currentProject, exportId)) {
    const condition = currentProject.artifacts.get(id)?.artifact;
    if (condition?.type !== 'condition') continue;
    for (const guardId of whenRefs(condition.when)) {
      const guard = currentProject.artifacts.get(guardId)?.artifact;
      if (guard?.operator !== 'in_dictionary' || typeof guard.field !== 'string') continue;
      const reportingRule = executableRules.find((rule) =>
        rule.operator === 'in_dictionary' &&
        rule.field === guard.field &&
        rule.dictionary === guard.dictionary &&
        typeof rule.issue?.code === 'string');
      if (!reportingRule) continue;
      const dependentCodes = new Set([...executableRuleIds(currentProject, id)]
        .map((ruleId) => currentProject.artifacts.get(ruleId)?.artifact?.issue?.code)
        .filter((code) => typeof code === 'string'));
      cases.push({ guardCode: reportingRule.issue.code, dependentCodes });
    }
  }
  return cases;
}

function validateExclusions(currentProject, coverageByExport, currentErrors, currentWarnings) {
  const exclusions = currentProject.manifest.coverage?.issueCodeExclusions;
  if (exclusions === undefined) return;
  if (!exclusions || typeof exclusions !== 'object' || Array.isArray(exclusions)) {
    currentErrors.push('manifest.coverage.issueCodeExclusions must be an object keyed by export id');
    return;
  }
  for (const [exportId, entries] of Object.entries(exclusions)) {
    const coverage = coverageByExport.get(exportId);
    if (!coverage) {
      currentErrors.push(`manifest.coverage.issueCodeExclusions references non-exported pipeline ${exportId}`);
      continue;
    }
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      currentErrors.push(`manifest.coverage.issueCodeExclusions.${exportId} must be a code-to-reason object`);
      continue;
    }
    for (const [code, reason] of Object.entries(entries)) {
      if (!coverage.reachableCodes.has(code)) {
        currentErrors.push(`${exportId}: excluded issue code ${code} is not reachable as an issue-producing rule`);
        continue;
      }
      if (typeof reason !== 'string' || reason.trim().length === 0) {
        currentErrors.push(`${exportId}: excluded issue code ${code} needs a non-empty reason`);
        continue;
      }
      coverage.excludedCodes.add(code);
    }
  }
  if (Object.keys(exclusions).length === 0) currentWarnings.push('manifest.coverage.issueCodeExclusions is empty and can be removed');
}

function inferRuleCoverage(sample, coverage, expectedCodeCounts) {
  for (const rule of coverage.rules) {
    const code = rule.issue?.code;
    if (!code || !expectedCodeCounts.has(code)) continue;
    const paths = rule.operator === 'any_filled' ? rule.fields || [] : [rule.field].filter(Boolean);
    const resolutions = paths.map((field) => resolveSamplePath(sample, field));

    if (presenceOperators.has(rule.operator)) {
      if (resolutions.some((result) => result.absentCount > 0 ||
          (result.matchedCount === 0 && !result.emptyWildcard))) coverage.coveredClasses.add('absence');
      if (resolutions.some((result) => result.values.some((value) => value === null))) coverage.coveredClasses.add('null');
      if (resolutions.some((result) => result.values.some((value) => value === ''))) coverage.coveredClasses.add('empty_string');
    }
    if (typeOperators.has(rule.operator)) coverage.coveredClasses.add('wrong_type');
    if (rule.operator === 'in_dictionary') {
      coverage.coveredClasses.add('unsupported_dictionary');
    }
    if (rule.operator === 'not_empty' && resolutions[0]?.absentCount > 0) {
      coverage.coveredClasses.add('missing_collection_member');
    }
    if (rule.aggregate?.issueMode === 'EACH' && resolutions[0]?.matchedCount > 1) {
      const failures = expectedCodeCounts.get(code) || 0;
      if (failures > 0 && failures < resolutions[0].matchedCount) coverage.coveredClasses.add('mixed_collection');
    }
  }
  for (const branch of coverage.unsupportedBranches) {
    if (expectedCodeCounts.has(branch.guardCode) &&
        [...branch.dependentCodes].every((code) => !expectedCodeCounts.has(code))) {
      coverage.coveredClasses.add('unsupported_branch');
    }
  }
}

function inferCollectionCoverage(sample, coverage) {
  for (const rule of coverage.rules) {
    if (typeof rule.field !== 'string' || !rule.field.includes('[*]')) continue;
    if (resolveSamplePath(sample, rule.field).emptyWildcard) coverage.coveredClasses.add('empty_collection');
  }
}

function difference(source, ...subtractions) {
  const removed = new Set(subtractions.flatMap((set) => [...set]));
  return [...source].filter((value) => !removed.has(value)).sort();
}

function summarizeCoverage(reachable, covered, excluded) {
  return {
    reachable: [...reachable].sort(),
    covered: [...reachable].filter((value) => covered.has(value)).sort(),
    excluded: [...reachable].filter((value) => excluded.has(value)).sort(),
    missing: difference(reachable, covered, excluded)
  };
}

function union(...sets) {
  return new Set(sets.flatMap((set) => [...set]));
}
