# Issue semantics

Use this reference when designing rule codes, fields, messages, multi-field checks, and guard rules.

## Single-field issue model

A jsonspecs runtime issue has one primary `field`. Design rules around that constraint.

For a single-field check:

```json
{
  "field": "customer.email",
  "code": "CUSTOMER.EMAIL.FORMAT",
  "message": "Некорректный формат email"
}
```

For a multi-field check, choose deliberately:

- split into separate rules when each field can fail independently;
- use the field the user must fix first;
- use the group/root field when the error belongs to the relationship rather than one field;
- document related fields in the message or artifact description.

Do not assume `rule.meta.fields` will become multiple issue fields.

## Contact/choice rules

Rules such as "phone or email is required" are not ordinary phone or email format rules.

Prefer a dedicated group-level rule:

```json
{
  "id": "library.checkout.customer.contact_required",
  "operator": "any_filled",
  "fields": ["customer.phone", "customer.email"],
  "field": "customer",
  "code": "CUSTOMER.CONTACT.REQUIRED",
  "message": "Укажите телефон или email"
}
```

Then use conditional format checks:

- if `customer.phone` is filled, validate phone format;
- if `customer.email` is filled, validate email format.

## Guard before business

Separate contract completeness from business comparisons.

Bad pattern:

- compare `promo.expiresAt` with current date without first requiring `promo.expiresAt` when `promo.code` exists.

Good pattern:

1. `promo.code` present predicate;
2. condition: when promo code is present, require `promo.expiresAt`;
3. condition or later check: when required promo data is complete, compare expiry date and order threshold.

This avoids reporting "promo expired" when the actual problem is "promo expiry is missing".

## Code and level policy

- Use stable machine-readable codes: `DOMAIN.SUBJECT.PROBLEM`.
- Keep one code per semantic problem.
- Use `ERROR` for validation failures that block the scenario.
- Use `WARNING` for non-blocking business advice.
- Use `EXCEPTION` only when the scenario must stop immediately.

## Message policy

Messages should tell the user what is wrong and what to fix. Do not leak implementation details, operator names, or raw regex patterns unless the user needs them.
