# Validation checklist

Use this checklist before handing off a jsonspecs rules package.

## Package structure

- No `.DS_Store` or unrelated generated files are committed.
- `library.*` artifacts are in `rules/library` and are genuinely reusable.
- `entrypoints.*` artifacts are under `rules/entrypoints`.
- Dictionaries live under `rules/dictionaries`.
- One artifact per JSON file unless the project has an explicit reason otherwise.

## Manifest

- `project.version` is explicit SemVer.
- Every entrypoint pipeline has `catalog.entrypoints[id].title`.
- Every payload field used by a user-visible rule has `catalog.fields[field].title`.
- Visible rules, conditions, predicates, and library pipelines have `catalog.artifacts[id].title`.
- Custom operators have catalog or operator-pack metadata.

## Rules

- Guard/contract checks run before dependent business checks.
- Multi-field issues have a deliberate primary `field`.
- Shared rule blocks are referenced through pipelines, not copy-pasted.
- Wildcard and aggregate rules have samples for empty, passing, failing, and mixed collections.
- Dictionaries have stable ids and entries are reviewed for duplicates.

## Custom operators

- Each custom operator has a written rationale.
- No custom operator duplicates a built-in operator.
- Operator return values are JSON-safe and deterministic.
- Operators use `ctx.get()` / `ctx.has()` rather than direct prototype-chain reads.

## Samples

- Each entrypoint has at least one OK sample and one failing sample.
- Warning-only cases are covered when warnings exist.
- Conditional branches have samples for predicate false and predicate true.
- Contract edge cases are separate from business edge cases.

## CLI checks

Run:

```bash
jsonspecs validate
jsonspecs test
jsonspecs build
```

Optionally run the skill scripts:

```bash
node /path/to/jsonspecs-rule-author/scripts/audit-manifest-coverage.mjs .
node /path/to/jsonspecs-rule-author/scripts/validate-package.mjs .
```

## Studio checks

Run Studio for UI-sensitive changes:

```bash
jsonspecs studio --host 127.0.0.1 --port 3100
```

Check field labels, condition tree readability, entrypoint pages, flow links, and deep-link refresh.

## Documentation sync

Scan docs for stale sample expectations and old status names. Known risky markers include:

- `expected: DEFECT`;
- obsolete numeric examples such as `7009` when the referenced rule changed;
- generated "documentation" that is only a flat list of rule titles.
