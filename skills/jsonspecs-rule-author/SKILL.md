---
name: jsonspecs-rule-author
description: Author, review, refactor, migrate, package, and validate jsonspecs rules projects for @jsonspecs/rules v3 and jsonspecs/spec 1.0.0-rc.5. Use for formatVersion 2 snapshots, manifest.json authoring metadata, exported pipelines, rule/condition/pipeline/dictionary artifacts, guard design, samples, custom {schema,evaluate} operators, sourceHash, package boundaries, and migration from jsonspecs 2.x.
---

# jsonspecs Rule Author

Produce maintainable authoring projects whose executable output is a closed
`formatVersion: 2` snapshot accepted by `@jsonspecs/rules` v3.

## Baseline

- Treat `jsonspecs/spec` `1.0.0-rc.5` as the behavior contract and the published
  `@jsonspecs/rules` v3 npm package as the Node.js implementation target. Prefer an npm
  release plus a lockfile over a GitHub archive unless the task explicitly targets an
  unreleased revision.
- Separate normative snapshot fields from authoring metadata. `manifest.json`, source
  file `id`, folders, catalog labels, ownership, package version, and build information
  are builder conventions; they do not belong in the executable snapshot.
- Keep the runtime result closed: `status`, `issues`, `ruleset`, and `error` only on
  `ABORT`. Do not add `control`, `trace`, engine version, package version, or operator-pack
  identity to the normative result.
- Do not use a CLI release merely because it is named `jsonspecs-cli`. Verify that it
  explicitly builds snapshot `formatVersion: 2` for `specVersion: 1.0.0-rc.5`.
  Otherwise use project-local scripts or the bundled validation script.

## Workflow

1. Inspect `manifest.json`, `package.json`, `rules/`, `samples/`, `operators/`, `docs/`,
   `dist/snapshot.json`, and project build scripts before editing.
2. Confirm the execution boundary: what is validated, what remains application logic,
   which pipelines are public, and how the snapshot and operator packs are deployed.
3. Read `references/rules-v3-contract.md`, then build a matrix of exported pipelines,
   payload paths, `$context.*` paths, rules, issue codes and levels, dictionaries,
   conditions, and custom operators.
4. Keep scenario-local artifacts local. Promote an artifact to `rules/library/` only
   when reuse is real and its field contract and issue meaning are the same.
5. Update authoring metadata for exports, fields, visible artifacts, and operator
   descriptions. Never copy that metadata into the snapshot.
6. Use built-in operators where possible. For a custom operator, define one immutable
   name bound to `{ schema, evaluate }`; pass runtime dependencies through `field`,
   `value_field`, or named `inputs`, and constants through `params`.
7. Express requiredness with a presence rule. Remember that value operators skip an
   absent `field` or `value_field`; named `inputs` are different and let a custom
   operator observe missing members.
8. Compose flows with string `steps`. Use conditions to gate checks whose meaning
   depends on type, format, dictionary membership, or another business prerequisite.
9. Add samples for every exported pipeline: success, each major blocking family,
   warnings and exceptions where applicable, branch edges, wildcard empty/mixed cases,
   malformed JSON-safe inputs for custom operators, and every reachable issue code or a
   documented exclusion with a reason.
10. When the contract needs checks outside Rules v3, ship an executable host-boundary
    module, call it before `runPipeline` in the integration example, and test it together
    with the rules package. Do not delegate a declared invariant to an imaginary adapter.
11. Build the snapshot in memory, compute `sourceHash` over the whole snapshot without
    `sourceHash`, compile it with the deployed operator registry, run samples, and compare
    any checked-in `dist/snapshot.json` with the rebuilt value.
12. Report boundary decisions, public exports, custom-operator rationale, validation
    commands, snapshot identity, and residual warnings.

## Reference routing

- Read `references/rules-v3-contract.md` for every Rules v3 or RC.5 task.
- Read `references/artifact-layout.md` when creating, moving, naming, or migrating
  artifacts and snapshots.
- Read `references/rule-layer-design.md` when deciding what belongs in the rules layer.
- Read `references/scenario-composition.md` before designing exported pipelines,
  conditions, or reusable validation blocks.
- Read `references/guard-patterns.md` when ordering presence, type, format, dictionary,
  date, identifier, wildcard, or cross-field checks.
- Read `references/business-language.md` for catalog labels and issue messages.
- Read `references/operator-policy.md` before adding or approving a custom operator.
- Read `references/issue-semantics.md` for issue codes, fields, aggregate issues, and
  multi-field checks.
- Read `references/manifest-catalog.md` when editing authoring metadata.
- Read `references/package-boundary.md`, `references/distribution-options.md`, and
  `references/rule-governance.md` for packaging, deployment, or governance work.
- Read `references/validation-checklist.md` before final delivery.

## Hard rules

- Build a snapshot with exactly `format`, `formatVersion`, `specVersion`, `sourceHash`,
  `exports`, and `artifacts`.
- Use an object map for `artifacts`; remove source `id` from each artifact value.
- Use a sorted, unique `exports` array of pipeline ids. Do not use pipeline
  `entrypoint`.
- Use non-empty string `steps`. Do not use `flow`, object steps, or `stepId`.
- Put `level`, `code`, `message`, and optional `meta` inside `rule.issue`. A rule used as
  a step must have `issue`; a rule used only in `when` may omit it.
- Keep issue codes unique across the snapshot.
- Do not use `role`, `strict`, `required_context`, snapshot `meta`, `engine`, or
  `requires` in the executable graph.
- Add `aggregate` exactly when `field` contains `[*]`. Use `ALL`, `ANY`, or `COUNT`.
- Do not put `[*]` in `value_field`, named `inputs`, or `$context.*`. A wildcard
  `not_empty` checks existing matches only; it does not require a member in every item.
- Ensure every artifact is reachable from `exports`, including `when` rules and
  dictionaries.
- Keep package version and operator-pack identity in build/deployment records, not in
  the normative runtime result.

## Bundled validation

Run from a rules project root or pass the project path explicitly:

```bash
node /path/to/scripts/audit-manifest-coverage.mjs .
node /path/to/scripts/audit-rule-graph.mjs .
node /path/to/scripts/audit-guard-order.mjs .
node /path/to/scripts/audit-business-language.mjs .
node /path/to/scripts/audit-sample-matrix.mjs .
node /path/to/scripts/validate-package.mjs .
```

The audit scripts are read-only. Use `validate-package.mjs . --static` for an untrusted
project: it reads JSON and text only and does not load project JavaScript. Without
`--static`, the verifier loads the project's installed `@jsonspecs/rules` and operator
modules, compiles the snapshot, executes samples, and checks committed build files.
Run that mode only for trusted project code. Add `--strict` to fail on audit warnings.
Neither mode downloads a CLI or writes `dist/`.

## Completion criteria

- The in-memory snapshot compiles under `@jsonspecs/rules` v3 for
  `specVersion: 1.0.0-rc.5` with the deployment's operator registry.
- Every export has catalog metadata and executable samples.
- Samples cover every reachable issue code and applicable boundary class, or record an
  intentional issue-code exclusion with a non-empty reason.
- Required `$context.*` dependencies are enforced by rules when absence is a business
  error and documented outside the snapshot.
- Every declared host-boundary check exists as executable, versioned code and is covered
  by the same test command as the rules package.
- Guard ordering prevents misleading dependent failures.
- Custom operators use the v3 contract and have deterministic pass/fail/skip vectors.
- The full graph is reachable, acyclic, and free of legacy fields.
- A checked-in snapshot, if present, matches the in-memory rebuild byte-for-data after
  JSON parsing, including `sourceHash`.
- The repository's continuous-integration job installs from the lockfile, validates the
  package, and runs all samples and host-boundary tests on a supported Node.js version.
