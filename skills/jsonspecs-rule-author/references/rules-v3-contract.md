# Rules v3 and Spec 1.0.0-rc.5 contract

Use this reference as the compatibility baseline. It summarizes the executable
contract. Project layout, manifest shape, catalog fields, and build information are
authoring conventions, not fields defined by the behavior specification.

## Contents

- [Snapshot boundary](#snapshot-boundary)
- [Artifact forms](#artifact-forms)
- [Rule and issue semantics](#rule-and-issue-semantics)
- [Wildcards](#wildcards)
- [Built-in operators](#built-in-operators)
- [Custom operator boundary](#custom-operator-boundary)
- [Runtime boundary](#runtime-boundary)

## Snapshot boundary

The executable snapshot is closed:

```json
{
  "format": "jsonspecs-snapshot",
  "formatVersion": 2,
  "specVersion": "1.0.0-rc.5",
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

`ALL`, `ANY`, and `COUNT` evaluate every structural match; they do not short-circuit.
`SKIP` values leave the effective population. `when` expressions do short-circuit from
left to right.

## Built-in operators

Presence: `not_empty`, `is_empty`, `not_true`, `any_filled`.

Types: `is_boolean`, `is_string`, `is_number`, `is_integer`.

Values: `equals`, `not_equals`, `contains`, `matches_regex`, `not_matches_regex`,
`greater_than`, `less_than`, `length_equals`, `length_max`.

Cross-field: `field_equals_field`, `field_not_equals_field`,
`field_greater_than_field`, `field_less_than_field`,
`field_greater_or_equal_than_field`, `field_less_or_equal_than_field`.

Dictionaries: `in_dictionary`, `not_in_dictionary`.

Regular expressions use the portable RC.5 subset. Do not add `flags` or rely on host
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

The schema must explicitly close the top configuration object, the `inputs` object,
and the immediate `params` object. `evaluate` receives resolved values only. It never
receives payload, context, paths, a resolver, time, locale, or the rule use site.

## Runtime boundary

Compile and execute with the v3 API:

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
