# Manifest catalog policy

Use this reference when editing `manifest.json` or reviewing Studio display quality.

## Manifest-first workflow

Before writing artifacts, add or update catalog metadata:

```json
{
  "catalog": {
    "fields": {
      "customer.phone": {
        "title": "Телефон клиента",
        "description": "Контактный телефон для связи по заказу"
      }
    },
    "entrypoints": {
      "entrypoints.checkout.validation": {
        "title": "Проверка заказа при оформлении",
        "description": "Валидация чекаута перед созданием заказа"
      }
    },
    "artifacts": {
      "library.checkout.customer.name_required": {
        "title": "Имя обязательно",
        "description": "Проверяет, что имя клиента заполнено"
      }
    },
    "operators": {
      "tax_id_valid": {
        "description": "должен быть корректным ИНН"
      }
    }
  }
}
```

## Field metadata

- `catalog.fields[field].title` is the primary label shown to users.
- `description` is explanatory text, not the primary label.
- Add exact keys for wildcard rule fields such as `order.items[*].sku`.
- Treat `$context.*` as context metadata. Document it in project docs or artifact descriptions; do not force it into payload field catalog unless the UI needs it.

## Entrypoint metadata

Every `entrypoint: true` pipeline must have `catalog.entrypoints[id]` with:

- `title`: short page/card label;
- `description`: what request or business scenario this entrypoint validates.

## Artifact metadata

Add `catalog.artifacts[id]` for artifacts that appear in Studio flows or user-facing diagnostics:

- rules included in entrypoint flows;
- conditions with business meaning;
- reusable library pipelines;
- predicates whose title appears inside condition trees.

Low-level helper predicates may still need titles when condition rendering would otherwise show opaque ids.

## Operator metadata

For custom operators, provide either:

- `manifest.catalog.operators[operator].description`, or
- operator-pack `meta.operators[operator].description`.

Use business language. Do not expose implementation names as the only explanation.

## Studio verification

Run Studio when labels matter:

```bash
jsonspecs studio --host 127.0.0.1 --port 3100
```

Check:

- field labels prefer `title`, not `description`;
- entrypoint cards are understandable;
- condition trees use human artifact titles;
- deep links to rules and artifacts work after refresh.
