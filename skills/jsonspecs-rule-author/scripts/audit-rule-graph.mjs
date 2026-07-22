#!/usr/bin/env node
import path from 'node:path';
import {
  artifactRefs,
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
const references = new Map();

if (project) {
  for (const { id, artifact } of project.records) {
    const refs = artifactRefs(artifact);
    references.set(id, refs);
    if (Array.isArray(artifact.steps) && artifact.steps.length > 25) {
      warnings.push(`${id}: ${artifact.steps.length} direct steps; consider named scenario blocks`);
    }

    for (const step of Array.isArray(artifact.steps) ? artifact.steps : []) {
      if (typeof step !== 'string') continue;
      const target = project.artifacts.get(step)?.artifact;
      if (!target) {
        errors.push(`${id}: step references missing artifact ${step}`);
      } else if (target.type === 'dictionary') {
        errors.push(`${id}: step cannot reference dictionary ${step}`);
      } else if (target.type === 'rule' && !target.issue) {
        errors.push(`${id}: step references rule without issue ${step}`);
      }
    }

    for (const ref of whenRefs(artifact.when)) {
      const target = project.artifacts.get(ref)?.artifact;
      if (!target) errors.push(`${id}: when references missing rule ${ref}`);
      else if (target.type !== 'rule') errors.push(`${id}: when leaf ${ref} must reference a rule`);
    }

    if (typeof artifact.dictionary === 'string') {
      const target = project.artifacts.get(artifact.dictionary)?.artifact;
      if (!target) errors.push(`${id}: dictionary reference ${artifact.dictionary} is missing`);
      else if (target.type !== 'dictionary') errors.push(`${id}: ${artifact.dictionary} is not a dictionary`);
    }
  }

  const exportsList = Array.isArray(project.manifest.exports) ? project.manifest.exports : [];
  for (const id of exportsList) {
    const target = project.artifacts.get(id)?.artifact;
    if (!target) errors.push(`export ${id} is missing`);
    else if (target.type !== 'pipeline') errors.push(`export ${id} is not a pipeline`);
  }

  const controlState = new Map();
  const controlStack = [];
  const cycleMessages = new Set();
  function visitControl(id) {
    const state = controlState.get(id);
    if (state === 'done') return;
    if (state === 'active') {
      const start = controlStack.indexOf(id);
      cycleMessages.add(`control cycle: ${[...controlStack.slice(start), id].join(' -> ')}`);
      return;
    }
    const artifact = project.artifacts.get(id)?.artifact;
    if (!artifact || !['pipeline', 'condition'].includes(artifact.type)) return;
    controlState.set(id, 'active');
    controlStack.push(id);
    for (const step of Array.isArray(artifact.steps) ? artifact.steps : []) {
      const target = project.artifacts.get(step)?.artifact;
      if (target && ['pipeline', 'condition'].includes(target.type)) visitControl(step);
    }
    controlStack.pop();
    controlState.set(id, 'done');
  }
  for (const { id, artifact } of project.records) {
    if (['pipeline', 'condition'].includes(artifact.type)) visitControl(id);
  }
  errors.push(...[...cycleMessages].sort(compareUtf16));

  const reachable = new Set();
  function visit(id) {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const ref of references.get(id) || []) {
      if (project.artifacts.has(ref)) visit(ref);
    }
  }
  for (const id of exportsList) if (project.artifacts.has(id)) visit(id);

  for (const id of [...project.artifacts.keys()].sort(compareUtf16)) {
    if (!reachable.has(id)) errors.push(`${id}: artifact is unreachable from manifest.exports`);
  }

  notes.push(`artifacts: ${project.records.length}`);
  notes.push(`exports: ${exportsList.length}`);
  notes.push(`reachable: ${reachable.size}`);
}

process.exitCode = finish({
  errors,
  warnings,
  notes,
  json: options.json,
  strict: options.strict,
  successMessage: 'Rules v4 graph audit OK'
});
