# Artifact layout and snapshot lowering

Use this reference when creating, moving, naming, or migrating source artifacts.

## Contents

- [Two layers](#two-layers)
- [Recommended source layout](#recommended-source-layout)
- [Id policy](#id-policy)
- [Pipeline composition](#pipeline-composition)
- [Builder obligations](#builder-obligations)
- [Promotion checklist](#promotion-checklist)

## Two layers

Keep authoring files separate from the executable snapshot.

An authoring file may carry `id` for navigation:

```json
{
  "id": "entrypoints.checkout.validation",
  "type": "pipeline",
  "steps": ["library.checkout.customer.required"]
}
```

The builder must lower it to an `artifacts` map and remove `id` from the value:

```json
{
  "artifacts": {
    "entrypoints.checkout.validation": {
      "type": "pipeline",
      "steps": ["library.checkout.customer.required"]
    }
  }
}
```

The source `id` convention is not part of Spec 1.0.0-rc.5. If a project authors the
snapshot map directly, preserve that project convention instead.

## Recommended source layout

```text
manifest.json
package.json
rules/
  entrypoints/<scenario>.json
  entrypoints/<scenario>/...
  library/pipelines/...
  library/conditions/...
  library/predicates/...
  library/dictionaries/...
operators/node/
samples/
docs/
dist/snapshot.json
dist/build-info.json
```

- `rules/entrypoints/`: scenario-specific artifacts.
- `rules/library/`: artifacts with demonstrated reuse and the same business meaning.
- `rules/library/dictionaries/`: shared dictionaries. A scenario-only dictionary may
  remain under its entrypoint directory.
- `operators/node/`: project-local v3 operator registry when needed.
- `samples/`: complete calls with top-level `pipelineId`, `payload`, optional `context`,
  and `expect`.

Prefer one source artifact per JSON file. It keeps duplicate ids, review locations,
and build diagnostics unambiguous.

## Id policy

Spec 1.0.0-rc.5 treats ids as opaque strings. Prefixes have no runtime meaning. The
following naming scheme is an authoring recommendation:

```text
library.<domain>.<subject>.<check>
library.<domain>.pipe_<block>
library.<domain>.cond_<condition>
library.<domain>.pred_<predicate>
entrypoints.<scenario>
entrypoints.<scenario>.<subject>.<check>
```

Keep names stable and case-consistent. A renamed exported pipeline is a public API
change even when behavior is unchanged.

## Pipeline composition

Use exact string references:

```json
{
  "id": "entrypoints.checkout.validation",
  "type": "pipeline",
  "steps": [
    "library.checkout.pipe_customer",
    "library.checkout.pipe_order",
    "entrypoints.checkout.cond_promo"
  ]
}
```

List public pipelines in the authoring manifest `exports`; do not put `entrypoint` in
the pipeline. Do not use `flow`, object steps, `stepId`, relative ids, or aliases in the
snapshot.

## Builder obligations

Before compilation, the builder must:

1. parse every source file and reject missing or duplicate source ids;
2. remove only source-level `id` from artifact values;
3. keep artifact schemas closed rather than silently dropping unknown fields;
4. copy the already sorted, unique manifest `exports` into the snapshot;
5. set `formatVersion: 2` and `specVersion: "1.0.0-rc.5"`;
6. compute `sourceHash` over the whole snapshot without `sourceHash`;
7. call `compileSnapshot` with the exact deployed operator registry;
8. reject unreachable artifacts instead of pruning them silently.

Keep `project`, `catalog`, ownership, descriptions, build timestamps, ruleset version,
and operator-pack identity in authoring or build metadata outside the snapshot.

## Promotion checklist

Before moving an artifact into `library`, confirm:

- at least two scenarios reuse it or reuse is explicitly required;
- paths, messages, issue codes, and prerequisites have the same meaning;
- required `$context.*` dependencies are documented;
- samples cover each consumer;
- catalog metadata remains understandable outside the original scenario.
