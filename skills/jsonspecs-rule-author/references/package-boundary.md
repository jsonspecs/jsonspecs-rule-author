# Package boundary

Use this reference for reusable rules packages and their public contract.

## Package contents

- `manifest.json`: authoring identity, paths, exports, and catalog.
- `rules/`: source artifacts carrying source-level ids.
- `samples/`: executable calls and expected result projections.
- `operators/`: flat v3 operator registries, if needed.
- a host-boundary module for structural invariants Rules v3 cannot express, if needed;
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

## Host-boundary checks

Do not publish a payload requirement that is enforced only by prose. When collection
shape or another invariant cannot be expressed by RC.5, keep a small executable module
with the package. The service example must invoke it before `runPipeline`, and the main
test command must cover each required member, wrong collection shape, and wrong item
shape. Keep these host errors separate from the closed Rules v3 result contract.

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
- requested dependency range plus the lockfile's exact registry URL and integrity hash;
- operator-pack id, version, and immutable digest;
- source revision and build environment identity when required by governance.

Do not add these fields to the closed snapshot or normative runtime `ruleset` object.

The bundled dynamic verifier checks the derived fields it can reproduce:
`project.id`, `project.version`, `runtime.package`, `runtime.version`, `specVersion`,
`sourceHash`, `exports`, `artifactCount`, and the sorted custom operator names. It does
not prove the identity or digest of an operator-pack distribution from a local module
path. Record and verify that package identity in the build or deployment system when it
is part of the release contract.
