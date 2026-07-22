# Guard patterns for Rules v4

Use this reference to prevent dependent checks from producing misleading issues.

## Contents

- [Absence semantics](#absence-semantics)
- [Format before domain algorithm](#format-before-domain-algorithm)
- [Common chains](#common-chains)
- [Cross-field comparisons](#cross-field-comparisons)
- [Context guards](#context-guards)
- [Wildcards](#wildcards)
- [Unsupported branch anti-pattern](#unsupported-branch-anti-pattern)
- [Review test](#review-test)

## Absence semantics

Requiredness is always a separate presence rule. In Rules v4:

- `not_empty`, `is_empty`, `not_true`, and `any_filled` observe absent paths;
- every other built-in and every custom operator receives core-level `SKIP` when its
  configured `field` or `value_field` is absent;
- named custom-operator `inputs` do not trigger core-level `SKIP`; unresolved inputs are
  omitted from `invocation.inputs`.

This direct sequence is safe for an absent value because the second rule skips:

```json
{
  "type": "pipeline",
  "steps": ["customer.inn.required", "customer.inn.format"]
}
```

It does not stop a malformed non-empty value from reaching later checks. Use a condition
when format, type, dictionary membership, or another business prerequisite must pass
before the next check has meaning.

## Format before domain algorithm

```text
required step
format step
condition when format predicate passes
  checksum/domain step
```

Use separate format artifacts when both an issue-producing step and a guard are needed:

- `customer.inn.format` contains `issue` and appears as a step;
- `customer.inn.pred_format` may use the same operator without `issue` in `when`;
- `customer.inn.cond_checksum` gates the checksum step.

This duplication is semantic, not accidental: one rule reports a problem, while the
other is a side-effect-free condition leaf. If the project allows a rule with `issue` in
`when`, reuse it there; RC.7 ignores `issue` during `when` evaluation.

## Common chains

Identifier:

```text
required → format → if format passes: checksum
```

Type-specific document:

```text
type required → type supported → if supported type: type-specific required fields
```

Dates:

```text
required context date → required business date → format → if both formats pass: compare
```

Optional date:

```text
if present → format issue → if format passes: business comparison
```

Boolean policy:

```text
required → type is boolean → if type passes: value constraint
```

Numeric range:

```text
required → type is number → if type passes: range
```

Choice group:

```text
any_filled step → for each present choice: format condition
```

Dictionary branch:

```text
required → supported dictionary value → if supported: branch-specific block
```

Format-sensitive algorithm:

```text
format → if format passes: algorithm
```

## Cross-field comparisons

Cross-field operators skip if either operand is absent. They do not verify that strings
are valid dates, numbers are in the domain range, or categories are supported. Gate a
comparison behind prerequisite predicates when an invalid-but-present value would make
the comparison issue misleading.

## Context guards

There is no `required_context` artifact field. Context completeness is checked by
analyst-authored rules inside `steps`, like payload completeness. Use `not_empty` on
required `$context.*` paths as early steps, then gate format-sensitive or
domain-sensitive comparisons as usual.

## Wildcards

For a wildcard rule, decide separately:

- whether no structural matches means `PASS`, `FAIL`, or `SKIP` via `onEmpty`;
- whether `ALL`/`ANY` failures are per element (`EACH`) or one group issue (`SUMMARY`);
- whether `COUNT` expresses the real business rule better.

Every match is evaluated; aggregate modes do not short-circuit. Guard the operator's
input contract before a custom wildcard rule where possible, and sample empty, all-pass,
mixed, all-fail, and all-skip populations that matter to the scenario.

RC.7 enumerates real array indices. After the final wildcard, an omitted or impassable
child remains an absent structural candidate. Therefore `not_empty` on `items[*].sku`
with `issueMode: "EACH"` can report a concrete path such as `items[1].sku`. `onEmpty`
means that the whole expression has zero structural candidates; it does not handle an
omitted child in an existing item. Before a later wildcard, an impassable branch creates
no candidate because there is no real next array to enumerate.

Do not use an aligned wildcard `value_field`; RC.7 does not define element pairing
between two wildcard paths. Treat exact index tokens as decimal strings with no
implementation-sized upper bound and never round them through `Number`.

## Unsupported branch anti-pattern

A predicate such as `reason not_equals "DEFECT"` proves only inequality. It does not
prove that `reason` belongs to the supported dictionary. Before entering a supported
branch, combine it with an `in_dictionary` predicate for the same field:

```text
when all: reason is in supported dictionary, reason is not DEFECT
```

Otherwise an unknown value can enter a branch intended for known non-defect reasons.

## Review test

For each issue-producing rule, ask: “Can the user fix this issue without first fixing a
different prerequisite?” If not, add or strengthen a condition.
