# Rules v4 and Spec 1.0.0-rc.7 contract

Use this reference as the compatibility baseline. It summarizes the executable
contract. Project layout, manifest shape, catalog fields, and build information are
authoring conventions, not fields defined by the behavior specification.

## Contents

- [Strict JSON boundary](#strict-json-boundary)
- [Migration from Rules v3 and RC.5](#migration-from-rules-v3-and-rc5)
- [Snapshot boundary](#snapshot-boundary)
- [Artifact forms](#artifact-forms)
- [Rule and issue semantics](#rule-and-issue-semantics)
- [Wildcards](#wildcards)
- [Collection structural checks](#collection-structural-checks)
- [Exact index tokens](#exact-index-tokens)
- [Built-in operators](#built-in-operators)
- [Custom operator boundary](#custom-operator-boundary)
- [Runtime boundary](#runtime-boundary)

## Strict JSON boundary

Snapshots, payloads, context, authoring files, samples, and Sandbox requests must cross
an I-JSON boundary before ordinary host objects can erase transport violations. Reject
duplicate object members, unpaired UTF-16 surrogates, malformed UTF-8, non-finite or
overflowing binary64 numbers, invalid object keys, sparse arrays, and excessive depth as
specified. Use CLI v4 for authoring files and samples. Use `compileSnapshotText` when a
runtime receives raw snapshot text.

## Migration from Rules v3 and RC.5

When moving an authoring package to Rules v4 and RC.7:

1. pin Rules v4 and CLI v4 through `package.json` plus the lockfile;
2. set `manifest.specVersion` to `1.0.0-rc.7`;
3. rebuild the entire snapshot and recompute `sourceHash`; changing only the version
   still changes snapshot identity;
4. rerun every wildcard sample because RC.7 includes the incompatible structural
   candidate semantics introduced in RC.6;
5. replace application-side missing-child checks with authored wildcard presence rules
   when the rule layer owns that business requirement;
6. test omitted members, concrete `EACH` issue paths, empty collections, nested
   wildcards, and large exact index tokens;
7. let CLI v4 be the sole writer of canonical `dist` files and use any project-local
   builder only as a read-only independent comparison.

## Snapshot boundary

The executable snapshot is closed:

```json
{
  "format": "jsonspecs-snapshot",
  "formatVersion": 2,
  "specVersion": "1.0.0-rc.7",
  "sourceHash": "<64 lowercase hex>",
  "exports": ["entrypoints.order.validate"],
  "artifacts": {
    "entrypoints.order.validate": {
      "type": "pipeline",
      "steps": ["order.amount.required"]
    },
    "order.amount.required": {
      "type": "rule",
      "operator": "not_empty",
      "field": "order.amount",
      "issue": {
        "level": "ERROR",
        "code": "ORDER.AMOUNT.REQUIRED",
        "message": "Укажите сумму заказа"
      }
    }
  }
}
```

- `artifacts` is an id-to-artifact object. Artifact values have no `id`.
- `exports` is a non-empty, unique list of pipeline ids sorted by unsigned UTF-16 code
  units. It is both the public runtime API and the reachability root set.
- `sourceHash` is SHA-256 over RFC 8785 JCS serialization of the whole parsed snapshot
  after removing only `sourceHash`.
- Every artifact must be reachable from `exports`, including rules used in `when` and
  dictionaries referenced by rules.
- Artifact schemas are closed. Descriptions, file paths, ownership, tags, package
  version, operator-pack version, and build data stay outside the snapshot.

## Artifact forms

`rule` accepts `operator` and the operands declared by that operator: `field`, `fields`
for built-in `any_filled`, `value`, `value_field`, `dictionary`, named `inputs`, and
constant `params`. It may also contain `aggregate` and `issue`.

`condition` has exactly `type`, `when`, and non-empty string `steps`. `when` is a rule
id or one closed expression: `{ "all": [...] }`, `{ "any": [...] }`, or
`{ "not": ... }`. Leaves reference rules only.

`pipeline` has exactly `type` and non-empty string `steps`. Public pipelines are listed
in snapshot `exports`; there is no `entrypoint` field.

`dictionary` has exactly `type` and a non-empty `entries` array of unique non-null
scalars. Object entries and code/label aliases are authoring data and must be lowered by
the builder before snapshot creation.

A string step may reference a rule with `issue`, a condition, or a pipeline. It may not
reference a dictionary or a rule without `issue`.

## Rule and issue semantics

Every operator returns exactly `PASS`, `FAIL`, or `SKIP`. A rule has no check/predicate
role. In a step, `FAIL` creates an issue; in `when`, `PASS` is true and `FAIL`/`SKIP`
are false without creating an issue.

```json
"issue": {
  "level": "WARNING | ERROR | EXCEPTION",
  "code": "unique non-empty string",
  "message": "non-empty string",
  "meta": { "optional": "open author metadata" }
}
```

`WARNING` continues, `ERROR` continues, and `EXCEPTION` stops the whole execution after
preserving accumulated business issues. A technical failure returns `ABORT` with an
empty `issues` array.

Presence operators (`not_empty`, `is_empty`, `not_true`, `any_filled`) observe absence.
All other built-ins and every custom operator skip before invocation when a configured
`field` or `value_field` is absent. Named `inputs` do not cause core-level skip: missing
paths are omitted from the invocation map, so the custom operator can decide the
outcome. JSON `null` remains a present value.

## Wildcards

A wildcard `field` requires `aggregate`; `aggregate` is forbidden without `[*]`.

- `mode`: `ALL`, `ANY`, or `COUNT`.
- `onEmpty`: `PASS`, `FAIL`, or `SKIP`; default `SKIP`.
- `issueMode`: required as `EACH` or `SUMMARY` for `ALL`/`ANY` rules with `issue`;
  forbidden for predicate-only rules and `COUNT`.
- `COUNT` uses optional `op` (default `>=`) and required non-negative integer `value`.

`ALL`, `ANY`, and `COUNT` evaluate every structural candidate; they do not short-circuit.
`SKIP` values leave the effective population. `when` expressions do short-circuit from
left to right.

## Collection structural checks

RC.7 expands each `[*]` from real arrays in the nested payload. Every reached array
index creates a structural candidate. After the final wildcard, a missing or impassable
exact suffix remains one absent candidate with a concrete path. Therefore this rule can
require `sku` in every existing item:

```json
{
  "type": "rule",
  "operator": "not_empty",
  "field": "order.items[*].sku",
  "aggregate": {
    "mode": "ALL",
    "issueMode": "EACH",
    "onEmpty": "FAIL"
  },
  "issue": {
    "level": "ERROR",
    "code": "ORDER.ITEM.SKU.REQUIRED",
    "message": "Укажите артикул товара"
  }
}
```

An item without `sku` produces a concrete issue field such as
`order.items[1].sku`. Keep these distinctions:

- an empty, absent, wrong-type, or otherwise unreachable collection creates no
  candidates, so `onEmpty` applies;
- an absent child after the final wildcard is a candidate; presence operators observe
  it, while value operators return `SKIP`;
- an impassable branch before a later wildcard creates no branch because there is no
  real next array from which to enumerate indices;
- `matched` counts present and absent structural candidates, `evaluated` counts
  `PASS`/`FAIL`, and `skipped` counts `SKIP`;
- a path ending in `[*]` still uses the flattened-leaf model: a non-empty object or
  array is not exposed as a value merely because the wildcard reached it;
- named `inputs`, `value_field`, and `$context.*` paths cannot contain `[*]`;
- element-aligned comparison between two wildcard paths is not defined.

Sample empty collections, missing members, `null`, empty values, all-pass, mixed,
all-fail, and all-skip populations according to the authored aggregate semantics.

## Exact index tokens

An exact index token such as `[9007199254740993]` is decimal path syntax, not a JSON
number. It has no implementation-sized upper bound. Range-check it exactly and preserve
the authored digits in a concrete issue path. Do not convert it through JavaScript
`Number`, Java `double`, or a limited integer type that can round it.

Exact keys and indices are type-sensitive: a key traverses an own JSON-object member;
an index traverses only an in-range JSON-array element. An object key named `"0"` is not
the same as array index `[0]`.

## Built-in operators

Presence: `not_empty`, `is_empty`, `not_true`, `any_filled`.

Types: `is_boolean`, `is_string`, `is_number`, `is_integer`.

Values: `equals`, `not_equals`, `contains`, `matches_regex`, `not_matches_regex`,
`greater_than`, `less_than`, `length_equals`, `length_max`.

Cross-field: `field_equals_field`, `field_not_equals_field`,
`field_greater_than_field`, `field_less_than_field`,
`field_greater_or_equal_than_field`, `field_less_or_equal_than_field`.

Dictionaries: `in_dictionary`, `not_in_dictionary`.

Regular expressions use the portable RC.7 subset. Do not add `flags` or rely on host
JavaScript regular-expression extensions.

## Custom operator boundary

A Node.js operator registry maps each name directly to `{ schema, evaluate }`:

```js
module.exports = Object.freeze({
  "credit.age_at_least": Object.freeze({
    schema: Object.freeze({
      type: "object",
      properties: Object.freeze({
        inputs: Object.freeze({
          type: "object",
          properties: Object.freeze({ age: { type: "string", minLength: 1 } }),
          required: Object.freeze(["age"]),
          additionalProperties: false
        }),
        params: Object.freeze({
          type: "object",
          properties: Object.freeze({ minimum: { type: "integer", minimum: 0 } }),
          required: Object.freeze(["minimum"]),
          additionalProperties: false
        })
      }),
      required: Object.freeze(["inputs", "params"]),
      additionalProperties: false
    }),
    evaluate({ inputs, params }) {
      if (!("age" in inputs)) return "SKIP";
      return Number.isInteger(inputs.age) && inputs.age >= params.minimum
        ? "PASS"
        : "FAIL";
    }
  })
});
```

The schema validates authored rule configuration: operand path strings and constant
parameters. It does not validate the business value found at runtime. The schema must
explicitly close the top configuration object, the `inputs` object, and the immediate
`params` object. `evaluate` receives resolved values only and must safely handle every
JSON type. It never receives payload, context, paths, a resolver, time, locale, or the
rule use site.

## Runtime boundary

Compile and execute with the v4 API:

```js
const rules = require("@jsonspecs/rules");
snapshot.sourceHash = rules.computeSourceHash(snapshot);
const engine = rules.createEngine({ operators });
const prepared = engine.compileSnapshot(snapshot);
const result = engine.runPipeline(prepared, {
  pipelineId: "entrypoints.order.validate",
  payload,
  context
});
```

The normative result contains only `status`, `issues`, `ruleset`, and `error` on
`ABORT`. `ruleset` contains exactly `specVersion` and `sourceHash`. Store project
version, runtime version, operator-pack identity and digest, and deployment identity in
external build records and audit logs.
