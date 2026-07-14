# Package Boundary

Use this reference when designing a reusable rules package and its public boundary.

## Package contents

A production rules package should make these parts explicit:

- `manifest.json`: package identity, paths, entrypoints, catalog, operator packs;
- `rules/`: source artifacts;
- `samples/`: executable examples and contract edge cases;
- `operators/`: custom operators, if any;
- `dist/snapshot.json`: reproducible build output;
- `dist/build-info.json` or equivalent provenance data when available.

## Public boundary

Treat entrypoints as the package API. Consumers should call named entrypoints, not internal blocks.

Public:

- entrypoint ids;
- expected `payload` fields;
- required `$context` fields;
- issue codes and levels;
- operator pack contract;
- package version and build hash.

Internal:

- helper predicates;
- scenario-local conditions;
- private library block structure;
- file layout details beneath `rules/`.

## Versioning

Classify changes before release:

- Patch: wording, catalog title improvements, new samples, non-behavioral refactor.
- Minor: new optional checks, new entrypoints, new warnings that do not block existing valid requests.
- Major: changed input contract, removed entrypoint, changed issue code, changed blocking behavior, changed required context.

If a package is consumed by several services, document whether consumers pin exact versions or ranges.

## Samples as executable documentation

Samples should cover:

- valid request;
- each major reject family;
- edge cases for optional fields and branch predicates;
- warning-only cases when supported;
- malformed-but-JSON-safe custom operator inputs.

Keep samples close to business scenarios. Do not create only microscopic unit-like samples unless they are paired with scenario-level examples.

