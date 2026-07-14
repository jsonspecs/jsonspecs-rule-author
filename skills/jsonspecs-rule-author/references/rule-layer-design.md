# Rule Layer Design

Use this reference when deciding what belongs in a jsonspecs rules layer and what belongs in application code, workflow orchestration, or integration adapters.

## Rules layer purpose

The rules layer should make business checks transparent, reviewable, testable, and versioned.

Good responsibilities:

- validate request completeness and business eligibility;
- check formats, dictionaries, cross-field consistency, dates, identifiers, and business prohibitions;
- return stable issue codes and business-readable messages;
- provide trace/provenance for audit and explanation;
- stay deterministic for `payload + context`.

Poor responsibilities:

- call external systems;
- enrich or mutate domain data;
- perform routing, persistence, retries, or workflow lifecycle decisions;
- hide transport mapping or integration DTO construction;
- become a general-purpose scripting layer for arbitrary backend logic.

## Boundary contract

Design the rules runtime around this contract:

```text
input  = payload + context
output = status + control + issues + trace + ruleset provenance
```

`payload` is the business object under validation. `$context` is execution metadata such as current date, tenant, merchant, feature flags, jurisdiction, or channel.

Document every `$context.*` dependency in the entrypoint `required_context` or project docs. Avoid hidden ambient state.

## Status and control

Use the jsonspecs runtime status vocabulary:

- `OK`: no blocking issue;
- `OK_WITH_WARNINGS`: only non-blocking warning issues were produced;
- `ERROR`: validation issue that blocks the scenario;
- `EXCEPTION`: business stop that is not an ordinary field fix;
- `ABORT`: runtime or infrastructure failure normalized by the engine.

Use issue levels separately:

- `WARNING`: non-blocking business advice;
- `ERROR`: blocking validation issue;
- `EXCEPTION`: business stop.

Do not let the rules layer decide the full process outcome. The host application or workflow maps rules output to process outcomes.

## Design questions

Before writing rules, answer:

- What business scenario is this entrypoint validating?
- Which fields are target contract fields?
- Which values are reference/dictionary values?
- Which checks depend on current date or tenant context?
- Which checks are hard rejects, soft warnings, or manual-review signals?
- Which decisions must be visible to business reviewers?
- Which checks are better as ordinary application code because they mutate data or call external systems?
