---
name: jsonspecs-rule-author
description: Author, review, refactor, govern, distribute, and validate jsonspecs rules packages and jsonspecs-cli projects. Use when designing transparent business-validation layers, manifest.json, rules artifacts, entrypoints, pipelines, conditions, dictionaries, custom operators, samples, Studio metadata, package boundaries, embedded rules engines, or standalone rules-service architecture for jsonspecs.
license: MIT
---

# jsonspecs Rule Author

Use this skill to produce maintainable jsonspecs rules packages, not merely valid JSON artifacts. Optimize for predictable package layout, reusable rule design, manifest-first Studio metadata, clear issue semantics, and repeatable CLI validation.

## Workflow

1. Inspect `manifest.json`, `rules/`, `samples/`, `docs/`, and `operators/` before editing.
2. Decide the rules-layer boundary: what the rules layer validates, what stays in application code, and whether rules run embedded, from a package, or through a service.
3. Build an authoring matrix: entrypoints, payload fields, `$context` fields, dictionaries, checks, predicates, levels, codes, and execution conditions.
4. Separate genuinely reusable artifacts from scenario-specific artifacts before creating files.
5. Update `manifest.catalog` first for fields, entrypoints, visible artifacts, and custom operators.
6. Express each rule with built-in DSL operators unless a domain-specific custom operator is necessary and explicitly justified.
7. Encode guard/contract completeness rules before business comparisons so missing data does not surface as a misleading business failure.
8. Compose shared blocks through reusable library pipelines; do not duplicate the same rule list across entrypoint flows.
9. Add samples for each entrypoint: success, error, warning when applicable, and contract edge cases.
10. Run `jsonspecs validate`, `jsonspecs test`, and `jsonspecs build`. When UI labels, flow rendering, conditions, or deep links matter, run `jsonspecs studio` and inspect the affected pages.
11. Before final delivery, report the boundary decisions, scenario composition, custom-operator rationale, validation commands, and any residual warnings.

## Reference routing

- Read `references/artifact-layout.md` when creating, moving, naming, or reviewing artifacts.
- Read `references/rule-layer-design.md` when deciding whether business checks belong in jsonspecs and where the execution boundary should sit.
- Read `references/scenario-composition.md` before designing entrypoints, validation blocks, or multi-step business scenarios.
- Read `references/guard-patterns.md` when ordering required, format, dictionary, cross-field, date, identifier, and boolean checks.
- Read `references/business-language.md` when writing titles, descriptions, messages, field labels, and Studio-facing names.
- Read `references/operator-policy.md` before adding or approving any custom operator.
- Read `references/package-boundary.md` when packaging, versioning, publishing, or consuming a reusable rules package.
- Read `references/distribution-options.md` when choosing between embedded execution, dependency-based distribution, a standalone rules service, or a hybrid model.
- Read `references/rule-governance.md` when setting review, ownership, release, and audit practices for business-controlled rules.
- Read `references/manifest-catalog.md` when editing `manifest.json`, Studio labels, field titles, entrypoint descriptions, or operator descriptions.
- Read `references/issue-semantics.md` when designing multi-field checks, contact/choice rules, guard rules, or error codes.
- Read `references/validation-checklist.md` before finishing a package or review.

## Hard authoring rules

- Keep `rules/library` for artifacts that are truly reusable by multiple entrypoints or domains.
- Keep scenario-specific artifacts under `rules/entrypoints/<entrypoint>/...`.
- Use ids that match intent and location: `library.*` for shared artifacts, `entrypoints.*` for scenario artifacts.
- Prefer `manifest.catalog.fields[field].title` for human field names. Use `description` as supporting text, not as the primary label.
- Treat runtime issues as single-field issues. If a rule involves several fields, choose the field deliberately or split the rule into clearer guard/business checks.
- Add a custom operator only for domain logic that the DSL cannot express safely or clearly.
- Never use a custom operator to repackage an existing built-in operator with a slightly different name.

## Optional audit scripts

Run the bundled scripts from the rules project root or pass the project root explicitly:

```bash
node /path/to/jsonspecs-rule-author/scripts/audit-manifest-coverage.mjs .
node /path/to/jsonspecs-rule-author/scripts/validate-package.mjs .
node /path/to/jsonspecs-rule-author/scripts/audit-guard-order.mjs .
node /path/to/jsonspecs-rule-author/scripts/audit-business-language.mjs .
node /path/to/jsonspecs-rule-author/scripts/audit-sample-matrix.mjs .
node /path/to/jsonspecs-rule-author/scripts/audit-rule-graph.mjs .
```

The scripts are read-only. They check manifest coverage, artifact layout, sample coverage, stale docs markers, and CLI validation/build/test where available.

Use `--strict` with `audit-manifest-coverage.mjs` when reviewing a package for release and you want warnings to fail the check.
Use the additional audit scripts as review aids: they flag likely guard-order gaps, technical UI language, sample coverage gaps, duplicate ids, cycles, unused artifacts, and oversized entrypoints.

## Completion criteria

A rules package is ready when:

- every entrypoint has manifest metadata and samples;
- every user-visible field has a catalog `title`;
- shared logic is composed through library pipelines instead of duplicated;
- custom operators are documented, used, and not replaceable by built-ins;
- guard rules run before dependent business rules;
- entrypoints read as business scenarios, not as flat dumps of checks;
- rule, condition, field, dictionary, and operator labels use business language suitable for Studio;
- package boundary, versioning and execution model are explicit;
- `jsonspecs validate`, `jsonspecs test`, and `jsonspecs build` pass;
- Studio displays meaningful field/artifact titles for affected flows.
