# Operator policy

Use this reference before creating, reviewing, or approving custom operators.

## Default decision tree

1. Try a built-in operator.
2. Combine built-ins through predicates, conditions, dictionaries, and pipelines.
3. Use a dictionary for enumerations and externally managed value sets.
4. Use a custom operator only for domain logic that cannot be represented clearly, safely, or maintainably in DSL.
5. Document the custom operator in `manifest.catalog.operators` or operator-pack `meta.operators`.

## Built-in operator coverage

Built-ins cover the common cases:

```text
not_empty
is_empty
equals
not_equals
matches_regex
length_equals
length_max
contains
greater_than
less_than
in_dictionary
any_filled
field_equals_field
field_not_equals_field
field_less_than_field
field_greater_than_field
field_less_or_equal_than_field
field_greater_or_equal_than_field
```

Several operators support wildcard and aggregate modes. Check the project engine documentation before inventing an operator for array-wide checks.

## Good custom operators

Custom operators are appropriate for stable domain algorithms:

- tax id checksum;
- domain-specific identifier validation;
- cryptographic or checksum validation;
- externally specified scoring logic;
- locale-specific date or document validation that is not a simple regex.

## Bad custom operators

Do not create custom operators for:

- stricter aliases of `matches_regex`;
- `required_if` that can be represented as predicate + condition + `not_empty`;
- `one_of` that should be a dictionary + `in_dictionary`;
- field comparisons already covered by `field_*` operators;
- convenience wrappers that only rename built-ins.

## Required custom operator contract

Every custom operator must have:

- a concise rationale: why built-ins are insufficient;
- deterministic behavior for JSON-safe inputs;
- no prototype-chain reads or mutation of `ctx.payload`;
- stable return shape compatible with jsonspecs operator contracts;
- sample coverage for pass/fail and malformed-but-JSON-safe inputs;
- a human-readable description in operator metadata.

## Review questions

- Can this be a dictionary?
- Can this be `matches_regex` with a named rule and clear message?
- Can this be a predicate condition around a normal check?
- Is the operator reusable outside one entrypoint?
- Will a business analyst understand the rule without reading JavaScript?
