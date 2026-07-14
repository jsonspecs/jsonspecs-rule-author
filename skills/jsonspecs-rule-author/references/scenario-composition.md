# Scenario Composition

Use this reference when designing entrypoints, reusable blocks, and scenario-level validation flows.

## Entrypoint shape

An entrypoint should read like a business scenario:

```json
{
  "id": "entrypoints.application.submit.validation",
  "type": "pipeline",
  "entrypoint": true,
  "flow": [
    { "pipeline": "library.application.blocks.type" },
    { "pipeline": "library.application.blocks.identity" },
    { "pipeline": "library.application.blocks.contacts" },
    { "pipeline": "library.application.blocks.documents" },
    { "pipeline": "library.application.blocks.tax" }
  ]
}
```

Avoid entrypoints that are long flat lists of low-level checks. They are hard to review, reorder, and explain.

## Recommended block order

Start with checks that make later checks meaningful:

1. Scenario/type/category checks.
2. Required identity fields.
3. Required relationship/account/status fields.
4. Contacts and choice groups.
5. Document and address blocks.
6. Tax/regulatory flags.
7. Cross-field consistency.
8. Business prohibitions and exception stops.
9. Warning-only quality checks.

The order may differ by domain, but dependent checks must not run before their prerequisites.

## Reuse policy

Create scenario-local blocks first. Promote to `library.*` only when reuse is real or explicitly planned.

Good shared blocks:

- common contact choice;
- date order with the same field contract;
- identifier format/checksum with the same semantic meaning;
- document-type-specific checks reused by several entrypoints.

Bad shared blocks:

- code that branches by scenario or client type;
- blocks with messages that only make sense in one scenario;
- blocks that share field names but not business meaning.

## Matrix before implementation

For each scenario, write a compact matrix:

| Block | Fields | Context | Issues | Notes |
|---|---|---|---|---|
| Identity | `customer.inn` | none | `CUSTOMER.INN.*` | required -> format -> checksum |
| Dates | `status.startDate`, `status.endDate` | `$context.currentDate` | `STATUS.*` | end date optional |

Use the matrix to decide which artifacts should be predicates, conditions, checks, or pipelines.

