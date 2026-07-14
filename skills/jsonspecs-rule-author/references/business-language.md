# Business Language

Use this reference when writing field titles, artifact titles, descriptions, messages, and Studio-facing labels.

## Write for reviewers, not implementers

Prefer business wording:

| Avoid | Prefer |
|---|---|
| `enum` | supported value / allowed category |
| `payload` | request / application / form |
| `boolean` | yes/no flag / признак |
| `true/false` | enabled/disabled, yes/no, positive/negative value |
| `operator` | check |
| `pipeline` | scenario / validation block |
| `regex` | format |
| raw artifact id | human title |

Examples:

- Bad: `Тип бенефициара должен входить в enum`.
- Good: `Тип бенефициара должен поддерживаться`.
- Bad: `Поле customer.email failed matches_regex`.
- Good: `Эл. почта указана в неверном формате`.

## Titles and descriptions

Use `title` as the primary UI label. Keep it short.

Use `description` to explain scope:

```json
{
  "title": "Дата регистрации указана",
  "description": "Проверяет, что дата регистрации организации заполнена"
}
```

Do not rely on `description` to compensate for unclear ids. Conditions and predicates also appear in Studio, so give them clear catalog titles.

## Messages

Messages should tell the user what is wrong or what to fix:

- `Не указан номер номинального счета`
- `Дата начала участия должна быть в формате YYYY-MM-DD`
- `Тип документа должен поддерживаться`

Do not expose implementation details unless the business user needs them. A regex can be encoded as `YYYY-MM-DD`, `10 цифр`, or another business-friendly format.

## Abbreviations

Use the product vocabulary. If the product says `эл. почта`, use that instead of a longer formal phrase.

Keep terms consistent across fields, rules, samples, docs, and Studio metadata.

