# Scenario composition

Use this reference when designing exported pipelines, reusable blocks, and conditions.

## Exported pipeline

An entrypoint is a pipeline id listed in snapshot `exports`:

```json
{
  "id": "entrypoints.application.submit",
  "type": "pipeline",
  "steps": [
    "library.application.pipe_type",
    "library.application.pipe_identity",
    "entrypoints.application.submit.cond_documents",
    "entrypoints.application.submit.prohibited"
  ]
}
```

The source manifest contains:

```json
{
  "exports": ["entrypoints.application.submit"]
}
```

Do not use `entrypoint`, `flow`, or object steps. Keep internal pipelines out of
`exports`; callers may run only exported ids.

## Composition order

Order steps so that issue order tells a coherent business story:

1. required context and scenario category;
2. required identity and relationship fields;
3. type and format prerequisites;
4. contacts and choice groups;
5. documents and addresses;
6. cross-field consistency and domain algorithms;
7. prohibitions and `EXCEPTION` stops;
8. advisory warnings.

Rules v4 continues after `ERROR`; it stops only after an `EXCEPTION` issue or technical
`ABORT`. Use a condition when a later failure would be misleading unless an earlier
type, format, dictionary, or business prerequisite passed.

## Conditions

Use predicate rules without `issue` for clear guards:

```json
{
  "id": "application.pred_type_company",
  "type": "rule",
  "operator": "equals",
  "field": "application.type",
  "value": "COMPANY"
}
```

```json
{
  "id": "application.cond_company",
  "type": "condition",
  "when": {
    "all": [
      "application.pred_type_company",
      { "not": "application.pred_is_draft" }
    ]
  },
  "steps": ["application.company.inn_required"]
}
```

`all` and `any` short-circuit left to right. Place cheap, safe predicates before custom
operators that can fail technically. `when` never creates issues, even if a referenced
rule contains `issue`.

## Reuse policy

Start scenario-local. Promote to `library.*` only when the same paths, prerequisites,
issue meaning, and code policy apply to more than one scenario.

Prefer a shared pipeline over copying the same step list. Do not create shared blocks
that branch on consumer identity or contain scenario-specific messages.

## Authoring matrix

| Block | Paths | Context | Guard | Issues | Notes |
|---|---|---|---|---|---|
| Identity | `customer.inn` | none | present → format | `CUSTOMER.INN.*` | checksum after format |
| Dates | `status.startDate` | `$context.currentDate` | context present | `STATUS.*` | explicit date format |

Use the matrix to distinguish step rules with `issue`, predicate-only rules, conditions,
shared pipelines, dictionaries, and custom operators.
