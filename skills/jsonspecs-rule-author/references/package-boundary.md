# Package boundary

Use this reference for reusable rules packages and their public contract.

## Package contents

- `manifest.json`: authoring identity, paths, exports, and catalog.
- `rules/`: source artifacts carrying source-level ids.
- `samples/`: executable calls and expected result projections.
- `operators/`: flat v3 operator registries, if needed.
- `dist/snapshot.json`: closed formatVersion 2 executable snapshot.
- `dist/build-info.json`: non-normative deployment metadata.

## Public contract

Treat snapshot `exports` as the callable API. Publish for each exported pipeline:

- nested payload and context contract;
- issue codes, levels, fields, and stable ordering where relied on;
- business meaning of `EXCEPTION`;
- package version and exact snapshot `sourceHash`;
- required operator-pack identity, version, and digest outside the snapshot.

Internal pipelines, conditions, predicate rules, source folders, and catalog ids are not
callable unless listed in `exports`.

## Versioning

Classify by consumer impact:

- patch: wording/catalog improvements, tests, or a behavior-preserving refactor that
  leaves the built snapshot behavior unchanged;
- minor: new export, optional warning, or backward-compatible capability;
- major: removed/renamed export, new blocking requirement, changed issue code/field,
  changed context contract, or changed business outcome for existing valid input.

Changing only authoring file layout may still change `sourceHash` if the lowered
snapshot changes. Verify the built data rather than assuming a refactor is neutral.

## Reproducibility

Build information should record at least:

- package id and semantic version;
- `specVersion` and snapshot `sourceHash`;
- exported pipeline ids;
- `@jsonspecs/rules` version used for compilation;
- operator-pack id, version, and immutable digest;
- source revision and build environment identity when required by governance.

Do not add these fields to the closed snapshot or normative runtime `ruleset` object.
