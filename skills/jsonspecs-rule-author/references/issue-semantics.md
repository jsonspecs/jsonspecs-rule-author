# Issue semantics for RC.7

Use this reference for issue codes, fields, messages, aggregates, and multi-field rules.

## Authored issue

Put issue data under `rule.issue`:

```json
{
  "id": "customer.email.format",
  "type": "rule",
  "operator": "matches_regex",
  "field": "customer.email",
  "value": "^[^@]+@[^@]+$",
  "issue": {
    "level": "ERROR",
    "code": "CUSTOMER.EMAIL.FORMAT",
    "message": "Проверьте адрес электронной почты"
  }
}
```

Do not use top-level `level`, `code`, `message`, or `meta`. `issue.code` must be unique
across the complete snapshot. Optional `issue.meta` is hashed and copied verbatim into
every issue created by the rule.

## Runtime attribution

The engine chooses `field`; authors do not set a second issue field:

- a normal field rule uses its resolved concrete path;
- an `EACH` wildcard issue uses the concrete matched path;
- a summary aggregate uses the wildcard pattern;
- `any_filled` and a custom operator without primary `field` use `field: null`.

`ruleId` is the artifact-map key. `pipelineId` is the immediately enclosing pipeline,
including an internal nested pipeline. Do not assert a different pipeline in samples.

## Multi-field checks

Use built-in `any_filled` for “phone or email is required”:

```json
{
  "id": "customer.contact.required",
  "type": "rule",
  "operator": "any_filled",
  "fields": ["customer.phone", "customer.email"],
  "issue": {
    "level": "ERROR",
    "code": "CUSTOMER.CONTACT.REQUIRED",
    "message": "Укажите телефон или электронную почту"
  }
}
```

The resulting issue has `field: null`; do not invent a source `field` alongside
`fields`. Follow it with conditional format checks for each present contact.

For a cross-field comparison, the primary field is the authored `field`; the resolved
`value_field` value becomes `expected`. Choose operand direction so the issue points to
the field the user should fix.

## Levels and flow

- `WARNING`: creates a non-blocking issue.
- `ERROR`: creates a blocking issue, but execution continues.
- `EXCEPTION`: creates a business-stop issue and halts all remaining steps.

Technical operator failures produce `ABORT`, discard accumulated business issues, and
return no authored issue. An operator cannot choose issue level or create its own issue.

## Aggregate issues

For wildcard `ALL`/`ANY`:

- `issueMode: "EACH"` creates issues for failed elements when the aggregate fails;
- `issueMode: "SUMMARY"` creates one issue with normative `details`.

`COUNT` always creates one summary issue on failure and forbids `issueMode`.
`onEmpty: "FAIL"` creates one summary issue even when `EACH` was configured. Sample the
exact expected field and details for summary behavior.

## Codes and messages

- Keep one stable machine-readable code per semantic problem.
- Use domain names such as `CUSTOMER.EMAIL.FORMAT`, not operator names.
- Tell the user what is wrong or what to fix.
- Keep implementation details and raw regular expressions out of messages.
- Treat code, field, level, and issue order as public behavior when consumers depend on
  them.
