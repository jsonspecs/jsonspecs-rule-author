# Authoring manifest and catalog

Use this reference when editing `manifest.json` or user-facing metadata.

## Contents

- [Boundary](#boundary)
- [Field metadata](#field-metadata)
- [Export metadata](#export-metadata)
- [Artifact metadata](#artifact-metadata)
- [Operator metadata](#operator-metadata)
- [Sample coverage metadata](#sample-coverage-metadata)
- [Verification](#verification)

## Boundary

Spec 1.0.0-rc.7 does not define `manifest.json`. It defines only the executable
snapshot. A project manifest is an authoring convention that should give the builder
enough information without leaking metadata into the snapshot.

Recommended minimum:

```json
{
  "project": {
    "id": "checkout-rules",
    "version": "3.2.0",
    "title": "Проверки оформления заказа",
    "description": "Правила перед регистрацией заказа",
    "language": "ru"
  },
  "paths": {
    "rules": "./rules",
    "samples": "./samples",
    "docs": "./docs",
    "dist": "./dist"
  },
  "build": {
    "snapshotFile": "snapshot.json",
    "buildInfoFile": "build-info.json"
  },
  "specVersion": "1.0.0-rc.7",
  "exports": ["entrypoints.checkout.validation"],
  "catalog": {
    "fields": {},
    "entrypoints": {},
    "artifacts": {},
    "operators": {}
  }
}
```

`project.version`, catalog data, and build settings stay outside the executable
snapshot. `specVersion` and `exports` are copied into the snapshot by the builder.

## Field metadata

Use `catalog.fields[path].title` as the primary human label and `description` as
supporting text. Add exact wildcard keys such as `order.items[*].sku`.

Catalog `$context.*` paths when Sandbox or reviewers show them. In all cases, document
their presence and semantics because the snapshot cannot declare `required_context`.

## Export metadata

Every id in manifest `exports` should have `catalog.entrypoints[id]`:

```json
{
  "title": "Проверка заказа",
  "description": "Проверяет заказ перед регистрацией"
}
```

`exports` is the authority for public runtime access. Catalog membership does not
export a pipeline.

## Artifact metadata

Add `catalog.artifacts[id]` for items visible in flow diagrams and diagnostics:

- issue-producing rules;
- business conditions and their predicate leaves;
- nested pipelines;
- dictionaries when reviewers need a human label.

Do not add `description` directly to RC.7 artifact values; the snapshot schema rejects
it.

## Operator metadata

Describe every custom operator in `catalog.operators[name].description` or another
documented authoring metadata source. The v4 runtime registry itself is a flat map of
`name -> { schema, evaluate }`; metadata is not passed to `createEngine` and not hashed
into the snapshot unless copied into `rule.issue.meta` deliberately.

## Sample coverage metadata

Every issue-producing rule reachable as a step from an export should have a sample that
asserts its issue code. The audit reports reachability for each export; one sample may
cover a globally unique code shared by several exports. Record an intentional exception
in authoring metadata:

```json
{
  "coverage": {
    "issueCodeExclusions": {
      "entrypoints.checkout.validation": {
        "CHECKOUT.PARTNER.REQUIRED": "Activated only in the partner configuration and covered by its contract suite"
      }
    }
  }
}
```

The export and code must be reachable in the current graph, and every reason must be a
non-empty string. Remove an exclusion when a sample starts covering the code.

The sample audit also recognizes boundary evidence. Most cases are inferred from the
input and expected issue codes. When a static audit cannot infer intent, add a top-level
sample annotation:

```json
{
  "pipelineId": "entrypoints.collection.validation",
  "coverage": ["empty_collection", "unsupported_branch"],
  "payload": { "items": [] },
  "expect": { "status": "OK", "issues": [] }
}
```

Allowed class names are `absence`, `null`, `empty_string`, `wrong_type`,
`unsupported_dictionary`, `empty_collection`, `missing_collection_member`,
`mixed_collection`, and `unsupported_branch`. An annotation is audit metadata only; it
is not passed to `runPipeline` and does not weaken expected result assertions.

## Verification

Check that:

- `exports` is unique and sorted by unsigned UTF-16 code units;
- every export is a pipeline and has a catalog title;
- every reachable issue code has a sample or a documented exclusion;
- used payload and context paths have understandable labels or docs;
- visible ids do not leak as the only UI labels;
- no catalog or project data appears in `dist/snapshot.json`.
