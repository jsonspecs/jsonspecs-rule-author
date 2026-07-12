# Artifact layout and naming

Use this reference when creating, moving, or reviewing `rules/` files.

## Directory policy

- `rules/library/`: reusable artifacts that are intentionally shared by more than one entrypoint or by a stable domain concept.
- `rules/entrypoints/<entrypoint>/`: scenario-specific pipelines, conditions, predicates, and checks used only by one entrypoint.
- `rules/dictionaries/`: dictionary artifacts.
- `operators/node/`: project-local custom operators.
- `samples/`: executable examples grouped by behavior or entrypoint.

Do not put scenario-specific artifacts in `rules/library` merely because they might be useful later. Promote to `library` only after reuse is real or explicitly planned.

## Id policy

Ids should reflect scope:

```text
library.<domain>.<subject>.<rule>
library.<domain>.pipelines.<block>
library.<domain>.conditions.<condition>
library.<domain>.predicates.<predicate>

entrypoints.<scenario>.<pipeline>
entrypoints.<scenario>.checks.<rule>
entrypoints.<scenario>.conditions.<condition>
entrypoints.<scenario>.predicates.<predicate>

dictionaries.<domain>.<name>
```

Use predictable snake_case suffixes:

- checks: `amount_required`, `currency_allowed`, `items_sku_format`;
- predicates: `courier_selected`, `promo_code_present`;
- conditions: `cond_courier_checks`, `cond_promo_checks`;
- pipelines: `validation`, `b2b_validation`, `common_customer_checks`.

## File policy

Keep filenames aligned with ids:

```text
rules/library/checkout/checks/customer_name_required.json
rules/library/checkout/pipelines/common_customer_checks.json
rules/entrypoints/checkout/validation.json
rules/entrypoints/checkout/conditions/cond_promo_checks.json
rules/dictionaries/payment_methods.json
```

One artifact per JSON file is the preferred production layout because diffs, source diagnostics, and review comments stay precise.

## Pipeline composition

Use library pipelines for shared blocks:

```json
{
  "id": "entrypoints.checkout.validation",
  "type": "pipeline",
  "flow": [
    { "pipeline": "library.checkout.pipelines.customer_common" },
    { "pipeline": "library.checkout.pipelines.order_common" },
    { "condition": "entrypoints.checkout.conditions.cond_promo_checks" }
  ],
  "entrypoint": true
}
```

Do not copy the same rule refs into several entrypoints. Duplication makes ordering and future changes unreliable.

## Promotion checklist

Before moving an artifact into `library`, confirm:

- the id is not tied to a single entrypoint;
- messages and codes are not scenario-specific;
- required context is documented;
- samples cover at least one consumer entrypoint;
- `manifest.catalog.artifacts[id]` has a clear title.
