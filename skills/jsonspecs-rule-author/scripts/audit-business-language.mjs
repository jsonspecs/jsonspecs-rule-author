#!/usr/bin/env node
import path from 'node:path';
import { finish, loadProject, parseOptions, relative } from './lib/project.mjs';

const options = parseOptions();
const root = path.resolve(process.cwd(), options.rootArg);
const warnings = [];
const errors = [];
const notes = [];
const project = loadProject(root, errors);

const technicalTerms = [
  { pattern: /\benum\b/i, hint: 'use supported value or allowed category wording' },
  { pattern: /\bpayload\b/i, hint: 'use request, application, order, or form wording' },
  { pattern: /\bboolean\b/i, hint: 'use yes/no or business flag wording' },
  { pattern: /\boperator\b/i, hint: 'use business check wording' },
  { pattern: /\bpipeline\b/i, hint: 'use scenario or validation block wording' },
  { pattern: /\bregex\b|регулярн(?:ое|ому|ым) выражен/i, hint: 'describe the expected business format' },
  { pattern: /\btrue\s*\/\s*false\b/i, hint: 'use yes/no or positive/negative wording' },
  { pattern: /\bPASS\b|\bFAIL\b|\bSKIP\b/, hint: 'do not expose operator outcomes in user text' }
];

function checkText(label, value) {
  if (typeof value !== 'string' || value.trim().length === 0) return;
  for (const term of technicalTerms) {
    if (term.pattern.test(value)) warnings.push(`${label}: technical wording "${value}" (${term.hint})`);
  }
  if (/\b[a-z]+(?:_[a-z0-9]+){2,}\b/.test(value)) {
    warnings.push(`${label}: an internal id may leak into user text "${value}"`);
  }
}

if (project) {
  const catalog = project.manifest.catalog || {};
  for (const [section, items] of Object.entries(catalog)) {
    if (!items || typeof items !== 'object' || Array.isArray(items)) continue;
    for (const [id, item] of Object.entries(items)) {
      checkText(`manifest.catalog.${section}.${id}.title`, item?.title);
      checkText(`manifest.catalog.${section}.${id}.description`, item?.description);
    }
  }

  for (const { id, artifact, file } of project.records) {
    if (artifact.type !== 'rule' || !artifact.issue) continue;
    checkText(`${relative(root, file)}:${id}.issue.message`, artifact.issue.message);
  }
}

notes.push(`business-language warnings: ${warnings.length}`);
process.exitCode = finish({
  errors,
  warnings,
  notes,
  json: options.json,
  strict: options.strict,
  successMessage: 'business-language audit OK'
});
