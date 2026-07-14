# Guard Patterns

Use this reference when ordering rules so users see the primary problem instead of noisy dependent errors.

## Core principle

Do not run a dependent business check unless the data it depends on is present and structurally valid.

Bad:

```json
[
  { "rule": "customer.inn_required" },
  { "rule": "customer.inn_format" },
  { "rule": "customer.inn_checksum" }
]
```

If `inn` is empty, this can report required, format, and checksum at once.

Good:

```json
[
  { "rule": "customer.inn_required" },
  { "condition": "customer.cond_inn_if_present" }
]
```

`cond_inn_if_present` runs format only when the field is present. Checksum runs only when the format predicate passes.

## Common chains

Identifier:

```text
required -> if_present -> format -> checksum
```

Identifier with mask:

```text
required -> if_present -> length/format -> mask -> checksum
```

Dictionary/type:

```text
required -> if_present -> dictionary -> type_specific_block
```

Dates:

```text
required -> if_present -> format -> not_future/not_past -> cross_date_order
```

Optional dates:

```text
if_present -> format -> business comparison
```

Country:

```text
required -> if_present -> country_format -> allowed/forbidden country
```

Boolean/regulatory flag:

```text
required -> is_boolean -> value_constraint
```

Choice group:

```text
one_of_required -> each_present_value_format
```

Document type:

```text
type_required -> type_supported -> type_specific_required_fields
```

## Custom operator inputs

Guard custom operators especially carefully. A custom operator should not receive malformed dates, absent identifiers, or unsupported types unless its contract explicitly says how those inputs are handled.

If a custom operator cannot produce a valid check result for malformed inputs, guard it with predicates rather than relying on the operator to return a special status.

## Error priority

Prefer one primary fix per field:

- missing field: report `REQUIRED`, not `FORMAT`;
- invalid format: report `FORMAT`, not checksum or date order;
- unsupported type: report unsupported type, not required fields for that type;
- expired date: do not also report date order unless both are independently meaningful to the business user.

