---
name: jsonspecs-rule-author
description: Author, review, refactor, migrate, package, and validate jsonspecs rules projects for @jsonspecs/rules v4, jsonspecs-cli v4, and jsonspecs/spec 1.0.0-rc.7. Use for formatVersion 2 snapshots, manifest.json authoring metadata, exported pipelines, rule/condition/pipeline/dictionary artifacts, RC.7 wildcard guards, samples, custom {schema,evaluate} operators, sourceHash, Sandbox metadata, package boundaries, and migration from older jsonspecs releases.
license: MIT
---

# jsonspecs Rule Author

Produce maintainable authoring projects whose executable output is a closed
`formatVersion: 2` snapshot accepted by `@jsonspecs/rules` v4.

## Baseline

- Treat `jsonspecs/spec` `1.0.0-rc.7` as the behavior contract, `@jsonspecs/rules` v4 as
  the Node.js implementation target, and `jsonspecs-cli` v4 as the canonical authoring
  tool. Prefer published packages plus a lockfile unless the task explicitly targets an
  unreleased revision. Require Node.js 20 or newer.
- Separate normative snapshot fields from authoring metadata. `manifest.json`, source
  file `id`, folders, catalog labels, ownership, package version, and build information
  are builder conventions; they do not belong in the executable snapshot.
- Keep the runtime result closed: `status`, `issues`, `ruleset`, and `error` only on
  `ABORT`. Do not add `control`, `trace`, engine version, package version, or operator-pack
  identity to the normative result.
- Parse authoring JSON, samples, and Sandbox requests at the strict I-JSON boundary.
  Use CLI v4 for that proof; ordinary `JSON.parse`-based audits cannot detect duplicate
  members or malformed raw UTF-8 after conversion.

## Workflow

1. Inspect `manifest.json`, `package.json`, `rules/`, `samples/`, `operators/`, `docs/`,
   `dist/snapshot.json`, and project build scripts before editing.
2. Confirm the execution boundary: what is validated, what remains application logic,
   which pipelines are public, and how the snapshot and operator packs are deployed.
3. Read `references/rules-v4-contract.md`, then build a matrix of exported pipelines,
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
   omitted members after the final wildcard, malformed JSON-safe inputs for custom
   operators, and every reachable issue code or a documented exclusion with a reason.
10. Run `jsonspecs validate --fail-on-warning` and `jsonspecs test` with the project-local
    CLI v4. Build through CLI v4 when distribution files must change, then compare any
    checked-in snapshot with an independent in-memory rebuild.
11. Run `jsonspecs sandbox` when labels, condition trees, flow links, or sample execution
    need visual inspection. Never expose Sandbox as a production service.
12. Report boundary decisions, public exports, custom-operator rationale, validation
    commands, snapshot identity, and residual warnings.

## Reference routing

- Read `references/rules-v4-contract.md` for every Rules v4, CLI v4, or RC.7 task.
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
- Do not put `[*]` in `value_field`, named `inputs`, or `$context.*`.
- Under RC.7, every real array index reached by `[*]` creates a structural candidate.
  Use a wildcard `not_empty` rule to require a child member in every item and
  `issueMode: "EACH"` for concrete missing paths. `onEmpty` handles zero candidates, not
  an omitted member in an existing item.
- Treat exact index tokens as decimal path text with no implementation-sized upper
  bound. Never round them through JavaScript `Number` or another limited numeric type.
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
`--static`, the verifier loads the project's installed Rules v4 and operator modules,
runs the project-local CLI v4 `validate` and `test` commands, compiles an independent
snapshot, executes samples, and checks committed build files. Run that mode only for
trusted project code. Add `--strict` to fail on audit warnings. Neither mode downloads
packages or writes `dist/`.

## Completion criteria

- `jsonspecs validate --fail-on-warning` and `jsonspecs test` pass under CLI v4.
- The independent in-memory snapshot compiles under `@jsonspecs/rules` v4 for
  `specVersion: 1.0.0-rc.7` with the deployment's operator registry.
- Every export has catalog metadata and executable samples.
- Samples cover every reachable issue code and applicable boundary class, or record an
  intentional issue-code exclusion with a non-empty reason.
- Required payload and `$context.*` fields are enforced by analyst-authored presence
  rules in the corresponding pipelines and documented outside the snapshot.
- Guard ordering prevents misleading dependent failures.
- Custom operators use the v4 contract and have deterministic pass/fail/skip vectors.
- The full graph is reachable, acyclic, and free of legacy fields.
- A checked-in snapshot, if present, matches the in-memory rebuild byte-for-data after
  JSON parsing, including `sourceHash`.
- The repository's continuous-integration job installs from the lockfile, validates the
  package, and runs all samples on a supported Node.js version.
