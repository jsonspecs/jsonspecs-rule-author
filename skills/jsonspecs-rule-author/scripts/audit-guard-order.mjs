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
const typeOperators = new Set(['is_boolean', 'is_string', 'is_number', 'is_integer']);
const formatOperators = new Set(['matches_regex', 'not_matches_regex']);
const dictionaryOperators = new Set(['in_dictionary', 'not_in_dictionary']);
const valueOperators = new Set([
  'equals',
  'not_equals',
  'contains',
  'matches_regex',
  'not_matches_regex',
  'greater_than',
  'less_than',
  'length_equals',
  'length_max',
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
      if (!step || step.type !== 'rule') {
        directPrerequisites.clear();
        continue;
      }

      const paths = primaryPaths(step);
      for (const field of paths) {
        const guard = directPrerequisites.get(field);
        if (guard && isDependentCheck(guard.operator, step.operator)) {
          warnings.push(`${id}: ${stepId} runs in the same direct step sequence after prerequisite ${guard.id} for ${field}; gate the dependent check with a condition if malformed values would create a misleading issue`);
        }
      }

      if (prerequisiteOperators.has(step.operator) && typeof step.field === 'string') {
        directPrerequisites.set(step.field, { id: stepId, operator: step.operator });
      }
    }

    if (artifact.type === 'condition') {
      const guards = whenRefs(artifact.when);
      if (guards.size === 0) warnings.push(`${id}: condition has no recognizable Rules v3 when leaf`);
      const guardRules = [...guards]
        .map((guardId) => ({ id: guardId, artifact: project.artifacts.get(guardId)?.artifact }))
        .filter(({ artifact: guard }) => guard?.type === 'rule');
      for (const { id: guardId, artifact: guard } of guardRules) {
        if (guard.operator !== 'not_equals' || typeof guard.field !== 'string') continue;
        const provesSupportedValue = dictionaryGuardAppliesToLeaf(artifact.when, guardId, guard.field);
        if (!provesSupportedValue) {
          warnings.push(`${id}: when uses ${guardId} (${guard.field} not_equals ...) without an in_dictionary predicate for the same field; inequality alone does not prove a supported branch value`);
        }
      }
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

function isDependentCheck(prerequisite, operator) {
  const customOrCrossField = !BUILTIN_OPERATORS.has(operator) || crossFieldOperators.has(operator);
  if (typeOperators.has(prerequisite)) return valueOperators.has(operator) || customOrCrossField;
  if (formatOperators.has(prerequisite)) return customOrCrossField;
  if (dictionaryOperators.has(prerequisite)) {
    return customOrCrossField || (valueOperators.has(operator) && !dictionaryOperators.has(operator));
  }
  return false;
}

function dictionaryGuardAppliesToLeaf(when, targetId, field, inherited = false) {
  if (typeof when === 'string') return when === targetId && inherited;
  if (!when || typeof when !== 'object' || Array.isArray(when)) return false;
  if (Object.prototype.hasOwnProperty.call(when, 'not')) return false;
  if (Array.isArray(when.all)) {
    return when.all.some((child, index, children) => {
      if (!whenRefs(child).has(targetId)) return false;
      const siblingGuarantee = children.some((candidate, candidateIndex) =>
        candidateIndex !== index && guaranteesDictionary(candidate, field));
      return dictionaryGuardAppliesToLeaf(child, targetId, field, inherited || siblingGuarantee);
    });
  }
  if (Array.isArray(when.any)) {
    return when.any.some((child) => dictionaryGuardAppliesToLeaf(child, targetId, field, inherited));
  }
  return false;
}

function guaranteesDictionary(when, field) {
  if (typeof when === 'string') {
    const rule = project?.artifacts.get(when)?.artifact;
    return rule?.operator === 'in_dictionary' && rule.field === field;
  }
  if (!when || typeof when !== 'object' || Array.isArray(when) || Object.prototype.hasOwnProperty.call(when, 'not')) return false;
  if (Array.isArray(when.all)) return when.all.some((child) => guaranteesDictionary(child, field));
  if (Array.isArray(when.any)) return when.any.length > 0 && when.any.every((child) => guaranteesDictionary(child, field));
  return false;
}
