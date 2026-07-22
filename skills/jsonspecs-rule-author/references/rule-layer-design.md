# Rule layer design

Use this reference to decide what belongs in jsonspecs and what remains application,
workflow, or integration logic.

## Suitable responsibilities

- request completeness and type checks;
- eligibility, prohibitions, and deterministic business comparisons;
- dictionaries, formats, dates, identifiers, and cross-field consistency;
- stable issue codes, levels, fields, and business-readable messages;
- deterministic decisions from nested `payload` plus explicit `context`.

Keep these outside the rules engine:

- external calls, database reads, and mutable caches;
- enrichment or mutation of business data;
- transport mapping, persistence, retries, and workflow lifecycle;
- time, locale, tenant, or feature flags read from ambient process state;
- deployment identity and audit persistence.

## Runtime contract

```text
input  = pipelineId + payload + optional context
output = status + issues + ruleset + error only on ABORT
```

`$context.*` paths resolve against the separate `context` object. The special
`payload.__context` convention does not exist in RC.7.

The snapshot cannot declare `required_context`. The analyst adds an ordinary presence
rule such as `not_empty` on every required `$context.*` path and places it before
dependent checks. Document the context contract in the catalog or project docs.

## Status boundary

- `OK`: no issues.
- `OK_WITH_WARNINGS`: warning issues only.
- `ERROR`: at least one error and no exception.
- `EXCEPTION`: a business stop from an `EXCEPTION` issue.
- `ABORT`: the accepted call could not be evaluated because input or an operator failed.

There is no `control` field. The host maps `status` and issue codes to its process
outcomes. Trace and implementation diagnostics, when needed, use a separate
non-normative interface.

## Design questions

- Which business scenario does each exported pipeline validate?
- Which input and context paths form its contract?
- Which payload and context values are required, and which issue level should each use?
- Which issue levels are blocking, advisory, or immediate business stops?
- Which values are versioned dictionaries?
- Which checks need custom domain code after built-ins are exhausted?
- Which package and operator-pack identity must deployment logs retain outside the
  runtime result?
