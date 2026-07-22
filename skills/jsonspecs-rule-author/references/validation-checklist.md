# Rules v4 validation checklist

Use this checklist before handing off a package targeting `@jsonspecs/rules` v4,
`jsonspecs-cli` v4, and Spec `1.0.0-rc.7`.

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

- Node.js is version 20 or newer.
- `package.json` resolves published major version 4 releases of `@jsonspecs/rules` and
  `jsonspecs-cli`; the lockfile records exact installed releases.
- The snapshot has `formatVersion: 2` and `specVersion: "1.0.0-rc.7"`.
- Migration from another `specVersion` rebuilds the entire snapshot and recomputes
  `sourceHash`; an older snapshot is never relabeled in place.
- The builder uses `computeSourceHash` over the whole snapshot without `sourceHash`.
- The compiler call is `compileSnapshot`; execution passes one object with
  `pipelineId`, nested `payload`, and optional nested `context`.
- CLI v4 is the only code that writes canonical files under `dist`.
- Authoring files, samples, and raw Sandbox requests pass the CLI v4 strict I-JSON
  parser; a successful `JSON.parse` alone is not sufficient evidence.

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
- Build information records project, runtime, build time, counts, and operator-pack
  identity outside the snapshot. The lockfile records npm resolution and integrity.
- Derived `build-info.json` fields match the current manifest, runtime, snapshot,
  artifact count, exports, and custom operator names.

## Rules and issues

- Every rule step references a rule with nested `issue`.
- Predicate-only rules may omit `issue` and are reachable through `when`.
- Issue codes are globally unique.
- Requiredness uses a presence operator; value checks rely on RC.7 skip semantics.
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
- Non-empty objects and arrays are not treated as their own flattened leaf paths.
- A wildcard presence rule over a child path is used deliberately to require that child
  in every real item reached by RC.7 structural traversal.
- `onEmpty` is understood as zero structural candidates, not an omitted child in an
  existing item.
- `value_field`, named `inputs`, and `$context.*` contain no `[*]`; no aligned wildcard
  comparison is assumed.
- Exact index tokens are range-checked as decimal text without `Number`; any later array
  access conversion happens only after proving the token is in the safe array-length
  range. Large tokens preserve their authored text in concrete issue paths.
- Dictionary entries are unique non-null scalars; labels and aliases are lowered outside
  the executable dictionary.

## Custom operators

- Registry shape is `name -> { schema, evaluate }`, not `{ check, predicate }`.
- Schemas close the top level, named `inputs`, and immediate `params` object.
- Schemas validate authored rule configuration, not runtime business value types;
  `evaluate` safely handles every JSON type.
- Runtime dependencies use operands or named `inputs`; constants use `params`.
- `evaluate` receives values only and returns exactly `PASS`, `FAIL`, or `SKIP`.
- Golden vectors cover missing inputs, `null`, wrong JSON-safe types, boundaries, and
  deterministic fault behavior.
- Operator-pack version and digest are recorded outside the snapshot.

## Samples

- Samples use top-level `pipelineId`; it is not hidden in `context`.
- Every export has at least one `OK` and one error/warning/exception case.
- Every reachable issue code is asserted by a sample or has a manifest exclusion with a
  non-empty reason.
- Samples use one-to-one expected issue projections. Use `expect.exact: true` when the
  exact issue count matters; project tests should assert order when consumers depend on
  it.
- Conditional branches cover true and false paths.
- Applicable boundary classes cover absence, `null`, empty strings, wrong types,
  unsupported dictionary values and branches, empty collections, and omitted/mixed
  collection members.
- Wildcard edge cases include omitted children after the final wildcard, empty
  collections, mixed candidates, all-skip populations, and custom-operator edges.
- Removing all required `context` from an otherwise valid sample cannot return `OK` for
  any export that depends on it.
- Required collection-member rules cover omitted members, `null`, empty values, and
  empty collections according to the authored aggregate semantics.

## Commands

Run the canonical project commands first:

```bash
npm ci
./node_modules/.bin/jsonspecs validate --fail-on-warning
./node_modules/.bin/jsonspecs test
```

Run the package verifier as an independent audit. Neither mode writes project files:

```bash
node /path/to/scripts/validate-package.mjs . --static
node /path/to/scripts/validate-package.mjs .
node /path/to/scripts/validate-package.mjs . --strict
```

Use `--static` first for untrusted projects. That mode runs only text and ordinary JSON
audits; it never loads project JavaScript and does not prove the raw I-JSON boundary.
The default mode resolves the project's installed Rules v4 and CLI v4, loads custom
operator modules, runs CLI `validate` and `test`, builds and compiles an independent
snapshot, executes samples, and compares checked-in build files. It therefore executes
trusted project code. Neither mode downloads packages or writes build output.

Run the project's own build command afterward when distribution files need updating,
then rerun the verifier to prove that `dist/snapshot.json` is current.

Require the repository's continuous-integration job to install from the lockfile,
validate the package, and run its complete test command on every proposed change. The
test command must include samples and custom operators.

Use `jsonspecs sandbox` for local visual review. Check export pages, field labels,
condition trees, flow links, and sample execution. Do not expose Sandbox publicly.

## Final report

Report:

- rules-layer boundary and public exports;
- custom operators and why built-ins were insufficient;
- exact validation commands;
- `specVersion` and `sourceHash`;
- checked-in snapshot status;
- warnings or deployment metadata that remain outside the normative result.
