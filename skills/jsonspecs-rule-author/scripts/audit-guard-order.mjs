#!/usr/bin/env node
import path from 'node:path';
import {
  BUILTIN_OPERATORS,
  collectRulePaths,
  compareUtf16,
  finish,
  loadProject,
  parseOptions,
  whenRefs
} from './lib/project.mjs';

const options = parseOptions();
const root = path.resolve(process.cwd(), options.rootArg);
const errors = [];
const warnings = [];
const notes = [];
const project = loadProject(root, errors);
const prerequisiteOperators = new Set([
  'matches_regex',
  'not_matches_regex',
  'is_boolean',
  'is_string',
  'is_number',
  'is_integer',
  'in_dictionary',
  'not_in_dictionary'
]);
const crossFieldOperators = new Set([
  'field_equals_field',
  'field_not_equals_field',
  'field_greater_than_field',
  'field_less_than_field',
  'field_greater_or_equal_than_field',
  'field_less_or_equal_than_field'
]);

function primaryPaths(rule) {
  return [rule?.field, rule?.value_field].filter((value) => typeof value === 'string');
}

if (project) {
  const contextPresence = new Set();
  const contextValueUses = new Set();
  let documentedHostContext = 0;

  for (const { artifact } of project.records) {
    if (artifact.type !== 'rule') continue;
    for (const field of collectRulePaths(artifact)) {
      if (!field.startsWith('$context.')) continue;
      if (artifact.operator === 'not_empty' && artifact.field === field) contextPresence.add(field);
      else contextValueUses.add(field);
    }
  }

  for (const field of [...contextValueUses].sort(compareUtf16)) {
    if (!contextPresence.has(field)) {
      const metadata = project.manifest.catalog?.fields?.[field];
      const documented = typeof metadata?.title === 'string' && metadata.title.trim() &&
        typeof metadata?.description === 'string' && metadata.description.trim();
      if (documented) documentedHostContext += 1;
      else warnings.push(`${field}: used by value logic without a not_empty rule or complete catalog documentation`);
    }
  }

  for (const { id, artifact } of project.records) {
    if (!['pipeline', 'condition'].includes(artifact.type) || !Array.isArray(artifact.steps)) continue;
    const directPrerequisites = new Map();

    for (const stepId of artifact.steps) {
      if (typeof stepId !== 'string') continue;
      const step = project.artifacts.get(stepId)?.artifact;
      if (!step || step.type !== 'rule') continue;

      const paths = primaryPaths(step);
      const isAdvanced = !BUILTIN_OPERATORS.has(step.operator) || crossFieldOperators.has(step.operator);
      if (isAdvanced) {
        for (const field of paths) {
          const guardId = directPrerequisites.get(field);
          if (guardId) {
            warnings.push(`${id}: ${stepId} runs directly after prerequisite ${guardId} for ${field}; gate the dependent check with a condition if malformed values would create a misleading issue`);
          }
        }
      }

      if (prerequisiteOperators.has(step.operator) && typeof step.field === 'string') {
        directPrerequisites.set(step.field, stepId);
      }
    }

    if (artifact.type === 'condition') {
      const guards = whenRefs(artifact.when);
      if (guards.size === 0) warnings.push(`${id}: condition has no recognizable Rules v3 when leaf`);
    }
  }

  notes.push(`artifacts inspected: ${project.records.length}`);
  notes.push(`context paths with explicit presence rule: ${contextPresence.size}`);
  notes.push(`context paths documented as an external contract: ${documentedHostContext}`);
  notes.push(`guard-order warnings: ${warnings.length}`);
}

process.exitCode = finish({
  errors,
  warnings,
  notes,
  json: options.json,
  strict: options.strict,
  successMessage: 'Rules v3 guard-order audit OK'
});
