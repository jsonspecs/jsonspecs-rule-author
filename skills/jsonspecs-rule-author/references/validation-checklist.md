# Rules v3 validation checklist

Use this checklist before handing off a package targeting `@jsonspecs/rules` v3 and
Spec `1.0.0-rc.5`.

## Contents

- [Compatibility](#compatibility)
- [Snapshot closure](#snapshot-closure)
- [Authoring package](#authoring-package)
- [Rules and issues](#rules-and-issues)
- [Wildcards and dictionaries](#wildcards-and-dictionaries)
- [Custom operators](#custom-operators)
- [Samples](#samples)
- [Commands](#commands)
- [Final report](#final-report)

## Compatibility

- `package.json` resolves `@jsonspecs/rules` major version 3.
- The snapshot has `formatVersion: 2` and `specVersion: "1.0.0-rc.5"`.
- The builder uses `computeSourceHash` over the whole snapshot without `sourceHash`.
- The compiler call is `compileSnapshot`; execution passes one object with
  `pipelineId`, nested `payload`, and optional nested `context`.
- No 2.x CLI is used to build or validate the v3 snapshot.

## Snapshot closure

- Top-level keys are exactly `format`, `formatVersion`, `specVersion`, `sourceHash`,
  `exports`, and `artifacts`.
- `artifacts` is an object map and values contain no `id`.
- `exports` is non-empty, unique, sorted by unsigned UTF-16 code units, and contains
  pipeline ids only.
- All artifacts are reachable from exports through steps, `when`, and dictionary refs.
- The combined pipeline/condition control graph is acyclic.
- No `entrypoint`, `flow`, object step, `stepId`, `role`, `strict`, `required_context`,
  snapshot `meta`, `engine`, or `requires` remains.

## Authoring package

- Source ids are present and unique; one artifact per JSON file is preferred.
- Scenario artifacts remain under their entrypoint; `library` contains demonstrated
  reuse only.
- `project.version` is explicit SemVer in authoring metadata.
- Every export has a catalog title and complete samples.
- Payload and `$context.*` paths have labels or documentation.
- A checked-in `dist/snapshot.json` exactly matches an in-memory rebuild.
- Build information records package, runtime, source revision, and operator-pack
  identity outside the snapshot.

## Rules and issues

- Every rule step references a rule with nested `issue`.
- Predicate-only rules may omit `issue` and are reachable through `when`.
- Issue codes are globally unique.
- Requiredness uses a presence operator; value checks rely on RC.5 skip semantics.
- Conditions gate checks that require valid type, format, dictionary membership, or
  another prerequisite.
- `$context.*` presence is checked by rules when absence is a business error.
- Cross-field operand direction points the issue at the field the user should fix.
- `EXCEPTION` is used only for an intentional immediate business stop.

## Wildcards and dictionaries

- `aggregate` appears exactly with wildcard `field`.
- Modes are `ALL`, `ANY`, or `COUNT`; legacy `EACH`, `MIN`, and `MAX` are absent.
- `ALL`/`ANY` with issue declares `EACH` or `SUMMARY`; `COUNT` has no `issueMode`.
- Empty, all-skip, mixed, and failure cases are sampled where meaningful.
- Dictionary entries are unique non-null scalars; labels and aliases are lowered outside
  the executable dictionary.

## Custom operators

- Registry shape is `name -> { schema, evaluate }`, not `{ check, predicate }`.
- Schemas close the top level, named `inputs`, and immediate `params` object.
- Runtime dependencies use operands or named `inputs`; constants use `params`.
- `evaluate` receives values only and returns exactly `PASS`, `FAIL`, or `SKIP`.
- Golden vectors cover missing inputs, `null`, wrong JSON-safe types, boundaries, and
  deterministic fault behavior.
- Operator-pack version and digest are recorded outside the snapshot.

## Samples

- Samples use top-level `pipelineId`; it is not hidden in `context`.
- Every export has at least one `OK` and one error/warning/exception case.
- Expected issues assert order as well as stable fields.
- Conditional branches cover true and false paths.
- Wildcard and custom-operator edge cases are present.

## Commands

Run the read-only package verifier:

```bash
node /path/to/scripts/validate-package.mjs .
node /path/to/scripts/validate-package.mjs . --strict
```

It runs all bundled audits, resolves the project's installed `@jsonspecs/rules`, builds
and compiles the snapshot in memory, executes samples, and compares a checked-in
snapshot when one exists. It does not download packages or write build output.

Run the project's own build command afterward when distribution files need updating,
then rerun the verifier to prove that `dist/snapshot.json` is current.

Use Studio only when the selected Studio release explicitly supports formatVersion 2.
Check export pages, field labels, condition trees, flow links, and sample execution.

## Final report

Report:

- rules-layer boundary and public exports;
- custom operators and why built-ins were insufficient;
- exact validation commands;
- `specVersion` and `sourceHash`;
- checked-in snapshot status;
- warnings or deployment metadata that remain outside the normative result.
