# Custom operator policy for Rules v3

Read this reference before adding, migrating, or approving a custom operator.

## Decision order

1. Use a built-in operator.
2. Compose built-ins with predicate rules, conditions, pipelines, and dictionaries.
3. Add a custom operator only for stable domain logic that cannot be expressed clearly
   and safely with those primitives.

Built-ins cover presence, types, equality, string containment and length, portable
regular expressions, numeric/date ordering, field-to-field comparison, and dictionary
membership. See `rules-v3-contract.md` for the complete list.

Appropriate custom operators include checksums, regulated identifier algorithms,
cryptographic verification over supplied values, and versioned domain scoring.

Do not add aliases around built-ins, `required_if`, ordinary enumerations, host-specific
regular-expression wrappers, or convenience operators that read the whole request.

## Node.js contract

Register one immutable name directly as `{ schema, evaluate }`:

```js
module.exports = Object.freeze({
  tax_id_valid: Object.freeze({
    schema: Object.freeze({
      type: "object",
      properties: Object.freeze({ field: { type: "string", minLength: 1 } }),
      required: Object.freeze(["field"]),
      additionalProperties: false
    }),
    evaluate({ field }) {
      return validTaxId(field) ? "PASS" : "FAIL";
    }
  })
});
```

The old `{ check, predicate }` pack and `(rule, ctx)` function contract are not Rules
v3. The operator receives resolved values, not paths, payload, context, `ctx.get`,
`ctx.has`, a resolver, or the rule use site.

## Schema requirements

- Close the top configuration object with a finite explicit property set.
- If `inputs` is accepted, close it and enumerate all allowed names.
- If `params` is accepted, close its immediate object and enumerate all allowed names.
- Declare required configured input names in the schema. This requires the path in the
  rule, not the value in every runtime input.
- Do not accept `fields`; it is reserved for built-in `any_filled`.
- Keep `value` and `value_field` mutually exclusive.

Use `field` or `value_field` for value semantics. If the operator must observe that a
path is missing, model that dependency as a named `inputs` member and handle absence via
`"name" in inputs`.

## Evaluation requirements

- Return exactly `PASS`, `FAIL`, or `SKIP` synchronously.
- Do not throw for malformed-but-JSON-safe business input; return a declared outcome.
- Do not read time, locale, network, environment variables, or mutable process globals.
- Do not mutate invocation data.
- Never return `EXCEPTION`; business stops come from `rule.issue.level`.

A thrown value becomes `ABORT OPERATOR_FAULT`. Any other return value becomes
`ABORT OPERATOR_CONTRACT_VIOLATION`.

## Release evidence

Document why built-ins are insufficient. Add golden vectors for pass, fail, skip,
missing named inputs, JSON `null`, wrong JSON-safe types, and boundary values.

For equivalent operators in several runtimes, version the operator pack separately,
publish equivalent closed schemas, run the same vectors everywhere, and record each
deployed package version and digest outside the snapshot.
